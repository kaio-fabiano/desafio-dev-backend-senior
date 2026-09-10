import {
  ConditionalCheckFailedException,
  type DynamoDBClient,
  type PutItemCommand,
} from '@aws-sdk/client-dynamodb';
import { describe, expect, it, vi } from 'vitest';

import { DynamoDpopReplayStore } from './dynamo-dpop-replay.store.ts';

describe('DynamoDpopReplayStore', () => {
  it('atomically accepts one reservation across verifier instances and stores its expiry @spec:AC-309', async () => {
    let reserved = false;
    const send = vi.fn(async (command: PutItemCommand) => {
      await Promise.resolve();
      if (reserved) {
        throw new ConditionalCheckFailedException({
          $metadata: {},
          message: 'duplicate',
        });
      }
      reserved = true;
      return { command };
    });
    const client = { send } as unknown as DynamoDBClient;
    const first = new DynamoDpopReplayStore('replay-table', client);
    const second = new DynamoDpopReplayStore('replay-table', client);
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
    const command = send.mock.calls[0]?.[0];
    expect(command?.input).toEqual({
      ConditionExpression:
        'attribute_not_exists(#replayKey) OR #expiresAt < :now',
      ExpressionAttributeNames: {
        '#expiresAt': 'expiresAt',
        '#replayKey': 'replayKey',
      },
      ExpressionAttributeValues: {
        ':now': { N: '1893456000' },
      },
      Item: {
        expiresAt: { N: '1893456300' },
        replayKey: { S: 'proof-key' },
      },
      TableName: 'replay-table',
    });
  });

  it('fails closed when DynamoDB cannot reserve the proof', async () => {
    const unavailable = new Error('DynamoDB unavailable');
    const client = {
      send: vi.fn().mockRejectedValue(unavailable),
    } as unknown as DynamoDBClient;

    await expect(
      new DynamoDpopReplayStore('replay-table', client).reserve({
        key: 'proof-key',
        expiresAt: new Date('2030-01-01T00:05:00.000Z'),
        now: new Date('2030-01-01T00:00:00.000Z'),
      }),
    ).rejects.toBe(unavailable);
  });
});
