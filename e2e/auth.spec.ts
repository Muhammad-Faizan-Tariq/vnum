import { expect, test } from "@playwright/test";
import { E2E } from "./env";
import { signIn, signInAsAdmin, signInAsCustomer, signOut, watchForErrors } from "./helpers";

test.describe("authentication", () => {
  test("rejects wrong credentials with a generic message", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(E2E.customer.email);
    await page.getByLabel("Password").fill("not-the-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Incorrect email or password" })).toBeVisible();
    await expect(page).toHaveURL(/sign-in/);
  });

  test("validates empty and malformed input before hitting the database", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill("not-an-email");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Enter a valid email address")).toBeVisible();
    await expect(page.getByText("Enter your password")).toBeVisible();
  });

  test("customer can sign in, see their name, and sign out", async ({ page }) => {
    const errors = watchForErrors(page);
    await signInAsCustomer(page);
    await expect(page.getByTestId("greeting-card")).toContainText("Dana");
    await signOut(page);
    await expect(page.getByText("You have been signed out")).toBeVisible();
    // Session is really gone: the protected page bounces back to sign-in.
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/sign-in/);
    errors.assertClean();
  });

  test("session cookie is HttpOnly and not readable from scripts", async ({ page, context }) => {
    await signInAsCustomer(page);
    const cookie = (await context.cookies()).find((c) => c.name === "vnum_session");
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("Lax");
    expect(await page.evaluate(() => document.cookie)).not.toContain("vnum_session");
  });

  test("protected pages redirect anonymous visitors to sign-in and return them afterwards", async ({ page }) => {
    for (const path of ["/dashboard", "/dashboard/orders", "/dashboard/messages", "/admin", "/admin/users"]) {
      await page.goto(path);
      await expect(page, path).toHaveURL(/\/sign-in/);
    }
    await page.goto("/dashboard/orders");
    await expect(page).toHaveURL(/next=%2Fdashboard%2Forders/);
    await page.getByLabel("Email").fill(E2E.customer.email);
    await page.getByLabel("Password").fill(E2E.customer.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard\/orders/);
  });

  test("the post-login redirect ignores off-site targets", async ({ page }) => {
    await page.goto("/sign-in?next=//evil.example");
    await page.getByLabel("Email").fill(E2E.customer.email);
    await page.getByLabel("Password").fill(E2E.customer.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/localhost:3200\/dashboard$/);
  });

  test("a regular user is kept out of the admin console", async ({ page }) => {
    await signInAsCustomer(page);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/dashboard\?notice=admin-only/);
    await expect(page.getByText("Administrators only")).toBeVisible();
    await expect(page.getByRole("link", { name: "Admin console" })).toHaveCount(0);
    for (const path of ["/admin/numbers", "/admin/orders", "/admin/users", "/admin/payments", "/admin/settings"]) {
      await page.goto(path);
      await expect(page, path).toHaveURL(/\/dashboard/);
    }
  });

  test("admin signs in to the admin console", async ({ page }) => {
    await signInAsAdmin(page);
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByTestId("greeting-card")).toContainText("Avery");
  });

  test("suspended accounts cannot sign in", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill("lena.okafor@vnum.test");
    await page.getByLabel("Password").fill(E2E.customer.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "suspended" })).toBeVisible();
  });

  test("sign-up creates a customer account with an empty dashboard", async ({ page }) => {
    const email = `e2e.${Date.now()}@vnum.test`;
    await page.goto("/sign-up");
    await page.getByLabel("Full name").fill("Casey Tester");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("short");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("Use at least 10 characters")).toBeVisible();

    await page.getByLabel("Password").fill("Longer-pass-2025");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByTestId("greeting-card")).toContainText("Casey");
    await expect(page.getByText("No orders yet")).toBeVisible();

    // New accounts are never administrators.
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/dashboard/);

    await signOut(page);
    await page.goto("/sign-up");
    await page.getByLabel("Full name").fill("Casey Again");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("Longer-pass-2025");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("An account with this email already exists")).toBeVisible();
  });

  test("sign-in works for a second user after another signs out (no session bleed)", async ({ page }) => {
    await signIn(page, E2E.customer);
    await signOut(page);
    await signIn(page, { email: "priya.nair@vnum.test", password: E2E.customer.password });
    await expect(page.getByTestId("greeting-card")).toContainText("Priya");
  });
});
