import { chromium } from 'playwright';

const artifactDir = process.env.PW_ARTIFACT_DIR || '/tmp';

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--host-resolver-rules=MAP wordpress 127.0.0.1'],
  });
  try {
    const page = await browser.newPage();
    await page.goto('http://wordpress/wp-login.php');
    await page.locator('#user_login').fill('admin');
    await page.locator('#user_pass').fill('admin-local-only');
    await page.getByRole('button', { name: 'Log In' }).click();
    await page.waitForURL('**/wp-admin/**');
    console.log('Logged in as admin');

    await page.goto('http://wordpress/wp-admin/post-new.php?post_type=product');
    await page.locator('#title').fill('Playwright Test Product');
    await page.screenshot({ path: `${artifactDir}/wp-01-new-product-form.png`, fullPage: true });

    const regularPrice = page.locator('#_regular_price');
    await regularPrice.waitFor({ state: 'visible', timeout: 15000 });
    await regularPrice.fill('49.90');

    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    await page.waitForURL('**/post.php?post=*');
    const url = new URL(page.url());
    const productId = url.searchParams.get('post');
    console.log('PRODUCT_ID=' + productId);
    await page.screenshot({ path: `${artifactDir}/wp-02-product-published.png`, fullPage: true });
  } finally {
    await browser.close();
  }
})();
