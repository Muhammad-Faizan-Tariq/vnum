import { expect, type Page } from "@playwright/test";
import { E2E } from "./env";

export type Account = { email: string; password: string };

/** Signs in through the real form and waits for the post-login redirect. */
export async function signIn(page: Page, account: Account = E2E.customer, expectedPath?: RegExp) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(expectedPath ?? /\/(dashboard|admin)/);
}

export const signInAsAdmin = (page: Page) => signIn(page, E2E.admin, /\/admin/);
export const signInAsCustomer = (page: Page) => signIn(page, E2E.customer, /\/dashboard/);

export async function signOut(page: Page) {
  await page.getByTestId("user-menu").click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in/);
}

/** Fails the test on uncaught page errors and on failed first-party requests. */
export function watchForErrors(page: Page) {
  const problems: string[] = [];
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !/Failed to load resource/.test(m.text())) problems.push(`console: ${m.text()}`);
  });
  page.on("response", (r) => {
    const url = new URL(r.url());
    if (url.origin === E2E.baseURL && r.status() >= 500) problems.push(`${r.status()} ${url.pathname}`);
  });
  return { assertClean: () => expect(problems, problems.join("\n")).toEqual([]) };
}
