import type { CompensationFailure } from './registration.types.d.ts';

export class RegistrationError extends Error {
  readonly failures?: readonly CompensationFailure[];

  constructor(
    readonly code: 'REGISTRATION_COMPENSATION_FAILED',
    message: string,
    options?: ErrorOptions & { failures?: readonly CompensationFailure[] },
  ) {
    super(message, options);
    this.name = 'RegistrationError';
    this.failures = options?.failures;
  }
}
