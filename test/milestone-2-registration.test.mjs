import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  RegistrationIncompleteError,
  signUpUser,
} from '../apps/identity-subgraph/src/registration/sign-up-user.ts';

function identityStore({ canDelete = true } = {}) {
  const state = { accounts: ['email'], deleted: false, pending: false };
  return {
    state,
    async createEmailIdentity() {
      return { id: 'user-1' };
    },
    async linkAccount(_userId, account) {
      state.accounts.push(account.providerId);
    },
    async deleteIdentity() {
      state.deleted = canDelete;
      return canDelete;
    },
    async markPendingWordPressLink() {
      state.pending = true;
    },
  };
}

const input = {
  email: 'new@example.test',
  password: 'a-long-test-password',
  name: 'New User',
};

test('AC-028: Registration links email and WordPress accounts @spec:AC-028', async () => {
  const identity = identityStore();
  const result = await signUpUser(input, identity, {
    async createOrLink() {
      return { id: 'wp-10' };
    },
  });
  assert.deepEqual(result.accounts, ['email', 'wordpress']);
  assert.deepEqual(identity.state.accounts, ['email', 'wordpress']);
});

test('AC-029: A failed WordPress link leaves no usable partial account @spec:AC-029', async () => {
  for (const canDelete of [true, false]) {
    const identity = identityStore({ canDelete });
    await assert.rejects(
      signUpUser(input, identity, {
        async createOrLink() {
          throw new Error('WordPress unavailable');
        },
      }),
      RegistrationIncompleteError,
    );
    assert.equal(identity.state.deleted || identity.state.pending, true);
  }
});
