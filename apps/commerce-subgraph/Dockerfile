FROM node:24.19.0-bookworm-slim AS dependencies
WORKDIR /workspace
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --config.minimumReleaseAge=0 --frozen-lockfile --prod

FROM node:24.19.0-bookworm-slim AS runtime
WORKDIR /workspace
ENV NODE_ENV=production
RUN groupadd --gid 10001 app && useradd --uid 10001 --gid app --create-home app
COPY --from=dependencies --chown=app:app /workspace/node_modules ./node_modules
COPY --chown=app:app apps/commerce-subgraph ./apps/commerce-subgraph
COPY --chown=app:app libs/contracts/graphql/commerce/schema.graphql ./libs/contracts/graphql/commerce/schema.graphql
USER app
CMD ["node", "--experimental-transform-types", "apps/commerce-subgraph/src/main.ts"]
