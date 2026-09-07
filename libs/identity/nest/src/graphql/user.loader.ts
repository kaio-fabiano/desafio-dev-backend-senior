import { Inject, Injectable, Scope } from '@nestjs/common';

import type { IdentityUser } from './identity-user.types.d.ts';
import type { PendingLoad } from './pending-load.types.d.ts';
import { IdentityUserRepository } from './user.repository.ts';

@Injectable({ scope: Scope.REQUEST })
export class UserLoader {
  private readonly cache = new Map<string, Promise<IdentityUser | null>>();
  private queue: PendingLoad[] = [];

  constructor(
    @Inject(IdentityUserRepository)
    private readonly users: IdentityUserRepository,
  ) {}

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

  private async flush() {
    const pending = this.queue;
    this.queue = [];
    const ids = pending.map(({ id }) => id);

    try {
      const users = await this.users.findByIds(ids);
      const byId = new Map(users.map((user) => [user.id, user]));
      pending.forEach(({ id, resolve }) => resolve(byId.get(id) ?? null));
    } catch (error) {
      pending.forEach(({ reject }) => reject(error));
    }
  }
}
