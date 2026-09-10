import {
  ConditionalCheckFailedException,
  type DynamoDBClient,
  type PutItemCommand,
} from '@aws-sdk/client-dynamodb';
import { describe, expect, it, vi } from 'vitest';

import { DynamoDpopReplayStore } from './dynamo-dpop-replay.store.ts';

function sharedClient() {
  const reservations = new Map<string, number>();
  const send = vi.fn(async (command: PutItemCommand) => {
    const key = command.input.Item?.key?.S;
    const expiresAt = Number(command.input.Item?.expiresAt?.N);
    const now = Number(command.input.ExpressionAttributeValues?.[':now']?.N);
    if (!key || !Number.isFinite(expiresAt) || !Number.isFinite(now)) {
      throw new Error('Invalid reservation command');
    }
    const previous = reservations.get(key);
    if (previous !== undefined && previous > now) {
      throw new ConditionalCheckFailedException({
        $metadata: {},
        message: 'Replay key already reserved',
      });
    }
    reservations.set(key, expiresAt);
    return {};
  });
  return { client: { send } as unknown as DynamoDBClient, reservations, send };
}

describe('DynamoDpopReplayStore', () => {
  it('AC-306: atomically accepts one shared reservation and rejects its replay @spec:AC-306', async () => {
    const { client, send } = sharedClient();
    const first = new DynamoDpopReplayStore('shared-replay-table', client);
    const second = new DynamoDpopReplayStore('shared-replay-table', client);
    const reservation = {
      key: 'proof-key',
      expiresAt: new Date('2030-01-01T00:05:00.000Z'),
      now: new Date('2030-01-01T00:00:00.000Z'),
    };

    const results = await Promise.all([
      first.reserve(reservation),
      second.reserve(reservation),
    ]);

    expect(results.sort()).toEqual([false, true]);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[0]?.[0].input).toMatchObject({
      TableName: 'shared-replay-table',
      ConditionExpression: 'attribute_not_exists(#key) OR #expiresAt <= :now',
      Item: {
        key: { S: reservation.key },
        expiresAt: { N: '1893456300' },
      },
      ExpressionAttributeValues: { ':now': { N: '1893456000' } },
    });
  });

  it('replaces an expired tombstone and preserves DynamoDB failures', async () => {
    const { client, reservations } = sharedClient();
    reservations.set('expired-key', 1_893_455_999);
    const store = new DynamoDpopReplayStore('shared-replay-table', client);

    await expect(
      store.reserve({
        key: 'expired-key',
        expiresAt: new Date('2030-01-01T00:05:00.001Z'),
        now: new Date('2030-01-01T00:00:00.999Z'),
      }),
    ).resolves.toBe(true);
    expect(reservations.get('expired-key')).toBe(1_893_456_301);

    const outage = new Error('DynamoDB unavailable');
    const failing = {
      send: vi.fn().mockRejectedValue(outage),
    } as unknown as DynamoDBClient;
    await expect(
      new DynamoDpopReplayStore('shared-replay-table', failing).reserve({
        key: 'proof-key',
        expiresAt: new Date('2030-01-01T00:05:00.000Z'),
        now: new Date('2030-01-01T00:00:00.000Z'),
      }),
    ).rejects.toBe(outage);
  });

  it('rejects an empty table name', () => {
    expect(() => new DynamoDpopReplayStore(' ')).toThrow(
      'DPoP replay table is required',
    );
  });
});
