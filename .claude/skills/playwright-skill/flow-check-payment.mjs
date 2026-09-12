import { chromium } from 'playwright';
import { setHeaders, setVariables, setQuery, execute, getResponseText } from './graphiql-lib.mjs';

const artifactDir = process.env.PW_ARTIFACT_DIR || '/tmp';
const token = process.env.BUYER_TOKEN;
const paymentId = process.env.PAYMENT_ID;

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto('http://localhost:3000/graphql', { waitUntil: 'networkidle' });
    await page.waitForTimeout(700);
    await setHeaders(page, { authorization: `Bearer ${token}` });
    await setQuery(page, 'query payment($id: ID!) { payment(id: $id) { id status providerReference pixCode } }');
    await setVariables(page, { id: paymentId });
    for (let i = 0; i < 10; i++) {
      await execute(page);
      await page.waitForTimeout(1500);
      const text = await getResponseText(page);
      console.log(`POLL_${i}:`, text);
      if (/REFUNDED/.test(text)) break;
    }
    await page.screenshot({ path: `${artifactDir}/refund-03-payment-status.png`, fullPage: true });
  } finally {
    await browser.close();
  }
})();
