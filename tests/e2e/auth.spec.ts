import { expect, test } from "@playwright/test";
import { registerAndSignIn, signOut, uniqueEmail } from "./helpers";

test("register, sign out, and sign back in", async ({ page }) => {
  const { email, password } = await registerAndSignIn(page);
  await expect(page.getByRole("heading", { name: "Data rooms", exact: true })).toBeVisible();

  await signOut(page, email);

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/rooms$/);
});

test("rejects a wrong password with a clear message and no navigation", async ({ page }) => {
  const { email } = await registerAndSignIn(page);
  await signOut(page, email);

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("definitely-wrong");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByText(/don't match/i)).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test("visiting a protected page while signed out redirects to login", async ({ page }) => {
  await page.goto("/rooms");
  await expect(page).toHaveURL(/\/login$/);
});

test("duplicate email registration is rejected", async ({ page }) => {
  const email = uniqueEmail("dupe");
  await registerAndSignIn(page, { email });
  await signOut(page, email);

  await page.goto("/register");
  await page.getByLabel("Name").fill("Second Try");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByText(/already exists/i)).toBeVisible();
  await expect(page).toHaveURL(/\/register$/);
});
