export class RegistrationCompensationFailure {
  constructor(
    readonly step: 'wordpress' | 'sessions' | 'accounts' | 'user',
    readonly cause: unknown,
  ) {}
}
