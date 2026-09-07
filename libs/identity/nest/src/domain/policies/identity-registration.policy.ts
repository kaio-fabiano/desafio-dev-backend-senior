export class IdentityRegistrationPolicy {
  private constructor(
    readonly email: string,
    readonly name: string,
    readonly password: string,
    readonly subject: string,
  ) {}

  static evaluate(
    bootstrap: boolean,
    email?: string,
    name?: string,
    password?: string,
    subject?: string,
  ): IdentityRegistrationPolicy | undefined {
    if (bootstrap || !email || !name || !password || !subject) return;
    return new IdentityRegistrationPolicy(email, name, password, subject);
  }
}
