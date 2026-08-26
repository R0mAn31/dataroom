import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

let counter = 0;

/** A distinct email per call so parallel-ish test data never collides. */
export function uniqueEmail(label: string) {
  counter += 1;
  return `${label}-${Date.now()}-${counter}@e2e.test`;
}

/** Minimal but valid single-page PDF — small enough to inline as a buffer. */
export function tinyPdf(label: string): Buffer {
  const contents = `BT /F1 24 Tf 72 700 Td (${label.replace(/[()\\]/g, "")}) Tj ET`;
  const objects: string[] = [
    "<</Type/Catalog/Pages 2 0 R>>",
    "<</Type/Pages/Kids[3 0 R]/Count 1>>",
    "<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>",
    `<</Length ${contents.length}>>stream\n${contents}\nendstream`,
    "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
  ];
  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((obj, i) => {
    offsets[i + 1] = body.length;
    body += `${i + 1} 0 obj${obj}endobj\n`;
  });
  const xrefPos = body.length;
  let xref = "xref\n0 6\n0000000000 65535 f \n";
  for (let i = 1; i <= 5; i++) xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  body += `${xref}trailer<</Size 6/Root 1 0 R>>\nstartxref\n${xrefPos}\n%%EOF`;
  return Buffer.from(body, "latin1");
}

export async function registerAndSignIn(
  page: Page,
  opts: { name?: string; email?: string; password?: string } = {}
) {
  const email = opts.email ?? uniqueEmail("owner");
  const password = opts.password ?? "password123";
  const name = opts.name ?? "E2E Owner";

  await page.goto("/register");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/rooms$/);

  return { email, password, name };
}

export async function signOut(page: Page, userText: string) {
  await page.getByText(userText).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
}

/**
 * NameDialog is reused for "New room"/"Rename folder"/etc, and dialogs from a
 * just-submitted action can still be mid-exit-animation when the next one
 * opens — scoping by the dialog's own title (not just a global "Name" label)
 * keeps these interactions unambiguous regardless of that overlap.
 */
export function dialogField(page: Page, dialogTitle: string, label = "Name") {
  return page.getByRole("dialog", { name: dialogTitle }).getByLabel(label);
}

export async function createRoom(page: Page, name: string) {
  await page.getByRole("button", { name: "New room" }).click();
  await dialogField(page, "New data room").fill(name);
  await page.getByRole("button", { name: "Create room" }).click();
  await expect(page).toHaveURL(/\/rooms\/[^/]+$/);
  await expect(page.locator('[aria-current="page"]')).toHaveText(name);
}

export async function createFolder(page: Page, name: string) {
  await page.getByRole("button", { name: "New folder" }).click();
  await dialogField(page, "New folder").fill(name);
  await page.getByRole("button", { name: "Create folder" }).click();
}

export async function uploadFiles(page: Page, files: { name: string; content: Buffer }[]) {
  const fileChooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Upload files" }).click();
  const chooser = await fileChooserPromise;
  await chooser.setFiles(
    files.map((f) => ({ name: f.name, mimeType: "application/pdf", buffer: f.content }))
  );
  await expect(page.getByText("Uploads finished")).toBeVisible({ timeout: 15_000 });
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function rowActionsButton(page: Page, name: string) {
  return page
    .getByRole("row", { name: new RegExp(escapeRegExp(name)) })
    .getByRole("button", { name: /Actions for/ });
}
