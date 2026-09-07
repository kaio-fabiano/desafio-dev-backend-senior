import { SetMetadata } from '@nestjs/common';

export const RequireScope = (scope: string) => SetMetadata('scope', scope);
