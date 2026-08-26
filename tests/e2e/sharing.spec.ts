import { expect, test, type Browser } from "@playwright/test";
import { createRoom, registerAndSignIn, uniqueEmail } from "./helpers";

async function shareLinkFor(page: import("@playwright/test").Page) {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "Share" }).click();
  await page.getByLabel("General access").click();
  await page.getByRole("option", { name: /Anyone with the link/ }).click();
  await page.getByRole("button", { name: "Copy link" }).click();
  // The dialog never displays the raw URL, so pull it from the app's own
  // clipboard write instead of parsing the DOM.
  const href = await page.evaluate(() => navigator.clipboard.readText());
  await page.getByRole("button", { name: "Done" }).click();
  return href;
}

async function anonymousPage(browser: Browser) {
  const context = await browser.newContext();
  return { context, page: await context.newPage() };
}

test("a public room link lets an anonymous visitor browse read-only", async ({ page, browser }) => {
  await registerAndSignIn(page);
  await createRoom(page, "Project Voyager");
  const link = await shareLinkFor(page);

  const { context, page: guest } = await anonymousPage(browser);
  await guest.goto(link);
  await expect(guest.getByText("View only")).toBeVisible();
  await expect(guest.locator('[aria-current="page"]')).toHaveText("Project Voyager");
  await expect(guest.getByRole("button", { name: "Share" })).toHaveCount(0);
  await context.close();
});

test("revoking a link makes it stop working immediately", async ({ page, browser }) => {
  await registerAndSignIn(page);
  await createRoom(page, "Project Cassini");
  const link = await shareLinkFor(page);

  await page.getByRole("button", { name: "Share" }).click();
  await page.getByLabel("General access").click();
  await page.getByRole("option", { name: "Restricted — only people invited above" }).click();
  await page.getByRole("button", { name: "Done" }).click();

  const { context, page: guest } = await anonymousPage(browser);
  await guest.goto(link);
  await expect(guest.getByText("This link is no longer available")).toBeVisible();
  await context.close();
});

test("a restricted invite lets the invited account in and blocks everyone else", async ({
  page,
  browser,
}) => {
  await registerAndSignIn(page);
  await createRoom(page, "Project Juno");

  const inviteeEmail = uniqueEmail("invitee");
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "Share" }).click();
  await page.getByPlaceholder("Invite by email").fill(inviteeEmail);
  await page.getByRole("button", { name: "Invite" }).click();
  await expect(page.getByText(inviteeEmail, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Copy link" }).click();
  const link = await page.evaluate(() => navigator.clipboard.readText());
  await page.getByRole("button", { name: "Done" }).click();

  // The invited person: no account yet, has to sign up, then sees the room.
  const { context: inviteeCtx, page: invitee } = await anonymousPage(browser);
  await registerAndSignIn(invitee, { email: inviteeEmail, name: "Invited Person" });
  await invitee.goto(link);
  await expect(invitee.locator('[aria-current="page"]')).toHaveText("Project Juno");
  await inviteeCtx.close();

  // Someone else, signed in under a different account, is blocked.
  const { context: strangerCtx, page: stranger } = await anonymousPage(browser);
  await registerAndSignIn(stranger);
  await stranger.goto(link);
  await expect(stranger.getByText("This account doesn't have access")).toBeVisible();
  await strangerCtx.close();
});
