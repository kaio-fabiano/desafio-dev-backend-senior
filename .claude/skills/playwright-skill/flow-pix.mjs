import { chromium } from 'playwright';
import { setHeaders, setVariables, setQuery, execute, getResponseText } from './graphiql-lib.mjs';

const artifactDir = process.env.PW_ARTIFACT_DIR || '/tmp';
const token = process.env.BUYER_TOKEN;
const productId = Number(process.env.PRODUCT_ID || 1066);
const operationKey = process.env.OPERATION_KEY || 'pw-buyer-pix-checkout';
const payerEmail = process.env.MP_PAYER_EMAIL;

const ADD_TO_CART = 'mutation addToCart($productId: Int!, $quantity: Int!) { addToCart(input: { productId: $productId, quantity: $quantity }) { cart { contents { nodes { key quantity product { node { databaseId name } } } } } } }';
const SUBSCRIPTION = 'subscription orderEvents($operationKey: ID!) { orderEvents(operationKey: $operationKey) { operationKey orderId state pixCode eventTime } }';
const CHECKOUT = 'mutation startCheckout($input: OrderWorkflowCheckoutInput!) { startCheckout(input: $input) { id operationKey status orderId paymentId errorReason } }';

async function newGraphiqlPage(context) {
  const page = await context.newPage();
  await page.goto('http://localhost:3000/graphql', { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  return page;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();

    const page1 = await newGraphiqlPage(context);
    let sessionHeaders = {};
    page1.on('response', (res) => {
      if (res.url().endsWith('/graphql') && res.request().method() === 'POST') {
        const h = res.headers();
        if (h['woocommerce-session']) {
          sessionHeaders['woocommerce-session'] = h['woocommerce-session'].startsWith('Session ')
            ? h['woocommerce-session'] : `Session ${h['woocommerce-session']}`;
        }
        if (h['cart-token']) sessionHeaders['cart-token'] = h['cart-token'];
      }
    });
    await setHeaders(page1, { authorization: `Bearer ${token}` });
    await setQuery(page1, ADD_TO_CART);
    await setVariables(page1, { productId, quantity: 1 });
    await execute(page1);
    await page1.waitForTimeout(1500);
    console.log('ADD_TO_CART:', await getResponseText(page1));
    await page1.screenshot({ path: `${artifactDir}/pix-01-add-to-cart.png`, fullPage: true });
    await page1.close();

    const page2 = await newGraphiqlPage(context);
    await setHeaders(page2, { authorization: `Bearer ${token}`, ...sessionHeaders });
    await setQuery(page2, SUBSCRIPTION);
    await setVariables(page2, { operationKey });
    await execute(page2);
    await page2.waitForTimeout(1200);
    await page2.screenshot({ path: `${artifactDir}/pix-02-subscription-listening.png`, fullPage: true });

    const page3 = await newGraphiqlPage(context);
    await setHeaders(page3, { authorization: `Bearer ${token}`, ...sessionHeaders });
    await setQuery(page3, CHECKOUT);
    await setVariables(page3, {
      input: { operationKey, paymentMethod: 'PIX', payerEmail },
    });
    await execute(page3);
    await page3.waitForTimeout(5000);
    console.log('CHECKOUT_RESULT:', await getResponseText(page3));
    await page3.screenshot({ path: `${artifactDir}/pix-03-checkout-mutation.png`, fullPage: true });

    for (let i = 0; i < 8; i++) {
      await page2.waitForTimeout(1500);
      const text = await getResponseText(page2);
      console.log(`SUBSCRIPTION_POLL_${i}:`, text);
      if (/PIX_GENERATED|COMPLETED|CANCELLED/.test(text)) break;
    }
    await page2.screenshot({ path: `${artifactDir}/pix-04-subscription-event.png`, fullPage: true });
  } finally {
    await browser.close();
  }
})();
