import { chromium } from 'playwright';
import { setHeaders, setQuery, execute, getResponseText } from './graphiql-lib.mjs';

const artifactDir = process.env.PW_ARTIFACT_DIR || '/tmp';
const token = process.env.BUYER_TOKEN;

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto('http://localhost:3000/graphql', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    await setHeaders(page, { authorization: `Bearer ${token}` });
    await page.screenshot({ path: `${artifactDir}/gql-01-headers.png`, fullPage: true });

    await setQuery(page, 'query me { me { id email } }');
    await page.screenshot({ path: `${artifactDir}/gql-02-query.png`, fullPage: true });

    await execute(page);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${artifactDir}/gql-03-result.png`, fullPage: true });
    console.log('RESPONSE:', await getResponseText(page));
  } finally {
    await browser.close();
  }
})();
