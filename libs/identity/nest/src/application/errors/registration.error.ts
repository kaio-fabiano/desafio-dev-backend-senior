import { RegistrationCompensationFailure } from '../dto/registration-compensation-failure.dto.ts';
import { IdentityErrorMessages } from './identity-error-messages.ts';

export class RegistrationError extends Error {
  readonly failures?: readonly RegistrationCompensationFailure[];

  constructor(
    readonly code: 'REGISTRATION_COMPENSATION_FAILED',
    message: string = IdentityErrorMessages.registration
      .REGISTRATION_COMPENSATION_FAILED,
    options?: ErrorOptions & {
      failures?: readonly RegistrationCompensationFailure[];
    },
  ) {
    super(message, options);
    this.name = 'RegistrationError';
    this.failures = options?.failures;
  }
}
