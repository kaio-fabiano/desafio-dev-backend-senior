import { Inject, Injectable } from '@nestjs/common';
import type { AuthHookContext } from '@thallesp/nestjs-better-auth';

import { WordPressIdentityService } from '../wordpress/wordpress-identity.service.ts';
import type { CompensationFailure } from './registration.error.ts';

export type RegistrationIdentityAdapter = Pick<
  AuthHookContext['context']['internalAdapter'],
  'deleteAccounts' | 'deleteUser' | 'deleteUserSessions'
>;

@Injectable()
export class RegistrationCompensationService {
  constructor(
    @Inject(WordPressIdentityService)
    private readonly wordpress: Pick<
      WordPressIdentityService,
      'deleteCustomer'
    >,
  ) {}

  async compensate(
    identity: RegistrationIdentityAdapter,
    userId: string,
    wordpressUserId?: string,
  ): Promise<CompensationFailure[]> {
    const steps: Array<{
      run: () => Promise<unknown>;
      step: CompensationFailure['step'];
    }> = [
      ...(wordpressUserId
        ? [
            {
              run: () => this.wordpress.deleteCustomer(wordpressUserId),
              step: 'wordpress' as const,
            },
          ]
        : []),
      { run: () => identity.deleteUserSessions(userId), step: 'sessions' },
      { run: () => identity.deleteAccounts(userId), step: 'accounts' },
      { run: () => identity.deleteUser(userId), step: 'user' },
    ];
    const failures: CompensationFailure[] = [];
    for (const { run, step } of steps) {
      try {
        await run();
      } catch (cause) {
        failures.push({ cause, step });
      }
    }
    return failures;
  }
}
