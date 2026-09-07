import { randomUUID } from 'node:crypto';
const token = randomUUID();
export function identityBootstrapHeaders(): Headers { return new Headers({ 'x-identity-bootstrap': token }); }
export function isIdentityBootstrap(headers?: Headers): boolean { return headers?.get('x-identity-bootstrap') === token; }
