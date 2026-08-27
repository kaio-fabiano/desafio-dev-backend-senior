FROM node:24.19.0-bookworm-slim
WORKDIR /workspace
COPY apps/commerce-subgraph/src/messaging/rabbitmq.ts apps/commerce-subgraph/src/messaging/rabbitmq.ts
COPY apps/stock-worker/ apps/stock-worker/
RUN npm install --omit=dev amqplib@2.0.1
CMD ["node", "--experimental-transform-types", "apps/stock-worker/src/app.module.ts"]
