export abstract class WordPressCredentialPort {
  abstract exchange(subject: string): Promise<string>;
}
