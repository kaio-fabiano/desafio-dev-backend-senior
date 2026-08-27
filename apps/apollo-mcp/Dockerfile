FROM ghcr.io/apollographql/apollo-mcp-server:v1.17.0

COPY --chown=1000:1000 apps/apollo-mcp/mcp.yaml /data/mcp.yaml
COPY --chown=1000:1000 apps/apollo-mcp/schema.graphql /data/schema.graphql
COPY --chown=1000:1000 apps/apollo-mcp/operations/ /data/operations/

CMD ["/data/mcp.yaml"]
