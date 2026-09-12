import { chromium } from 'playwright';
import { setHeaders, setQuery, setVariables, execute, getResponseText, addTab } from './graphiql-lib.mjs';

const token = process.env.BUYER_TOKEN;
const SUBSCRIPTION = 'subscription orderEvents($operationKey: ID!) { orderEvents(operationKey: $operationKey) { operationKey orderId state pixCode eventTime } }';

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto('http://localhost:3000/graphql', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);

    await setHeaders(page, { authorization: `Bearer ${token}` });
    await setQuery(page, SUBSCRIPTION);
    await setVariables(page, { operationKey: 'zzz-unused' });
    await execute(page);
    await page.waitForTimeout(1000);
    console.log('tab1 execute button aria-label after click:', await page.locator('.graphiql-execute-button').getAttribute('aria-label'));

    await addTab(page);
    await page.waitForTimeout(400);
    await setHeaders(page, { authorization: `Bearer ${token}` });
    await setQuery(page, 'query me { me { id email } }');
    console.log('tab2 exec button count:', await page.locator('.graphiql-execute-button').count());
    await execute(page);
    await page.waitForTimeout(2000);
    console.log('RESULT:', JSON.stringify(await getResponseText(page)));
  } finally {
    await browser.close();
  }
})();
