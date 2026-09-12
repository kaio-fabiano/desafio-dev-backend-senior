import { chromium } from 'playwright';
import { setHeaders, setVariables, setQuery, execute, getResponseText, addTab } from './graphiql-lib.mjs';

const artifactDir = process.env.PW_ARTIFACT_DIR || '/tmp';
const token = process.env.BUYER_TOKEN;
const cardToken = process.env.CARD_TOKEN;
const operationKey = 'pw-buyer-card-1';

const SUBSCRIPTION = 'subscription orderEvents($operationKey: ID!) { orderEvents(operationKey: $operationKey) { operationKey orderId state pixCode eventTime } }';
const CHECKOUT = 'mutation startCheckout($input: OrderWorkflowCheckoutInput!) { startCheckout(input: $input) { id operationKey status orderId paymentId errorReason } }';

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto('http://localhost:3000/graphql', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);

    // Tab 1: subscribe to order events for our operation key
    await setHeaders(page, { authorization: `Bearer ${token}` });
    await setQuery(page, SUBSCRIPTION);
    await setVariables(page, { operationKey });
    await execute(page);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${artifactDir}/flow-03-subscription-listening.png`, fullPage: true });
    console.log('SUBSCRIPTION_INITIAL:', await getResponseText(page));

    // Tab 2: fire the CARD checkout mutation using the real Mercado Pago test card token
    await addTab(page);
    await page.waitForTimeout(400);
    await setHeaders(page, { authorization: `Bearer ${token}` });
    await setQuery(page, CHECKOUT);
    await setVariables(page, {
      input: {
        operationKey,
        paymentMethod: 'CARD',
        payerEmail: 'playwright-buyer@example.test',
        providerToken: cardToken,
        paymentMethodId: 'visa',
      },
    });
    await execute(page);
    await page.waitForTimeout(3000);
    console.log('CHECKOUT_RESULT:', await getResponseText(page));
    await page.screenshot({ path: `${artifactDir}/flow-04-checkout-card-mutation.png`, fullPage: true });

    // Back to Tab 1 to read the streamed subscription event
    await page.locator('.graphiql-tabs .graphiql-tab').nth(0).click();
    await page.waitForTimeout(2000);
    console.log('SUBSCRIPTION_EVENT:', await getResponseText(page));
    await page.screenshot({ path: `${artifactDir}/flow-05-subscription-event.png`, fullPage: true });
  } finally {
    await browser.close();
  }
})();
