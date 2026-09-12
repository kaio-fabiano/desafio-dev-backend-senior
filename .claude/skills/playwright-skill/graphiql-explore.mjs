import { chromium } from 'playwright';

const artifactDir = process.env.PW_ARTIFACT_DIR || '/tmp';

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto('http://localhost:3000/graphql', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${artifactDir}/gql-00-loaded.png`, fullPage: true });
    console.log(await page.title());
  } finally {
    await browser.close();
  }
})();
