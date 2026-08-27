FROM ghcr.io/apollographql/apollo-mcp-server:v1.17.0 AS assets

COPY apps/apollo-mcp/mcp.yaml /data/mcp.yaml
COPY apps/apollo-mcp/schema.graphql /data/schema.graphql
COPY apps/apollo-mcp/operations/ /data/operations/

FROM busybox:1.37.0-musl AS healthcheck

FROM ghcr.io/apollographql/apollo-mcp-server:v1.17.0 AS runtime
COPY --from=assets --chown=1000:1000 /data /data
COPY --from=healthcheck /bin/busybox /bin/wget
USER 1000:1000

CMD ["/data/mcp.yaml"]
