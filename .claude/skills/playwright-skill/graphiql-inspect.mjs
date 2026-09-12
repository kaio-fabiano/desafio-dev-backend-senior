import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto('http://localhost:3000/graphql', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    const html = await page.locator('.graphiql-editor-tools').first().evaluate(el => el.outerHTML).catch(() => 'NOT FOUND graphiql-editor-tools');
    console.log(html.slice(0, 3000));
    console.log('---BUTTONS---');
    const buttons = await page.locator('button').all();
    for (const b of buttons) {
      const text = await b.innerText().catch(() => '');
      const title = await b.getAttribute('title').catch(() => '');
      console.log(JSON.stringify({ text, title }));
    }
  } finally {
    await browser.close();
  }
})();
