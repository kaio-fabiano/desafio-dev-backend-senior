import { IdentityUser } from '../dto/identity-user.dto.ts';
import { IdentityUserQueryPort } from '../ports/identity-user-query.port.ts';

export class FindIdentityUsersUseCase {
  private readonly cache = new Map<string, Promise<IdentityUser | null>>();
  private queue: Array<{
    id: string;
    resolve: (user: IdentityUser | null) => void;
    reject: (reason: unknown) => void;
  }> = [];

  constructor(private readonly users: IdentityUserQueryPort) {}

  load(id: string): Promise<IdentityUser | null> {
    const cached = this.cache.get(id);
    if (cached) return cached;
    const result = new Promise<IdentityUser | null>((resolve, reject) => {
      this.queue.push({ id, resolve, reject });
      if (this.queue.length === 1) queueMicrotask(() => void this.flush());
    });
    this.cache.set(id, result);
    return result;
  }

  private async flush(): Promise<void> {
    const pending = this.queue;
    this.queue = [];
    try {
      const users = await this.users.findByIds(pending.map(({ id }) => id));
      const byId = new Map(users.map((user) => [user.id, user]));
      pending.forEach(({ id, resolve }) => resolve(byId.get(id) ?? null));
    } catch (error) {
      pending.forEach(({ reject }) => reject(error));
    }
  }
}
