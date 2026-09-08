export class RegisterIdentityCommand {
  constructor(
    readonly email: string,
    readonly name: string,
    readonly password: string,
    readonly subject: string,
  ) {}
}
