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
COPY --chown=app:app package.json ./package.json
COPY --chown=app:app apps/gateway/src/auth/auth-context.ts ./apps/gateway/src/auth/auth-context.ts
COPY --chown=app:app apps/identity-subgraph ./apps/identity-subgraph
COPY --chown=app:app libs/contracts/graphql/identity/schema.graphql ./libs/contracts/graphql/identity/schema.graphql
COPY --chown=app:app libs/identity/nest ./libs/identity/nest
USER app
CMD ["node", "--experimental-transform-types", "apps/identity-subgraph/src/main.ts"]
