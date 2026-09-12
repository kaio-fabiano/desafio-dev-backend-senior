import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto('http://localhost:3000/graphql', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    const buttons = await page.locator('button').all();
    for (const b of buttons) {
      const aria = await b.getAttribute('aria-label').catch(() => null);
      const cls = await b.getAttribute('class').catch(() => null);
      if (aria) console.log(JSON.stringify({ aria, cls }));
    }
    console.log('---CM editors---');
    const cms = await page.locator('.CodeMirror').all();
    console.log('count', cms.length);
    for (let i = 0; i < cms.length; i++) {
      const cls = await cms[i].evaluate(el => el.closest('[class*="graphiql"]')?.className || 'no-parent');
      console.log(i, cls);
    }
    console.log('---response panel candidates---');
    const respSelectors = ['.graphiql-response', '.result-window', '.graphiql-response-content'];
    for (const sel of respSelectors) {
      console.log(sel, await page.locator(sel).count());
    }
  } finally {
    await browser.close();
  }
})();
