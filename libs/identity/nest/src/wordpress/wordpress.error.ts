import type { WordPressErrorCode } from './wordpress-error-code.d.ts';
import { IdentityErrorMessages } from '../application/errors/identity-error-messages.ts';

export class WordPressError extends Error {
  constructor(
    readonly code: WordPressErrorCode,
    message: string = IdentityErrorMessages.wordpress[code],
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'WordPressError';
  }
}
