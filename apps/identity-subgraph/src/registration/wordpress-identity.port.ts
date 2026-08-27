export type WordPressIdentityPort = {
  createOrLink(input: { email: string; name: string }): Promise<{ id: string }>;
};
