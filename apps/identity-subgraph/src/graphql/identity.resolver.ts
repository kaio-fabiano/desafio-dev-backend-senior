export type IdentityUser = { id: string; email: string };

export type IdentityContext = {
  subject: string;
  scopes: readonly string[];
  loadUser?: (id: string) => Promise<IdentityUser | null>;
};

export type UserConnection = {
  edges: Array<{ cursor: string; node: IdentityUser }>;
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
};

export type IdentityUserRepository = {
  findById(id: string): Promise<IdentityUser | null>;
  findPage(input: { first: number; after?: string }): Promise<UserConnection>;
};

export class IdentityAuthorizationError extends Error {}

export class IdentityResolver {
  private readonly users: IdentityUserRepository;

  constructor(
    users:
      | IdentityUserRepository
      | ((id: string) => Promise<IdentityUser | null>),
  ) {
    this.users =
      typeof users === 'function'
        ? {
            findById: users,
            findPage: async () => {
              throw new Error('User listing repository is not configured');
            },
          }
        : users;
  }

  private requireRead(context: IdentityContext) {
    if (!context.subject || !context.scopes.includes('marketplace:read')) {
      throw new IdentityAuthorizationError('Identity read access denied');
    }
  }

  private findUser(id: string, context?: IdentityContext) {
    return context?.loadUser?.(id) ?? this.users.findById(id);
  }

  usersConnection(
    input: { first?: number; after?: string },
    context: IdentityContext,
  ) {
    this.requireRead(context);
    const first = input.first ?? 20;
    if (!Number.isInteger(first) || first < 1 || first > 100) {
      throw new Error('first must be between 1 and 100');
    }
    return this.users.findPage({ first, after: input.after });
  }

  user(id: string, context: IdentityContext) {
    this.requireRead(context);
    return this.findUser(id, context);
  }

  me(context: IdentityContext) {
    this.requireRead(context);
    return this.findUser(context.subject, context);
  }

  resolveReference(reference: { id: string }, context?: IdentityContext) {
    return this.findUser(reference.id, context);
  }
}
