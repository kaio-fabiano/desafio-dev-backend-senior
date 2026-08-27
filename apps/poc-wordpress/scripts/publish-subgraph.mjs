export function normalizeWordPressSdl(sdl) {
  return sdl.replace(
    /interface Product\b(?![^\{]*@key)([^\{]*)\{/,
    'interface Product$1@key(fields: "id") {',
  );
}

async function graphql(endpoint, query, variables) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const body = await response.json();
  if (!response.ok || body.errors) throw new Error(JSON.stringify(body.errors ?? body));
  return body.data;
}

export async function publishWordPressSubgraph(endpoint) {
  const data = await graphql(endpoint, '{ _service { sdl } }');
  return normalizeWordPressSdl(data._service.sdl);
}

export async function fetchProductPage(endpoint, first, after = null) {
  const data = await graphql(
    endpoint,
    `query Products($first: Int!, $after: String) {
      products(first: $first, after: $after) {
        nodes { id name }
        pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
      }
    }`,
    { first, after },
  );
  return data.products;
}
