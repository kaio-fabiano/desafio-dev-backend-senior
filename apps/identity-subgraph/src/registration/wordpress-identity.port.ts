export type WordPressIdentityPort = {
  createOrLink(input: {
    email: string;
    name: string;
    password: string;
  }): Promise<{ id: string }>;
};
