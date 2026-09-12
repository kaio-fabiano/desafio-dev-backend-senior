import { chromium } from 'playwright';
import { setHeaders, setQuery } from './graphiql-lib.mjs';

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto('http://localhost:3000/graphql', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await setHeaders(page, { authorization: 'Bearer TEST123' });
    await setQuery(page, 'query me { me { id } }');
    await page.getByLabel('Add tab').click();
    await page.waitForTimeout(500);
    await page.locator('button[data-name="headers"]').click();
    const headersContent = await page.locator('.graphiql-editor-tool .graphiql-editor:not(.hidden) .CodeMirror').innerText();
    console.log('NEW TAB HEADERS CONTENT:', JSON.stringify(headersContent));
    const queryContent = await page.locator('.graphiql-query-editor .CodeMirror').innerText();
    console.log('NEW TAB QUERY CONTENT:', JSON.stringify(queryContent));
    console.log('TAB COUNT:', await page.locator('.graphiql-tabs .graphiql-tab').count());
  } finally {
    await browser.close();
  }
})();
