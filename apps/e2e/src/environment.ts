import { resolve } from 'node:path';

import {
  DockerComposeEnvironment,
  Wait,
  type StartedDockerComposeEnvironment,
} from 'testcontainers';

const STARTUP_TIMEOUT = 600_000;
const RETIRED_COMPONENTS = ['stock-worker'];
const COMPOSE_SERVICES = [
  'rabbitmq',
  'order-workflow-database',
  'identity-database',
  'payment-database',
  'wordpress-database',
  'wordpress',
  'wordpress-setup',
  'identity-subgraph',
  'order-workflow-subgraph',
  'payment-federation',
  'gateway',
  'apollo-mcp',
] as const;

export type Milestone7Environment = {
  identityUrl: string;
  gatewayUrl: string;
  mcpUrl: string;
  wordpressUrl: string;
  wordpressSiteToken: string;
  commerceUrl: string;
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
      .withEnvironment({
        MCP_PORT: '0',
        PAYMENT_PROVIDER_MODE: 'deterministic',
      })
      .withDefaultWaitStrategy(Wait.forHealthCheck())
      .withStartupTimeout(STARTUP_TIMEOUT)
      .up(COMPOSE_SERVICES.filter((service) => service !== 'wordpress-setup'));
    const startedEnvironment = environment;
    const gateway = startedEnvironment.getContainer('gateway-1');
    const identity = startedEnvironment.getContainer('identity-subgraph-1');
    const mcp = startedEnvironment.getContainer('apollo-mcp-1');
    const wordpress = startedEnvironment.getContainer('wordpress-1');
    const commerce = startedEnvironment.getContainer(
      'order-workflow-subgraph-1',
    );
    return {
      identityUrl: `http://${identity.getHost()}:${identity.getMappedPort(3001)}`,
      gatewayUrl: `http://${gateway.getHost()}:${gateway.getMappedPort(3000)}`,
      mcpUrl: `http://${mcp.getHost()}:${mcp.getMappedPort(8000)}/mcp`,
      wordpressUrl: `http://${wordpress.getHost()}:${wordpress.getMappedPort(80)}`,
      wordpressSiteToken: 'wordpress-local-only',
      commerceUrl: `http://${commerce.getHost()}:${commerce.getMappedPort(3003)}`,
      startedComponents: COMPOSE_SERVICES,
      isStopped: () => stopped,
      diagnostics: async () => {
        const services = [
          'order-workflow-subgraph',
          'payment-federation',
          'wordpress',
        ];
        const serviceLogs = (
          await Promise.all(
            services.map(async (service) => {
              const stream = await startedEnvironment
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
        const rabbit = await startedEnvironment
          .getContainer('rabbitmq-1')
          .exec([
            'rabbitmqctl',
            'list_queues',
            'name',
            'messages_ready',
            'messages_unacknowledged',
            'consumers',
          ]);
        return `${serviceLogs}\n--- rabbitmq ---\n${rabbit.output}\n--- retired components ---\n${RETIRED_COMPONENTS.join(', ')}`;
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
