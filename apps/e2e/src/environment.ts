import { resolve } from 'node:path';

import {
  DockerComposeEnvironment,
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
    environment = await new DockerComposeEnvironment(resolve('.'), 'compose.yaml')
      .withBuild()
      .withEnvironment({ MCP_PORT: '0' })
      .withStartupTimeout(STARTUP_TIMEOUT)
      .up([...COMPOSE_SERVICES]);
    const gateway = environment.getContainer('gateway-1');
    const identity = environment.getContainer('identity-subgraph-1');
    const mcp = environment.getContainer('apollo-mcp-1');
    return {
      identityUrl: `http://${identity.getHost()}:${identity.getMappedPort(3001)}`,
      gatewayUrl: `http://${gateway.getHost()}:${gateway.getMappedPort(3000)}`,
      mcpUrl: `http://${mcp.getHost()}:${mcp.getMappedPort(8000)}/mcp`,
      startedComponents: COMPOSE_SERVICES,
      isStopped: () => stopped,
      stop,
    };
  } catch (error) {
    try {
      await stop();
    } catch (teardownError) {
      throw new AggregateError([error, teardownError], 'Real marketplace startup failed and rollback was incomplete');
    }
    throw error;
  }
}
