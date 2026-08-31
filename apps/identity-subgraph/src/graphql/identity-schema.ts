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
        users: (_root, args, context: IdentityContext) =>
          resolver.usersConnection(args, context),
        user: (_root, { id }, context: IdentityContext) =>
          resolver.user(id, context),
        me: (_root, _args, context: IdentityContext) => resolver.me(context),
      },
      User: {
        __resolveReference: (
          reference: { id: string },
          context: IdentityContext,
        ) => resolver.resolveReference(reference, context),
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
