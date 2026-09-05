import { SetMetadata } from '@nestjs/common';

export const REQUIRED_SCOPES = Symbol('REQUIRED_SCOPES');

export const RequireScopes = (...scopes: string[]) =>
  SetMetadata(REQUIRED_SCOPES, scopes);
