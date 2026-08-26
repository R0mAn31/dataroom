import { expect, test } from "@playwright/test";
import {
  createFolder,
  createRoom,
  dialogField,
  registerAndSignIn,
  tinyPdf,
  uploadFiles,
} from "./helpers";

test("upload, re-upload as a new version, rename conflict, move, and delete", async ({ page }) => {
  await registerAndSignIn(page);
  await createRoom(page, "Project Gemini");

  await uploadFiles(page, [{ name: "NDA.pdf", content: tinyPdf("v1") }]);
  await expect(page.getByRole("link", { name: /NDA\.pdf/ })).toBeVisible();

  // Same name again -> stacks as version 2, not a duplicate row.
  await uploadFiles(page, [{ name: "NDA.pdf", content: tinyPdf("v2") }]);
  await expect(page.getByRole("link", { name: /NDA\.pdf/ })).toHaveCount(1);
  await expect(
    page.getByRole("row", { name: /NDA\.pdf/ }).getByTitle("2 versions")
  ).toHaveText("v2");

  // Rename conflict: create a second file, try to rename it to "NDA.pdf".
  await uploadFiles(page, [{ name: "Teaser.pdf", content: tinyPdf("teaser") }]);
  await page
    .getByRole("row", { name: /Teaser\.pdf/ })
    .getByRole("button", { name: /Actions for/ })
    .click();
  await page.getByRole("menuitem", { name: "Rename" }).click();
  await dialogField(page, "Rename file").fill("NDA.pdf");
  await page.getByRole("button", { name: "Rename" }).click();
  await expect(page.getByText(/already exists/i)).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();

  // Move "Teaser.pdf" into a new folder.
  await createFolder(page, "Marketing");

  await page
    .getByRole("row", { name: /Teaser\.pdf/ })
    .getByRole("button", { name: /Actions for/ })
    .click();
  await page.getByRole("menuitem", { name: "Move" }).click();
  await page.getByRole("button", { name: "Marketing" }).click();
  await page.getByRole("button", { name: "Move here" }).click();
  await expect(page.getByText(/Moved/)).toBeVisible();
  await expect(page.getByRole("link", { name: /Teaser\.pdf/ })).toHaveCount(0);

  await page.getByRole("link", { name: "Marketing" }).click();
  await expect(page.getByRole("link", { name: /Teaser\.pdf/ })).toBeVisible();

  // Delete it.
  await page
    .getByRole("row", { name: /Teaser\.pdf/ })
    .getByRole("button", { name: /Actions for/ })
    .click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Delete file" }).click();
  await expect(page.getByRole("link", { name: /Teaser\.pdf/ })).toHaveCount(0);
});

test("opening a PDF shows an inline preview and a download link", async ({ page }) => {
  await registerAndSignIn(page);
  await createRoom(page, "Project Artemis");
  await uploadFiles(page, [{ name: "Overview.pdf", content: tinyPdf("overview") }]);

  await page.getByRole("link", { name: /Overview\.pdf/ }).click();
  await expect(page.locator('[aria-current="page"]')).toHaveText("Overview.pdf");
  await expect(page.locator("iframe")).toBeVisible();
  await expect(page.getByRole("link", { name: "Download" })).toBeVisible();
});
