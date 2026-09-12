import { chromium } from 'playwright';
import { setHeaders, setVariables, setQuery, execute, getResponseText } from './graphiql-lib.mjs';

const artifactDir = process.env.PW_ARTIFACT_DIR || '/tmp';
const token = process.env.BUYER_TOKEN;

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto('http://localhost:3000/graphql', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);

    await setHeaders(page, { authorization: `Bearer ${token}` });
    await setQuery(page, 'mutation addToCart($productId: Int!, $quantity: Int!) { addToCart(input: { productId: $productId, quantity: $quantity }) { cart { contents { nodes { key quantity product { node { databaseId name } } } } } } }');
    await setVariables(page, { productId: 1066, quantity: 1 });
    await execute(page);
    await page.waitForTimeout(1500);
    console.log('ADD_TO_CART:', await getResponseText(page));
    await page.screenshot({ path: `${artifactDir}/flow-01-add-to-cart.png`, fullPage: true });

    await setQuery(page, 'query cart { cart { contents { nodes { key quantity product { node { databaseId name } } } } } }');
    await setVariables(page, {});
    await execute(page);
    await page.waitForTimeout(1500);
    console.log('CART:', await getResponseText(page));
    await page.screenshot({ path: `${artifactDir}/flow-02-cart-query.png`, fullPage: true });

    await page.context().storageState({ path: `${artifactDir}/storage-state.json` });
  } finally {
    await browser.close();
  }
})();
