import { BadRequestException } from '@nestjs/common';

import { IdentityErrorMessages } from '../../application/errors/identity-error-messages.ts';

export class UserCursorDecoder {
  static decode(cursor?: string): string | undefined {
    if (!cursor) return undefined;
    if (!/^[A-Za-z0-9_-]+$/.test(cursor)) {
      throw new BadRequestException(IdentityErrorMessages.invalidUserCursor);
    }
    const id = Buffer.from(cursor, 'base64url').toString();
    if (!id || Buffer.from(id).toString('base64url') !== cursor) {
      throw new BadRequestException(IdentityErrorMessages.invalidUserCursor);
    }
    return id;
  }
}
