import { expect, test } from "@playwright/test";
import { E2E } from "./env";
import { signIn, signInAsAdmin, signInAsCustomer, watchForErrors } from "./helpers";

test.describe("receive-only SMPP inbox (simulator)", () => {
  test.beforeEach(async ({ page }) => {
    await signInAsCustomer(page);
    await page.goto("/dashboard/messages");
  });

  test("is clearly a simulator, shows link state, and offers no way to send", async ({ page }) => {
    const status = page.getByTestId("smpp-status");
    await expect(status).toContainText("BOUND_RX");
    await expect(status).toContainText("smpp-simulator");
    await expect(status).toContainText("Simulated");
    await expect(page.getByText(/VNum cannot send messages/)).toBeVisible();
    await expect(page.getByLabel("Destination")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /send/i })).toHaveCount(0);
  });

  test("shows previously received messages for the seeded number", async ({ page }) => {
    await expect(page.getByTestId("inbox-message").first()).toBeVisible();
    await expect(page.getByTestId("inbox-list")).toContainText("verification code");
  });

  test("a simulated incoming SMS with a custom sender and body appears at the top", async ({ page }) => {
    const errors = watchForErrors(page);
    const before = await page.getByTestId("inbox-message").count();
    await page.getByLabel("Sender").fill("ACME-BANK");
    await page.getByLabel("Message").fill("Your code is 424242");
    await page.getByTestId("inbox-simulate").click();
    await expect(page.getByTestId("inbox-message")).toHaveCount(before + 1);
    await expect(page.getByTestId("inbox-message").first()).toContainText("ACME-BANK");
    await expect(page.getByTestId("inbox-message").first()).toContainText("Your code is 424242");
    errors.assertClean();
  });

  test("an empty body generates a six-digit verification message", async ({ page }) => {
    await page.getByLabel("Message").fill("");
    await page.getByTestId("inbox-simulate").click();
    await expect(page.getByTestId("inbox-message").first()).toContainText(/\d{6}/);
  });

  test("users without a number see an empty state", async ({ page }) => {
    await page.context().clearCookies();
    await signIn(page, { email: "sam.whitfield@vnum.test", password: E2E.customer.password });
    await page.goto("/dashboard/messages");
    await expect(page.getByText("No numbers to receive on yet")).toBeVisible();
  });

  test("when the simulated link is down, deliveries fail with a clear status", async ({ page, browser }) => {
    const adminCtx = await browser.newContext();
    const admin = await adminCtx.newPage();
    await signInAsAdmin(admin);
    const settings = {
      paymentWindowMinutes: 15,
      autoFulfil: true,
      registrationOpen: true,
      weatherFallback: { label: "London", latitude: 51.5072, longitude: -0.1276 },
    };
    const set = (mode: "online" | "offline" | "throttled") =>
      admin.request.put("/api/admin/settings", { data: { ...settings, smpp: { mode } } });

    try {
      expect((await set("offline")).ok()).toBe(true);
      await page.reload();
      await expect(page.getByTestId("smpp-status")).toContainText("UNBOUND");
      await expect(page.getByText("The simulated SMPP link is degraded")).toBeVisible();
      const before = await page.getByTestId("inbox-message").count();
      await page.getByTestId("inbox-simulate").click();
      await expect(page.getByText(/Delivery failed/)).toContainText("ESME_RBINDFAIL");
      await expect(page.getByTestId("inbox-message")).toHaveCount(before);

      expect((await set("throttled")).ok()).toBe(true);
      await page.reload();
      await page.getByTestId("inbox-simulate").click();
      await expect(page.getByText(/Delivery failed/)).toContainText("ESME_RTHROTTLED");
    } finally {
      await set("online");
      await adminCtx.close();
    }
    await page.reload();
    await expect(page.getByTestId("smpp-status")).toContainText("BOUND_RX");
  });
});
