import { expect, test } from "@playwright/test";
import { createFolder, createRoom, dialogField, registerAndSignIn } from "./helpers";

test("create a room, nest a folder, rename it, and navigate breadcrumbs", async ({ page }) => {
  await registerAndSignIn(page);
  await createRoom(page, "Project Neptune");

  await createFolder(page, "Financials");
  await expect(page.getByRole("link", { name: "Financials" })).toBeVisible();

  await page.getByRole("link", { name: "Financials" }).click();
  await expect(page.locator('[aria-current="page"]')).toHaveText("Financials");

  await createFolder(page, "2024 audit");
  await page.getByRole("link", { name: "2024 audit" }).click();
  await expect(page.locator('[aria-current="page"]')).toHaveText("2024 audit");

  // Breadcrumb takes us back up without losing the room.
  await page.getByRole("link", { name: "Financials" }).click();
  await expect(page.locator('[aria-current="page"]')).toHaveText("Financials");
  await expect(page.getByRole("link", { name: "2024 audit" })).toBeVisible();

  // Rename via the row menu.
  await page.getByRole("row", { name: /2024 audit/ }).getByRole("button", { name: /Actions for/ }).click();
  await page.getByRole("menuitem", { name: "Rename" }).click();
  await dialogField(page, "Rename folder").fill("2024 statements");
  await page.getByRole("button", { name: "Rename" }).click();
  await expect(page.getByRole("link", { name: "2024 statements" })).toBeVisible();
  await expect(page.getByRole("link", { name: "2024 audit", exact: true })).toHaveCount(0);
});

test("creating two folders with the same name auto-suffixes the second", async ({ page }) => {
  await registerAndSignIn(page);
  await createRoom(page, "Project Mercury");

  await createFolder(page, "Untitled");
  await createFolder(page, "Untitled");

  await expect(page.getByRole("link", { name: "Untitled", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Untitled (2)" })).toBeVisible();
});

test("deleting a folder warns with real subtree stats before removing it", async ({ page }) => {
  await registerAndSignIn(page);
  await createRoom(page, "Project Apollo");

  await createFolder(page, "Legal");
  await page.getByRole("link", { name: "Legal" }).click();
  await createFolder(page, "Contracts");

  // Back to the room root to delete "Legal" (which now contains "Contracts").
  await page.locator('nav[aria-label="Breadcrumb"] a', { hasText: "Project Apollo" }).click();
  await page.getByRole("row", { name: /Legal/ }).getByRole("button", { name: /Actions for/ }).click();
  await page.getByRole("menuitem", { name: "Delete" }).click();

  await expect(page.getByText("1 folder")).toBeVisible();
  await page.getByRole("button", { name: "Delete folder" }).click();
  await expect(page.getByRole("link", { name: "Legal" })).toHaveCount(0);
});
