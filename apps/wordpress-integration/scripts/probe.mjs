import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const endpoint =
  process.env.WORDPRESS_GRAPHQL_URL ?? 'http://localhost:18080/graphql';
const loginUrl = new URL('/wp-login.php', endpoint);
const composeFile = fileURLToPath(new URL('../compose.yaml', import.meta.url));

async function graphql(query, variables = {}, cookie = '') {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: new URL(endpoint).origin,
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });
  const body = await response.json();
  return { response, body };
}

function addAbstractProductKey(sdl) {
  return sdl.replace(
    /interface Product\b(?![^{]*@key)([^{]*){/,
    'interface Product$1 @key(fields: "id") {',
  );
}

function compose(sdl, label) {
  const directory = mkdtempSync(
    join(process.cwd(), '.wordpress-integration-'),
  );
  try {
    chmodSync(directory, 0o755);
    writeFileSync(join(directory, 'wordpress.graphql'), sdl);
    writeFileSync(
      join(directory, 'supergraph.yaml'),
      `federation_version: =2.15.2\nsubgraphs:\n  wordpress:\n    routing_url: ${endpoint}\n    schema:\n      file: /workspace/wordpress.graphql\n`,
    );
    return execFileSync(
      'docker',
      [
        'run',
        '--rm',
        '--volume',
        `${directory}:/workspace:ro`,
        '--workdir',
        '/workspace',
        'ghcr.io/apollographql/rover:0.41.0',
        'supergraph',
        'compose',
        '--elv2-license=accept',
        '--format=json',
        '--config',
        '/workspace/supergraph.yaml',
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
  } catch (error) {
    error.message = `${label}: ${error.stderr || error.message}`;
    throw error;
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function database(sql) {
  return execFileSync(
    'docker',
    [
      'compose',
      '--file',
      composeFile,
      'exec',
      '--no-TTY',
      'database',
      'mariadb',
      '--user=root',
      '--password=wordpress-root',
      '--skip-column-names',
      '--execute',
      sql,
    ],
    { encoding: 'utf8' },
  );
}

async function login(username, password) {
  const body = new URLSearchParams({
    log: username,
    pwd: password,
    'wp-submit': 'Log In',
    redirect_to: 'http://localhost:18080/wp-admin/',
    testcookie: '1',
  });
  const response = await fetch(loginUrl, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      cookie: 'wordpress_test_cookie=WP%20Cookie%20check',
    },
    body,
  });
  const cookies = response.headers
    .getSetCookie()
    .map((value) => value.split(';', 1)[0])
    .join('; ');
  assert.match(
    cookies,
    /wordpress_logged_in_/,
    'vendor login did not establish a WordPress session',
  );
  return cookies;
}

const service = await graphql('{ _service { sdl } }');
assert.equal(service.response.status, 200);
assert.equal(
  service.body.errors,
  undefined,
  JSON.stringify(service.body.errors),
);
const pluginSdl = service.body.data?._service?.sdl;
assert.ok(pluginSdl, 'the federation plugin did not expose _service.sdl');

let directComposition;
try {
  compose(pluginSdl, 'direct plugin composition');
  directComposition = { status: 'passed' };
} catch (error) {
  directComposition = {
    status: 'gap',
    reason: String(error.message).replace(/\s+/g, ' ').slice(0, 500),
  };
}

const normalizedSdl = addAbstractProductKey(pluginSdl);
const supergraph = compose(
  normalizedSdl,
  'normalized Federation v2 composition',
);
for (const type of [
  'Product',
  'SimpleProduct',
  'VariableProduct',
  'ExternalProduct',
  'GroupProduct',
  'Order',
]) {
  assert.match(
    normalizedSdl,
    new RegExp(`(?:interface|type) ${type}[^\\{]*@key\\(fields: "id"\\)`),
  );
}
assert.match(supergraph, /join__Graph/);

const pageOne = await graphql(
  `
    query ProductPage($first: Int!, $after: String) {
      products(first: $first, after: $after) {
        nodes {
          __typename
          id
          databaseId
          name
          sku
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `,
  { first: 2 },
);
assert.equal(
  pageOne.body.errors,
  undefined,
  JSON.stringify(pageOne.body.errors),
);
assert.equal(pageOne.body.data.products.nodes.length, 2);
assert.equal(pageOne.body.data.products.pageInfo.hasNextPage, true);
assert.ok(pageOne.body.data.products.pageInfo.endCursor);

const pageTwo = await graphql(
  `
    query ProductPage($first: Int!, $after: String) {
      products(first: $first, after: $after) {
        nodes {
          __typename
          id
          databaseId
          name
          sku
        }
        pageInfo {
          hasPreviousPage
          startCursor
        }
      }
    }
  `,
  { first: 2, after: pageOne.body.data.products.pageInfo.endCursor },
);
assert.equal(
  pageTwo.body.errors,
  undefined,
  JSON.stringify(pageTwo.body.errors),
);
assert.ok(pageTwo.body.data.products.nodes.length >= 1);
assert.equal(pageTwo.body.data.products.pageInfo.hasPreviousPage, true);

const products = [
  ...pageOne.body.data.products.nodes,
  ...pageTwo.body.data.products.nodes,
];
const representations = products
  .slice(0, 2)
  .map(({ __typename, id }) => ({ __typename, id }));
database(
  'SET GLOBAL log_output="TABLE"; SET GLOBAL general_log=ON; TRUNCATE TABLE mysql.general_log;',
);
let entities;
let databaseQueries;
try {
  entities = await graphql(
    `
      query BatchedProducts($representations: [_Any!]!) {
        _entities(representations: $representations) {
          ... on SimpleProduct {
            id
            databaseId
            name
          }
        }
      }
    `,
    { representations },
  );
  assert.equal(
    entities.body.errors,
    undefined,
    JSON.stringify(entities.body.errors),
  );
  assert.equal(entities.body.data._entities.length, 2);
  assert.ok(entities.body.data._entities.every(Boolean));
  const databaseIds = products
    .slice(0, 2)
    .map(({ databaseId }) => databaseId)
    .sort((left, right) => left - right);
  databaseQueries = database(
    "SELECT argument FROM mysql.general_log WHERE command_type='Query' AND argument LIKE '%wp_posts.ID IN (%' ORDER BY event_time;",
  )
    .split('\n')
    .filter((query) =>
      query.includes(`wp_posts.ID IN (${databaseIds.join(',')})`),
    );
  assert.equal(
    databaseQueries.length,
    1,
    `expected one batched post load, got ${databaseQueries.length}`,
  );
} finally {
  database('SET GLOBAL general_log=OFF;');
}

const alpha = products.find((product) => product.sku === 'POC-ALPHA');
const beta = products.find((product) => product.sku === 'POC-BETA');
assert.ok(alpha && beta, 'seeded ownership fixtures were not returned');
const vendorCookie = await login('vendor-alpha', 'vendor-alpha-local-only');
const unauthorizedName = `Forbidden update ${Date.now()}`;
const unauthorized = await graphql(
  `
    mutation UpdateProduct($id: ID!, $name: String!) {
      updateProduct(input: { id: $id, name: $name }) {
        product {
          databaseId
          name
        }
      }
    }
  `,
  { id: beta.id, name: unauthorizedName },
  vendorCookie,
);
assert.ok(
  unauthorized.body.errors?.length,
  'a vendor changed another vendor product',
);

const verifyBeta = await graphql(
  `
    query Product($id: ID!) {
      product(id: $id) {
        name
      }
    }
  `,
  { id: beta.id },
);
assert.notEqual(verifyBeta.body.data.product.name, unauthorizedName);

const report = {
  versions: {
    wordpress: '6.8.2-php8.3-apache',
    woocommerce: '10.4.3',
    wpGraphql: '2.20.0',
    wpGraphqlWooCommerce: '1.0.3',
    wpGraphqlHeadlessLogin: '0.4.4',
    wpGraphqlFederations: 'ac480974ceb6a1680410f955005e060056f150da',
    rover: '0.41.0',
    federation: '2.15.2',
  },
  composition: {
    directPlugin: directComposition,
    normalized: 'passed',
    entityKeys: [
      'Product.id',
      'SimpleProduct.id',
      'VariableProduct.id',
      'ExternalProduct.id',
      'GroupProduct.id',
      'Order.id',
    ],
  },
  relay: {
    firstPageCount: pageOne.body.data.products.nodes.length,
    secondPageCount: pageTwo.body.data.products.nodes.length,
    cursorAdvanced: true,
  },
  batching: {
    operation: '_entities',
    representations: representations.length,
    resolved: entities.body.data._entities.length,
    httpRequests: 1,
    databaseQueries: databaseQueries.length,
  },
  ownership: {
    actor: 'vendor-alpha',
    targetOwner: 'vendor-beta',
    rejected: true,
    targetUnchanged: true,
  },
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
