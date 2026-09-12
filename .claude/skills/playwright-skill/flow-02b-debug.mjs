import { chromium } from 'playwright';
import { setHeaders, setVariables, setQuery, execute, getResponseText, addTab } from './graphiql-lib.mjs';

const token = process.env.BUYER_TOKEN;
const cardToken = process.env.CARD_TOKEN;
const operationKey = 'pw-buyer-card-2';

const SUBSCRIPTION = 'subscription orderEvents($operationKey: ID!) { orderEvents(operationKey: $operationKey) { operationKey orderId state pixCode eventTime } }';
const CHECKOUT = 'mutation startCheckout($input: OrderWorkflowCheckoutInput!) { startCheckout(input: $input) { id operationKey status orderId paymentId errorReason } }';

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    page.on('console', (msg) => console.log('CONSOLE', msg.type(), msg.text()));
    page.on('pageerror', (err) => console.log('PAGEERROR', err.message));
    page.on('requestfinished', (req) => { if (req.url().includes('/graphql')) console.log('REQ', req.method(), req.url()); });
    await page.goto('http://localhost:3000/graphql', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);

    await setHeaders(page, { authorization: `Bearer ${token}` });
    await setQuery(page, SUBSCRIPTION);
    await setVariables(page, { operationKey });
    await execute(page);
    await page.waitForTimeout(1000);

    await addTab(page);
    await page.waitForTimeout(400);
    await setHeaders(page, { authorization: `Bearer ${token}` });
    await setQuery(page, CHECKOUT);
    await setVariables(page, {
      input: { operationKey, paymentMethod: 'CARD', payerEmail: 'playwright-buyer@example.test', providerToken: cardToken, paymentMethodId: 'visa' },
    });
    console.log('about to execute checkout tab');
    await execute(page);
    console.log('clicked execute, waiting...');
    await page.waitForTimeout(6000);
    console.log('CHECKOUT_RESULT:', JSON.stringify(await getResponseText(page)));
  } finally {
    await browser.close();
  }
})();
