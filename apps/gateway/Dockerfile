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
COPY --chown=app:app apps/gateway ./apps/gateway
COPY --chown=app:app libs/contracts/graphql ./libs/contracts/graphql
COPY --chown=app:app libs/gateway/nest ./libs/gateway/nest
COPY --chown=app:app libs/platform/nest ./libs/platform/nest
USER app
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/ready').then(response => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "--experimental-transform-types", "apps/gateway/src/main.ts"]
