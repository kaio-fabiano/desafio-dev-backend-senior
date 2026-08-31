import { resolve } from 'node:path';

import {
  DockerComposeEnvironment,
  Wait,
  type StartedDockerComposeEnvironment,
} from 'testcontainers';

const STARTUP_TIMEOUT = 600_000;
const RETIRED_COMPONENTS = ['postgres', 'commerce-subgraph', 'stock-worker'];
const COMPOSE_SERVICES = [
  'identity-database',
  'payment-database',
  'wordpress-database',
  'wordpress',
  'wordpress-setup',
  'identity-subgraph',
  'payment-processor',
  'wordpress-federation',
  'gateway',
  'apollo-mcp',
] as const;

export type Milestone7Environment = {
  identityUrl: string;
  gatewayUrl: string;
  mcpUrl: string;
  wordpressFederationUrl: string;
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
    const wordpressFederation = environment.getContainer(
      'wordpress-federation-1',
    );
    return {
      identityUrl: `http://${identity.getHost()}:${identity.getMappedPort(3001)}`,
      gatewayUrl: `http://${gateway.getHost()}:${gateway.getMappedPort(3000)}`,
      mcpUrl: `http://${mcp.getHost()}:${mcp.getMappedPort(8000)}/mcp`,
      wordpressFederationUrl: `http://${wordpressFederation.getHost()}:${wordpressFederation.getMappedPort(3004)}`,
      startedComponents: COMPOSE_SERVICES,
      isStopped: () => stopped,
      diagnostics: async () => {
        const services = [
          'wordpress-federation',
          'payment-processor',
          'wordpress',
        ];
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
        return `${serviceLogs}\n--- retired components ---\n${RETIRED_COMPONENTS.join(', ')}`;
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
