export type IdentityUser = { id: string; email: string };
export type UserConnection = { edges: Array<{ cursor: string; node: IdentityUser }>; pageInfo: { hasNextPage: boolean; hasPreviousPage: boolean; startCursor: string | null; endCursor: string | null; }; };
