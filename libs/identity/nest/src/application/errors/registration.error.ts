import { RegistrationCompensationFailure } from '../dto/registration-compensation-failure.dto.ts';

export class RegistrationError extends Error {
  readonly failures?: readonly RegistrationCompensationFailure[];

  constructor(
    readonly code: 'REGISTRATION_COMPENSATION_FAILED',
    message: string,
    options?: ErrorOptions & {
      failures?: readonly RegistrationCompensationFailure[];
    },
  ) {
    super(message, options);
    this.name = 'RegistrationError';
    this.failures = options?.failures;
  }
}
