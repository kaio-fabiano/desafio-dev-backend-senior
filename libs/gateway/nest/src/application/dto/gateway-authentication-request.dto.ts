export class GatewayAuthenticationRequest {
  constructor(
    readonly authorization: string,
    readonly cartToken: string | undefined,
    readonly cookie: string | undefined,
    readonly dpop: string | undefined,
    readonly method: string,
    readonly requestId: string,
    readonly url: string,
    readonly woocommerceSession: string | undefined,
  ) {}
}
