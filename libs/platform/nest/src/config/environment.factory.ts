export type Environment = Readonly<Record<string, string | undefined>>;

export const ENVIRONMENT = Symbol('ENVIRONMENT');

/**
 * Takes a snapshot of the process environment before it is exposed to NestJS
 * providers. Applications can override this provider in tests without changing
 * global process state.
 */
export function environmentFactory(
  environment: NodeJS.ProcessEnv = process.env,
): Environment {
  return Object.freeze({ ...environment });
}
