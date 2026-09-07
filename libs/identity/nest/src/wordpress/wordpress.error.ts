import type { WordPressErrorCode } from './wordpress-error-code.d.ts';

export class WordPressError extends Error {
  constructor(
    readonly code: WordPressErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'WordPressError';
  }
}
