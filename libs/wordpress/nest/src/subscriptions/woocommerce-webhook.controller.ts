import { createHmac, timingSafeEqual } from 'node:crypto';

import {
  Body,
  Controller,
  Headers,
  Inject,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

import { WordPressCheckoutEventSource } from './wordpress-checkout-event.source.ts';

type RawRequest = Request & { rawBody?: Buffer };

export class WooCommerceWebhookController {
  constructor(private readonly events: WordPressCheckoutEventSource) {}

  receive(
    signature: string | undefined,
    payload: unknown,
    request: RawRequest,
  ): void {
    const secret = process.env.WOO_WEBHOOK_SECRET?.trim() ?? '';
    const rawBody = request.rawBody;
    if (!secret || !rawBody || !validSignature(rawBody, signature, secret)) {
      throw new UnauthorizedException('Invalid WooCommerce webhook signature');
    }
    this.events.ingest(payload);
  }
}

Inject(WordPressCheckoutEventSource)(
  WooCommerceWebhookController,
  undefined,
  0,
);
Controller('webhooks/woocommerce')(WooCommerceWebhookController);
Post('orders')(
  WooCommerceWebhookController.prototype,
  'receive',
  Object.getOwnPropertyDescriptor(
    WooCommerceWebhookController.prototype,
    'receive',
  )!,
);
Headers('x-wc-webhook-signature')(
  WooCommerceWebhookController.prototype,
  'receive',
  0,
);
Body()(WooCommerceWebhookController.prototype, 'receive', 1);
Req()(WooCommerceWebhookController.prototype, 'receive', 2);

function validSignature(
  body: Buffer,
  signature: string | undefined,
  secret: string,
): boolean {
  if (!signature) return false;
  const actual = Buffer.from(signature, 'base64');
  const expected = createHmac('sha256', secret).update(body).digest();
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
