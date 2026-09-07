import { SetMetadata } from '@nestjs/common';

import { RequiredScopesMetadata } from '../presentation/graphql/required-scopes.metadata.ts';

export const RequireScopes = (...scopes: string[]) =>
  SetMetadata(RequiredScopesMetadata.key, scopes);
