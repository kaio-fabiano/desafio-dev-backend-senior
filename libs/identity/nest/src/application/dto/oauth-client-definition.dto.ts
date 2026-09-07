export class OAuthClientDefinition {
  constructor(
    readonly name: string,
    readonly redirectUri: string,
    readonly softwareId: string,
    readonly scopes: readonly string[],
  ) {}
}
