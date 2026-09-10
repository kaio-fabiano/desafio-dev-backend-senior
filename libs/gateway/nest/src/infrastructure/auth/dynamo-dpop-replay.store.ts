import {
  ConditionalCheckFailedException,
  DynamoDBClient,
  PutItemCommand,
} from '@aws-sdk/client-dynamodb';
import type {
  DpopReplayReservation,
  DpopReplayStore,
} from 'better-auth/oauth2';

export class DynamoDpopReplayStore implements DpopReplayStore {
  constructor(
    private readonly tableName: string,
    private readonly client: Pick<DynamoDBClient, 'send'> = new DynamoDBClient(
      {},
    ),
  ) {}

  async reserve({
    key,
    expiresAt,
    now,
  }: DpopReplayReservation): Promise<boolean> {
    try {
      await this.client.send(
        new PutItemCommand({
          TableName: this.tableName,
          Item: {
            replayKey: { S: key },
            expiresAt: {
              N: String(Math.ceil(expiresAt.getTime() / 1_000)),
            },
          },
          ConditionExpression:
            'attribute_not_exists(#replayKey) OR #expiresAt < :now',
          ExpressionAttributeNames: {
            '#replayKey': 'replayKey',
            '#expiresAt': 'expiresAt',
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
