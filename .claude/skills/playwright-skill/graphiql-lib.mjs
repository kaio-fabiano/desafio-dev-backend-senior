async function typeInto(page, locator, text) {
  await locator.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText(text);
}

export async function setHeaders(page, headersObj) {
  await page.locator('button[data-name="headers"]').click();
  const editor = page.locator('.graphiql-editor-tool .graphiql-editor:not(.hidden) .CodeMirror');
  await typeInto(page, editor, JSON.stringify(headersObj, null, 2));
}

export async function setVariables(page, varsObj) {
  await page.locator('button[data-name="variables"]').click();
  const editor = page.locator('.graphiql-editor-tool .graphiql-editor:not(.hidden) .CodeMirror');
  await typeInto(page, editor, JSON.stringify(varsObj, null, 2));
}

export async function setQuery(page, queryText) {
  const editor = page.locator('.graphiql-query-editor .CodeMirror');
  await typeInto(page, editor, queryText);
}

export async function execute(page) {
  await page.locator('.graphiql-execute-button').click();
}

export async function stop(page) {
  await page.locator('.graphiql-execute-button').click();
}

export async function getResponseText(page) {
  await page.waitForTimeout(300);
  return page.locator('.graphiql-response').innerText();
}

export async function addTab(page) {
  await page.getByLabel('Add tab').click();
}

export async function selectTab(page, index) {
  await page.locator('.graphiql-tabs .graphiql-tab').nth(index).click();
}
