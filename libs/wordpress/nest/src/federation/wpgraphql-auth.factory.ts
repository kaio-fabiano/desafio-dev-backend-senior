import {
  Kind,
  parse,
  type DocumentNode,
  type OperationDefinitionNode,
  type SelectionSetNode,
} from 'graphql';

export type WpGraphqlOperation = {
  query: string;
  operationName?: string;
  variables?: Record<string, unknown>;
};

export type WpGraphqlAuth = {
  headersFor(
    operation: WpGraphqlOperation,
    incoming: Headers,
  ): Promise<Headers>;
};

export class WpGraphqlAuthorizationError extends Error {}

const QUERY_SCOPES: Readonly<Record<string, string>> = {
  cart: 'cart:read',
  customer: 'orders:read',
  order: 'orders:read',
  orders: 'orders:read',
};

const PUBLIC_QUERY_FIELDS = new Set([
  '__schema',
  '__type',
  '_service',
  'product',
  'products',
]);

function operationDefinition(
  document: DocumentNode,
  operationName?: string,
): OperationDefinitionNode {
  const operations = document.definitions.filter(
    (definition): definition is OperationDefinitionNode =>
      definition.kind === Kind.OPERATION_DEFINITION,
  );
  const selected = operationName
    ? operations.find((operation) => operation.name?.value === operationName)
    : operations.length === 1
      ? operations[0]
      : undefined;
  if (!selected) {
    throw new WpGraphqlAuthorizationError(
      operationName
        ? `GraphQL operation ${operationName} was not found`
        : 'GraphQL operationName is required for documents with multiple operations',
    );
  }
  return selected;
}

function rootFields(
  document: DocumentNode,
  selectionSet: SelectionSetNode,
  seen = new Set<string>(),
): string[] {
  const fields: string[] = [];
  for (const selection of selectionSet.selections) {
    if (selection.kind === Kind.FIELD) {
      fields.push(selection.name.value);
      continue;
    }
    if (selection.kind === Kind.INLINE_FRAGMENT) {
      fields.push(...rootFields(document, selection.selectionSet, seen));
      continue;
    }
    if (!seen.has(selection.name.value)) {
      seen.add(selection.name.value);
      const fragment = document.definitions.find(
        (definition) =>
          definition.kind === Kind.FRAGMENT_DEFINITION &&
          definition.name.value === selection.name.value,
      );
      if (fragment?.kind === Kind.FRAGMENT_DEFINITION) {
        fields.push(...rootFields(document, fragment.selectionSet, seen));
      }
    }
  }
  return fields;
}

function requiredScopes(operation: WpGraphqlOperation): Set<string> {
  let document: DocumentNode;
  try {
    document = parse(operation.query);
  } catch {
    throw new WpGraphqlAuthorizationError('Invalid GraphQL document');
  }
  const definition = operationDefinition(document, operation.operationName);
  const fields = rootFields(document, definition.selectionSet);
  const scopes = new Set<string>();

  for (const field of fields) {
    if (definition.operation === 'mutation') {
      scopes.add(
        field === 'updateOrder'
          ? 'orders:write'
          : /cart|checkout/i.test(field)
            ? 'cart:write'
            : 'marketplace:read',
      );
    } else if (definition.operation === 'query') {
      const scope = QUERY_SCOPES[field];
      if (scope) scopes.add(scope);
      else if (!PUBLIC_QUERY_FIELDS.has(field)) scopes.add('marketplace:read');
    }
  }
  return scopes;
}

function copySessionHeaders(incoming: Headers): Headers {
  const headers = new Headers();
  for (const name of ['cookie', 'woocommerce-session', 'cart-token']) {
    const value = incoming.get(name);
    if (value) headers.set(name, value);
  }
  return headers;
}

export function createWpGraphqlAuth({
  endpoint,
  siteToken,
  request = fetch,
}: {
  endpoint: string;
  siteToken: string;
  request?: typeof fetch;
}): WpGraphqlAuth {
  if (!siteToken.trim()) {
    throw new Error('WPGRAPHQL_SITE_TOKEN is required');
  }

  return {
    async headersFor(operation, incoming) {
      const required = requiredScopes(operation);
      const subject = incoming.get('x-authenticated-subject')?.trim() ?? '';
      const wordpressSubject = subject;
      const scopes = new Set(
        (incoming.get('x-authenticated-scopes') ?? '')
          .split(/\s+/)
          .filter(Boolean),
      );

      if (required.size > 0 && !subject) {
        throw new WpGraphqlAuthorizationError(
          'An authenticated subject is required for this WordPress operation',
        );
      }
      for (const scope of required) {
        if (!scopes.has(scope)) {
          throw new WpGraphqlAuthorizationError(`${scope} scope is required`);
        }
      }

      const headers = copySessionHeaders(incoming);
      headers.set('origin', new URL(endpoint).origin);
      if (!subject) return headers;
      if (!/^[\w.@:-]{1,128}$/.test(wordpressSubject)) {
        throw new WpGraphqlAuthorizationError(
          'The propagated WordPress subject is invalid',
        );
      }

      const login = await request(endpoint, {
        method: 'POST',
        headers: {
          accept: 'application/graphql-response+json, application/json',
          'content-type': 'application/json',
          origin: new URL(endpoint).origin,
          'x-wpgraphql-site-token': siteToken,
        },
        body: JSON.stringify({
          operationName: 'LoginWithSiteToken',
          query: `mutation LoginWithSiteToken($identity: String!) {
            login(input: { provider: SITETOKEN, identity: $identity }) {
              authToken
              wooSessionToken
            }
          }`,
          variables: { identity: wordpressSubject },
        }),
      });
      const payload = (await login.json().catch(() => undefined)) as
        | {
            data?: {
              login?: { authToken?: unknown; wooSessionToken?: unknown };
            };
            errors?: Array<{ message?: unknown }>;
          }
        | undefined;
      const authToken = payload?.data?.login?.authToken;
      if (!login.ok || typeof authToken !== 'string' || !authToken) {
        const message = payload?.errors?.find(
          (error) => typeof error.message === 'string',
        )?.message;
        throw new WpGraphqlAuthorizationError(
          typeof message === 'string'
            ? message
            : 'WordPress session exchange failed',
        );
      }
      headers.set('authorization', `Bearer ${authToken}`);
      const wooSessionToken = payload?.data?.login?.wooSessionToken;
      if (typeof wooSessionToken === 'string' && wooSessionToken) {
        headers.set('woocommerce-session', `Session ${wooSessionToken}`);
      }
      return headers;
    },
  };
}
