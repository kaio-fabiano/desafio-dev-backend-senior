import { IdentityUser } from './identity-user.dto.ts';

export class IdentityUserConnection {
  constructor(
    readonly edges: Array<{ cursor: string; node: IdentityUser }>,
    readonly pageInfo: {
      hasNextPage: boolean;
      hasPreviousPage: boolean;
      startCursor: string | null;
      endCursor: string | null;
    },
  ) {}
}
