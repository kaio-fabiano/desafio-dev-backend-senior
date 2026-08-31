export function normalizeWordPressSdl(sdl) {
  const productKey = sdl.replace(
    /interface Product\b(?![^{]*@key)([^{]*){/,
    'interface Product$1@key(fields: "id") {',
  );
  const inaccessibleImport = productKey.includes('@inaccessible')
    ? productKey
    : productKey.replace(
        /(https:\/\/specs\.apollo\.dev\/federation\/v[\d.]+[\s\S]*?import\s*:\s*\[)([^\]]*)(\])/,
        '$1$2, "@inaccessible"$3',
      );
  return inaccessibleImport
    .replace(
      /(\bhasPreviousPage\s*:\s*Boolean!?)(?!\s*@inaccessible)/g,
      '$1 @inaccessible',
    )
    .replace(
      /(\bstartCursor\s*:\s*String)(?!\s*@inaccessible)/g,
      '$1 @inaccessible',
    );
}

async function graphql(
  endpoint,
  query,
  variables,
  { headers = {}, request = fetch } = {},
) {
  const response = await request(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify({ query, variables }),
  });
  const body = await response.json();
  if (!response.ok || body.errors)
    throw new Error(JSON.stringify(body.errors ?? body));
  return body.data;
}

export async function publishWordPressSubgraph(endpoint, options) {
  const data = await graphql(
    endpoint,
    '{ _service { sdl } }',
    undefined,
    options,
  );
  return normalizeWordPressSdl(data._service.sdl);
}

export async function fetchProductPage(endpoint, first, after = null, options) {
  const data = await graphql(
    endpoint,
    `
      query Products($first: Int!, $after: String) {
        products(first: $first, after: $after) {
          nodes {
            id
            name
          }
          pageInfo {
            hasNextPage
            hasPreviousPage
            startCursor
            endCursor
          }
        }
      }
    `,
    { first, after },
    options,
  );
  return data.products;
}
