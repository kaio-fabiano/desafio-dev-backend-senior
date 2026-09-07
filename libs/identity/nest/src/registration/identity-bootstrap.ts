import { randomUUID } from 'node:crypto';

export class IdentityBootstrap {
  private static readonly token = randomUUID();

  static headers(): Headers {
    return new Headers({ 'x-identity-bootstrap': IdentityBootstrap.token });
  }

  static matches(headers?: Headers): boolean {
    return headers?.get('x-identity-bootstrap') === IdentityBootstrap.token;
  }
}
