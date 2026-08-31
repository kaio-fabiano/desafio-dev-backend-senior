import type { Pool } from 'pg';

import type {
  IdentityUser,
  IdentityUserRepository,
  UserConnection,
} from './identity.resolver.ts';

function encodeCursor(id: string) {
  return Buffer.from(id).toString('base64url');
}

function decodeCursor(cursor?: string) {
  if (!cursor) return undefined;
  try {
    return Buffer.from(cursor, 'base64url').toString();
  } catch {
    throw new Error('Invalid user cursor');
  }
}

export class PostgresUserRepository implements IdentityUserRepository {
  constructor(private readonly database: Pick<Pool, 'query'>) {}

  async findById(id: string): Promise<IdentityUser | null> {
    const result = await this.database.query<IdentityUser>(
      'select id, email from "user" where id = $1 limit 1',
      [id],
    );
    return result.rows[0] ?? null;
  }

  async findPage({
    first,
    after,
  }: {
    first: number;
    after?: string;
  }): Promise<UserConnection> {
    const afterId = decodeCursor(after);
    const result = await this.database.query<IdentityUser>(
      `select id, email from "user"
       where ($1::text is null or id > $1)
       order by id asc limit $2`,
      [afterId ?? null, first + 1],
    );
    const page = result.rows.slice(0, first);
    const last = page.at(-1);
    return {
      edges: page.map((node) => ({ cursor: encodeCursor(node.id), node })),
      pageInfo: {
        hasNextPage: result.rows.length > first,
        endCursor: last ? encodeCursor(last.id) : null,
      },
    };
  }
}
