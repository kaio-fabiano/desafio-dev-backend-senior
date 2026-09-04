import { Inject, Injectable, Scope } from '@nestjs/common';
import { AuthService } from '@thallesp/nestjs-better-auth';

import type { IdentityAuth } from '../auth/better-auth.factory.ts';
import type { IdentityUser } from './identity.resolver.ts';

type PendingLoad = {
  id: string;
  resolve: (user: IdentityUser | null) => void;
  reject: (reason: unknown) => void;
};

export class UserLoader {
  private readonly cache = new Map<string, Promise<IdentityUser | null>>();
  private queue: PendingLoad[] = [];

  constructor(private readonly auth: AuthService<IdentityAuth>) {}

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
      const users = await (
        await this.auth.instance.$context
      ).adapter.findMany<IdentityUser>({
        model: 'user',
        where: [{ field: 'id', operator: 'in', value: ids }],
        limit: ids.length,
        select: ['id', 'email'],
      });
      const byId = new Map(users.map((user) => [user.id, user]));
      pending.forEach(({ id, resolve }) => resolve(byId.get(id) ?? null));
    } catch (error) {
      pending.forEach(({ reject }) => reject(error));
    }
  }
}

Injectable({ scope: Scope.REQUEST })(UserLoader);
Inject(AuthService)(UserLoader, undefined, 0);
