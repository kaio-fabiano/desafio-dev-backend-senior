import { chromium } from 'playwright';
import { setHeaders, setQuery, execute, getResponseText, addTab } from './graphiql-lib.mjs';

const token = process.env.BUYER_TOKEN;

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    page.on('console', (msg) => console.log('CONSOLE', msg.type(), msg.text()));
    page.on('pageerror', (err) => console.log('PAGEERROR', err.message));
    await page.goto('http://localhost:3000/graphql', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);

    await addTab(page);
    await page.waitForTimeout(400);
    console.log('exec buttons count:', await page.locator('.graphiql-execute-button').count());
    await setHeaders(page, { authorization: `Bearer ${token}` });
    await setQuery(page, 'query me { me { id email } }');
    await execute(page);
    await page.waitForTimeout(1500);
    console.log('RESULT:', JSON.stringify(await getResponseText(page)));
  } finally {
    await browser.close();
  }
})();
