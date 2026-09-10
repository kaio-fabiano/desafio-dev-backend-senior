export class GatewayRuntimeMessages {
  static readonly serviceUnavailableResponse = {
    message: 'Service Unavailable',
    statusCode: 503,
  } as const;
  static readonly subscriptionUnauthenticated = 'Unauthenticated subscription';
}
