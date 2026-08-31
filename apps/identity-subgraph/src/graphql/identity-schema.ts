import { readFile } from 'node:fs/promises';

import { buildSubgraphSchema } from '@apollo/subgraph';
import { graphql, parse, type GraphQLSchema } from 'graphql';

import type { IdentityContext } from './identity.resolver.ts';
import { IdentityResolver } from './identity.resolver.ts';

export async function createIdentitySchema(resolver: IdentityResolver) {
  const contractUrl = new URL(
    '../../../../libs/contracts/graphql/identity/schema.graphql',
    import.meta.url,
  );
  const contract = await readFile(contractUrl, 'utf8');
  const schema = buildSubgraphSchema({
    typeDefs: parse(contract),
    resolvers: {
      Query: {
        users: (_root, args, context) =>
          resolver.usersConnection(args, context as IdentityContext),
        user: (_root, { id }, context) =>
          resolver.user(id, context as IdentityContext),
        me: (_root, _args, context) => resolver.me(context as IdentityContext),
      },
      User: {
        __resolveReference: (reference: { id: string }, context) =>
          resolver.resolveReference(reference, context as IdentityContext),
      },
    },
  });
  return { contract, schema, resolver };
}

export async function executeIdentityOperation(
  runtime: {
    contract: string;
    schema: GraphQLSchema;
    resolver: IdentityResolver;
  },
  input: {
    query: string;
    variables?: Record<string, unknown>;
    operationName?: string;
  },
  context: IdentityContext,
) {
  return graphql({
    schema: runtime.schema,
    source: input.query,
    variableValues: input.variables,
    operationName: input.operationName,
    contextValue: context,
  });
}
