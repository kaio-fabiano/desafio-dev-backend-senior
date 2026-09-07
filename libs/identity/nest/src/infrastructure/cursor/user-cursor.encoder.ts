export class UserCursorEncoder {
  static encode(id: string): string {
    return Buffer.from(id).toString('base64url');
  }
}
