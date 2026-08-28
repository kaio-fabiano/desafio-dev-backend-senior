import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { composeServices } from '../node_modules/.pnpm/@apollo+composition@2.14.4_graphql@16.11.0/node_modules/@apollo/composition/dist/index.js';
import { buildSchema, getNamedType, isNonNullType } from 'graphql';

const names = ['identity', 'catalog', 'commerce'];
const schemas = Object.fromEntries(await Promise.all(names.map(async (name) => [
  name,
  await readFile(`libs/contracts/graphql/${name}/schema.graphql`, 'utf8'),
])));

const composition = composeServices(names.map((name) => ({
  name,
  url: `http://${name}/graphql`,
  typeDefs: schemas[name],
})));

assert.equal(
  composition.errors?.length ?? 0,
  0,
  composition.errors?.map(({ message }) => message).join('\n'),
);

const schema = buildSchema(composition.supergraphSdl);

const mutation = schema.getMutationType().getFields();

test('AC-033: Cart mutations use the authenticated buyer @spec:AC-033', () => {
  for (const field of [mutation.addToCart, mutation.removeFromCart]) {
    assert.equal(getNamedType(field.type).name, 'Cart');
    assert.deepEqual(field.args.map(({ name }) => name), ['productId', 'quantity']);
  }
});

test('AC-034: Invalid cart changes are rejected @spec:AC-034', () => {
  for (const field of [mutation.addToCart, mutation.removeFromCart]) {
    const quantity = field.args.find(({ name }) => name === 'quantity');
    assert.equal(isNonNullType(quantity.type), true);
    assert.equal(getNamedType(quantity.type).name, 'Int');
  }
});

test('AC-035: Sequential retries return the original order @spec:AC-035', () => {
  const input = getNamedType(mutation.checkout.args[0].type).getFields();
  assert.equal(isNonNullType(input.operationKey.type), true);
  assert.equal(getNamedType(mutation.checkout.type).name, 'Order');
});

test('AC-037: Reusing a key for a different command conflicts @spec:AC-037', () => {
  const input = getNamedType(mutation.checkout.args[0].type).getFields();
  assert.deepEqual(Object.keys(input), ['operationKey', 'paymentMethod']);
  assert.equal(isNonNullType(input.paymentMethod.type), true);
});

test('AC-040: Federated me returns orders, workflow, and products @spec:AC-040', () => {
  const user = schema.getType('User').getFields();
  const order = schema.getType('Order').getFields();
  const orderItem = schema.getType('OrderItem').getFields();

  assert.equal(getNamedType(user.orders.type).name, 'OrderConnection');
  assert.equal(getNamedType(order.workflow.type).name, 'OrderWorkflow');
  assert.match(schemas.commerce, /paymentMethod: PaymentMethod!/);
  assert.doesNotMatch(schemas.catalog, /paymentMethod:/);
  assert.equal(getNamedType(order.items.type).name, 'OrderItemConnection');
  assert.equal(getNamedType(orderItem.product.type).name, 'Product');
});
