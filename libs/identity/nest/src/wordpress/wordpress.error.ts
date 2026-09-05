export type WordPressErrorCode =
  | 'WORDPRESS_CONFIGURATION_INVALID'
  | 'WORDPRESS_CREATE_FAILED'
  | 'WORDPRESS_DELETE_FAILED'
  | 'WORDPRESS_IDENTITY_ALREADY_EXISTS'
  | 'WORDPRESS_LINK_FAILED';

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
