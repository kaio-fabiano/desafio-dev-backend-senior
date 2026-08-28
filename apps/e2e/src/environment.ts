import { resolve } from 'node:path';

import {
  DockerComposeEnvironment,
  Wait,
  type StartedDockerComposeEnvironment,
} from 'testcontainers';

const STARTUP_TIMEOUT = 600_000;
const COMPOSE_SERVICES = [
  'rabbitmq',
  'postgres',
  'identity-database',
  'payment-database',
  'wordpress-database',
  'wordpress',
  'wordpress-setup',
  'identity-subgraph',
  'commerce-subgraph',
  'stock-worker',
  'payment-processor',
  'gateway',
  'apollo-mcp',
] as const;

export type Milestone7Environment = {
  identityUrl: string;
  gatewayUrl: string;
  mcpUrl: string;
  startedComponents: readonly string[];
  isStopped(): boolean;
  diagnostics(): Promise<string>;
  stop(): Promise<void>;
};

/** Starts the delivered Dockerfiles; marketplace behavior never lives here. */
export async function startMilestone7Environment(): Promise<Milestone7Environment> {
  let environment: StartedDockerComposeEnvironment | undefined;
  let stopped = false;
  const stop = async () => {
    if (stopped) return;
    stopped = true;
    if (environment) await environment.down({ removeVolumes: true });
  };

  try {
    environment = await new DockerComposeEnvironment(
      resolve('.'),
      'compose.yaml',
    )
      .withBuild()
      .withEnvironment({ MCP_PORT: '0' })
      .withDefaultWaitStrategy(Wait.forHealthCheck())
      .withStartupTimeout(STARTUP_TIMEOUT)
      .up(COMPOSE_SERVICES.filter((service) => service !== 'wordpress-setup'));
    const gateway = environment.getContainer('gateway-1');
    const identity = environment.getContainer('identity-subgraph-1');
    const mcp = environment.getContainer('apollo-mcp-1');
    return {
      identityUrl: `http://${identity.getHost()}:${identity.getMappedPort(3001)}`,
      gatewayUrl: `http://${gateway.getHost()}:${gateway.getMappedPort(3000)}`,
      mcpUrl: `http://${mcp.getHost()}:${mcp.getMappedPort(8000)}/mcp`,
      startedComponents: COMPOSE_SERVICES,
      isStopped: () => stopped,
      diagnostics: async () => {
        const services = ['stock-worker', 'wordpress'];
        const serviceLogs = (
          await Promise.all(
            services.map(async (service) => {
              const stream = await environment!
                .getContainer(`${service}-1`)
                .logs({ tail: 200 });
              let logs = '';
              stream.on('data', (chunk) => {
                logs += chunk.toString();
              });
              await new Promise((resolve) => setTimeout(resolve, 250));
              stream.destroy();
              return `--- ${service} ---\n${logs}`;
            }),
          )
        ).join('\n');
        const database = await environment!
          .getContainer('postgres-1')
          .exec([
            'psql',
            '-U',
            'postgres',
            '-d',
            'commerce',
            '-c',
            'select event_type, payload, publication_attempts, last_publication_attempt_at, sent_at from commerce_outbox_event; select state, woo_order_id from commerce_order_workflow; select event_id from commerce_inbox_record; select event_id, result from stock_worker_inbox;',
          ]);
        const rabbit = await environment!
          .getContainer('rabbitmq-1')
          .exec(['sh', '-c', 'timeout 5 rabbitmqctl list_queues name messages_ready messages_unacknowledged consumers']);
        return `${serviceLogs}\n--- commerce database ---\n${database.output}\n--- rabbitmq ---\n${rabbit.output}`;
      },
      stop,
    };
  } catch (error) {
    try {
      await stop();
    } catch (teardownError) {
      throw new AggregateError(
        [error, teardownError],
        'Real marketplace startup failed and rollback was incomplete',
      );
    }
    throw error;
  }
}
