import {
  ConditionalCheckFailedException,
  DynamoDBClient,
  PutItemCommand,
} from '@aws-sdk/client-dynamodb';
import type { DpopReplayStore } from 'better-auth/oauth2';

export class DynamoDpopReplayStore implements DpopReplayStore {
  constructor(
    private readonly tableName: string,
    private readonly client = new DynamoDBClient({}),
  ) {
    if (!tableName.trim()) throw new Error('DPoP replay table is required');
  }

  async reserve({
    key,
    expiresAt,
    now,
  }: Parameters<DpopReplayStore['reserve']>[0]) {
    try {
      await this.client.send(
        new PutItemCommand({
          TableName: this.tableName,
          Item: {
            key: { S: key },
            expiresAt: {
              N: String(Math.ceil(expiresAt.getTime() / 1_000)),
            },
          },
          ConditionExpression:
            'attribute_not_exists(#key) OR #expiresAt <= :now',
          ExpressionAttributeNames: {
            '#expiresAt': 'expiresAt',
            '#key': 'key',
          },
          ExpressionAttributeValues: {
            ':now': { N: String(Math.floor(now.getTime() / 1_000)) },
          },
        }),
      );
      return true;
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) return false;
      throw error;
    }
  }
}
