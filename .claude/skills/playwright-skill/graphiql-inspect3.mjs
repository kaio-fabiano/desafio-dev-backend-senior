import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto('http://localhost:3000/graphql', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    const info = await page.evaluate(() => {
      const cms = Array.from(document.querySelectorAll('.CodeMirror'));
      return cms.map((cm, i) => {
        let el = cm;
        const chain = [];
        for (let d = 0; d < 5 && el; d++) {
          chain.push(el.className);
          el = el.parentElement;
        }
        return { i, chain };
      });
    });
    console.log(JSON.stringify(info, null, 2));
  } finally {
    await browser.close();
  }
})();
