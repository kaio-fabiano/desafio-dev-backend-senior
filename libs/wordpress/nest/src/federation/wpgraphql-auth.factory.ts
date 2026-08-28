import { createHmac } from 'node:crypto';

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
  headersFor(operation: WpGraphqlOperation, incoming: Headers): Headers;
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
        /cart|checkout/i.test(field) ? 'cart:write' : 'marketplace:read',
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
  proxySecret,
  now = Date.now,
}: {
  proxySecret: string;
  now?: () => number;
}): WpGraphqlAuth {
  if (!proxySecret.trim()) {
    throw new Error('WPGRAPHQL_FEDERATION_SECRET is required');
  }

  return {
    headersFor(operation, incoming) {
      const required = requiredScopes(operation);
      const subject = incoming.get('x-authenticated-subject')?.trim() ?? '';
      const wordpressSubject =
        incoming.get('x-wordpress-user-id')?.trim() || subject;
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
      if (!subject) return headers;
      if (!/^[\w.@:-]{1,128}$/.test(wordpressSubject)) {
        throw new WpGraphqlAuthorizationError(
          'The propagated WordPress subject is invalid',
        );
      }

      const scopeHeader = [...scopes].join(' ');
      const timestamp = String(Math.floor(now() / 1000));
      const payload = `${wordpressSubject}\n${scopeHeader}\n${timestamp}`;
      headers.set('x-marketplace-subject', wordpressSubject);
      headers.set('x-marketplace-scopes', scopeHeader);
      headers.set('x-marketplace-timestamp', timestamp);
      headers.set(
        'x-marketplace-signature',
        createHmac('sha256', proxySecret).update(payload).digest('hex'),
      );
      return headers;
    },
  };
}
