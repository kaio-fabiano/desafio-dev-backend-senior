export class IdentityUserVisibilityPolicy {
  static readonly administrativeScope = 'identity:users:read';
  static readonly selfScope = 'marketplace:read';

  static allows(
    userId: string,
    subject: string,
    scopes: readonly string[],
  ): boolean {
    return (
      scopes.includes(IdentityUserVisibilityPolicy.administrativeScope) ||
      (userId === subject &&
        scopes.includes(IdentityUserVisibilityPolicy.selfScope))
    );
  }
}
