import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--host-resolver-rules=MAP wordpress 127.0.0.1'],
  });
  try {
    const page = await browser.newPage();
    page.on('requestfailed', (req) => console.log('REQFAIL', req.url(), req.failure()?.errorText));
    page.on('response', (res) => console.log('RESP', res.status(), res.url()));
    await page.goto('http://wordpress/wp-login.php');
    await page.locator('#user_login').fill('admin');
    await page.locator('#user_pass').fill('admin-local-only');
    await Promise.all([
      page.waitForNavigation({ timeout: 15000 }).catch((e) => console.log('NAV ERROR', e.message)),
      page.getByRole('button', { name: 'Log In' }).click(),
    ]);
    console.log('CURRENT URL', page.url());
  } finally {
    await browser.close();
  }
})();
