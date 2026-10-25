import { expect, test, type Browser, type Page } from "@playwright/test";
import { E2E } from "./env";
import { signIn, signInAsCustomer, watchForErrors } from "./helpers";

const weather = (temp: number, code: number, isDay = 1) => ({
  current: { temperature_2m: temp, weather_code: code, is_day: isDay },
  current_units: { temperature_2m: "°C" },
});

async function mockWeather(page: Page, body: object | null) {
  await page.route("**/api.open-meteo.com/**", (route) =>
    body ? route.fulfill({ json: body }) : route.fulfill({ status: 503, body: "down" }),
  );
}

/** Opens browse results for a country and returns the nth row's detail page. */
async function openNumber(page: Page, query: string, index = 0) {
  await page.goto(`/dashboard/numbers?${query}`);
  const row = page.getByTestId("number-row").nth(index);
  const display = (await row.getByRole("link").first().innerText()).trim();
  await row.getByRole("link").first().click();
  await expect(page.getByTestId("number-heading")).toHaveText(display);
  return display;
}

async function placeOrder(page: Page) {
  await page.getByTestId("confirm-order").click();
  await expect(page).toHaveURL(/\/dashboard\/checkout\//);
}

async function chooseMethod(page: Page, label: RegExp) {
  await page.getByRole("radio", { name: label }).check();
  await page.getByTestId("start-payment").click();
  await expect(page.getByTestId("payment-panel")).toBeVisible();
}

test.describe("overview greeting", () => {
  for (const [time, greeting] of [
    ["2026-03-10T08:15:00", "Good morning"],
    ["2026-03-10T14:30:00", "Good afternoon"],
    ["2026-03-10T20:05:00", "Good evening"],
  ] as const) {
    test(`says "${greeting}" at ${time.slice(11, 16)} local time`, async ({ page }) => {
      await page.clock.install({ time: new Date(time) });
      await mockWeather(page, weather(14.6, 3));
      await signInAsCustomer(page);
      await expect(page.getByTestId("greeting-text")).toContainText(`${greeting}, Dana`);
      await expect(page.getByTestId("greeting-time")).toContainText(time.slice(11, 16));
      await expect(page.getByTestId("greeting-date")).toContainText("2026");
    });
  }

  test("shows live weather from Open-Meteo for the default location and labels it", async ({ page }) => {
    await mockWeather(page, weather(14.6, 61));
    await signInAsCustomer(page);
    await expect(page.getByTestId("weather-temp")).toHaveText("15°C");
    await expect(page.getByTestId("weather-condition")).toHaveText("Rain");
    await expect(page.getByTestId("weather-location")).toContainText("Default location: London");
    await expect(page.getByTestId("weather-location")).toContainText("Open-Meteo");
  });

  test("degrades honestly when weather is unavailable and can retry", async ({ page }) => {
    await mockWeather(page, null);
    await signInAsCustomer(page);
    await expect(page.getByText("Weather unavailable right now.")).toBeVisible();
    await expect(page.getByTestId("weather-temp")).toHaveCount(0);
    await page.unroute("**/api.open-meteo.com/**");
    await mockWeather(page, weather(3, 0, 0));
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByTestId("weather-condition")).toHaveText("Clear night");
  });

  test("only asks for the device location when the button is clicked", async ({ browser }) => {
    const ctx = await browser.newContext({
      geolocation: { latitude: 48.8566, longitude: 2.3522 },
      permissions: [],
    });
    const page = await ctx.newPage();
    const urls: string[] = [];
    await page.route("**/api.open-meteo.com/**", (route) => {
      urls.push(route.request().url());
      return route.fulfill({ json: weather(9, 2) });
    });
    await signInAsCustomer(page);
    await expect(page.getByTestId("weather-temp")).toBeVisible();
    expect(urls.at(-1)).toContain("latitude=51.5072");
    await ctx.grantPermissions(["geolocation"]);
    await page.getByRole("button", { name: "Use my location" }).click();
    await expect(page.getByTestId("weather-location")).toContainText("your approximate location");
    expect(urls.at(-1)).toContain("latitude=48.86");
    await ctx.close();
  });

  test("overview figures come from the database and match the orders page", async ({ page }) => {
    await signInAsCustomer(page);
    const available = Number(await page.getByTestId("stat-test-numbers-available").innerText());
    const completed = Number(await page.getByTestId("stat-completed-orders").innerText());
    const active = Number(await page.getByTestId("stat-active-orders").innerText());
    expect(available).toBeGreaterThan(0);

    await page.goto("/dashboard/numbers");
    await expect(page.getByTestId("result-count")).toContainText(/\d+ numbers/);
    await page.goto("/dashboard/orders");
    await expect(page.getByRole("link", { name: /^Completed\s*\d+$/ })).toContainText(String(completed));
    await expect(page.getByRole("link", { name: /^Active\s*\d+$/ })).toContainText(String(active));
  });
});

test.describe("browsing inventory", () => {
  test.beforeEach(async ({ page }) => signInAsCustomer(page));

  test("lists numbers with price and status, and paginates", async ({ page }) => {
    await page.goto("/dashboard/numbers");
    await expect(page.getByTestId("number-row")).toHaveCount(12);
    await expect(page.getByTestId("number-row").first()).toContainText("$");
    await page.getByRole("link", { name: /Next/ }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByTestId("number-row").first()).toBeVisible();
  });

  test("search narrows results by country name, number digits and service", async ({ page }) => {
    await page.goto("/dashboard/numbers");
    await page.getByLabel("Search numbers").fill("Germany");
    await page.getByRole("button", { name: "Apply filters" }).click();
    const rows = page.getByTestId("number-row");
    await expect(rows.first()).toContainText("Germany");
    for (const text of await rows.allInnerTexts()) expect(text).toContain("Germany");

    await page.getByLabel("Search numbers").fill("23125");
    await page.getByRole("button", { name: "Apply filters" }).click();
    await expect(rows.first()).toContainText("+49 30 23125");

    await page.getByLabel("Search numbers").fill("telegram");
    await page.getByRole("button", { name: "Apply filters" }).click();
    await expect(rows.first()).toContainText("Telegram");
  });

  test("filters by country, service, price and sorts", async ({ page }) => {
    await page.goto("/dashboard/numbers");
    await page.getByLabel("Country", { exact: true }).selectOption("GB");
    await page.getByLabel("Service", { exact: true }).selectOption("whatsapp");
    await page.getByLabel("Maximum price").fill("5");
    await page.getByLabel("Sort by").selectOption("price_desc");
    await page.getByRole("button", { name: "Apply filters" }).click();
    await expect(page).toHaveURL(/country=GB/);
    const rows = page.getByTestId("number-row");
    const texts = await rows.allInnerTexts();
    expect(texts.length).toBeGreaterThan(0);
    const prices = texts.map((t) => Number(t.match(/\$(\d+\.\d\d)/)![1]));
    for (const t of texts) {
      expect(t).toContain("United Kingdom");
    }
    for (const p of prices) expect(p).toBeLessThanOrEqual(5);
    expect(prices).toEqual([...prices].sort((a, b) => b - a));
  });

  test("shows an empty state with a way back when nothing matches", async ({ page }) => {
    await page.goto("/dashboard/numbers?q=zzzz-nothing");
    await expect(page.getByText("No numbers match these filters")).toBeVisible();
    await page.getByRole("main").getByRole("link", { name: "Clear filters" }).click();
    await expect(page.getByTestId("number-row").first()).toBeVisible();
  });

  test("number details show capabilities, services, price and the simulated source", async ({ page }) => {
    await openNumber(page, "country=FR");
    await expect(page.getByText("Receive SMS (simulated)")).toBeVisible();
    await expect(page.getByText("Supported services")).toBeVisible();
    await expect(page.getByTestId("order-total")).toContainText("$");
    await expect(page.getByText("not active on any real telecommunications network")).toBeVisible();
  });

  test("tolerates hostile query strings", async ({ page }) => {
    const errors = watchForErrors(page);
    await page.goto("/dashboard/numbers?page=-5&minPrice=abc&sort=drop%20table&status=SOLD&q=%27%3B--");
    await expect(page.getByRole("heading", { name: "Browse numbers" })).toBeVisible();
    errors.assertClean();
  });

  test("an unknown number id is a 404, not a crash", async ({ page }) => {
    await page.goto("/dashboard/numbers/does-not-exist");
    await expect(page.getByRole("heading", { name: "This page doesn't exist" })).toBeVisible();
  });
});

test.describe("purchase journey", () => {
  test("browse → review → pay (simulated) → confirmation → orders and payments", async ({ page }) => {
    const errors = watchForErrors(page);
    await signInAsCustomer(page);
    const display = await openNumber(page, "country=US&sort=price_asc", 2);
    await placeOrder(page);
    await expect(page.getByRole("heading", { name: `Pay for ${display}` })).toBeVisible();

    await chooseMethod(page, /Tether USDT.*TRON/s);
    await expect(page.getByTestId("payment-status")).toHaveText("Awaiting payment");
    await expect(page.getByText("invalid on every real network")).toBeVisible();
    await page.getByTestId("simulate-confirm").click();

    await expect(page).toHaveURL(/\/dashboard\/orders\/[^/]+/);
    await expect(page.getByTestId("order-status")).toHaveText("Completed");
    await expect(page.getByTestId("order-banner")).toContainText("Order confirmed");
    await expect(page.getByTestId("payment-row")).toContainText("Confirmed");
    const reference = (await page.getByText(/^Order VN-/i).innerText()).match(/VN-[A-Z0-9]{6}/i)![0].toUpperCase();

    await page.goto("/dashboard/orders");
    const row = page.getByTestId("order-row").filter({ hasText: reference });
    await expect(row).toContainText(display);
    await expect(row).toContainText("Completed");

    await page.goto("/dashboard/payments");
    await expect(page.getByTestId("payment-history-row").first()).toContainText("Confirmed");

    // The bought number is gone from the browse results.
    await page.goto(`/dashboard/numbers?q=${encodeURIComponent(display.replace(/\D/g, ""))}`);
    await expect(page.getByText("No numbers match these filters")).toBeVisible();
    errors.assertClean();
  });

  test("failed and underpaid payments are reported, keep the order open, and allow a retry", async ({ page }) => {
    await signInAsCustomer(page);
    const display = await openNumber(page, "country=CA&sort=price_asc", 1);
    await placeOrder(page);
    await chooseMethod(page, /Bitcoin/);

    await page.getByTestId("simulate-underpay").click();
    await expect(page.getByText("Your last payment attempt failed")).toBeVisible();
    await expect(page.getByText(/Underpaid/).first()).toBeVisible();

    await chooseMethod(page, /Tether USDT.*ERC/s);
    await page.getByTestId("simulate-fail").click();
    await expect(page.getByText("Simulated network failure").first()).toBeVisible();

    await chooseMethod(page, /Tether USDT.*TRON/s);
    await page.getByTestId("simulate-expire").click();
    await expect(page).toHaveURL(/\/dashboard\/orders\//);
    await expect(page.getByTestId("order-status")).toHaveText("Cancelled");
    await expect(page.getByTestId("order-banner")).toContainText("Payment window expired");
    await expect(page.getByTestId("payment-row")).toHaveCount(3);

    // Expiry returns the number to inventory.
    await page.goto(`/dashboard/numbers?q=${encodeURIComponent(display.replace(/\D/g, ""))}`);
    await expect(page.getByTestId("number-row")).toHaveCount(1);
  });

  test("customers can cancel an unpaid order, which releases the number", async ({ page }) => {
    await signInAsCustomer(page);
    const display = await openNumber(page, "country=DE&sort=price_asc", 0);
    await placeOrder(page);
    await page.getByRole("button", { name: "Cancel order and release number" }).click();
    await expect(page.getByTestId("order-status")).toHaveText("Cancelled");
    await page.goto(`/dashboard/numbers?q=${encodeURIComponent(display.replace(/\D/g, ""))}`);
    await expect(page.getByTestId("number-row")).toHaveCount(1);
  });

  test("a paid order cannot be paid or cancelled again from checkout", async ({ page }) => {
    await signInAsCustomer(page);
    await openNumber(page, "country=FR&sort=price_desc", 0);
    await placeOrder(page);
    const checkoutUrl = page.url();
    await chooseMethod(page, /Bitcoin/);
    await page.getByTestId("simulate-confirm").click();
    await expect(page.getByTestId("order-status")).toHaveText("Completed");
    await page.goto(checkoutUrl);
    await expect(page).toHaveURL(/\/dashboard\/orders\//);
  });

  test("double-submitting the order form creates exactly one order", async ({ page }) => {
    await signInAsCustomer(page);
    const display = await openNumber(page, "country=GB&sort=price_desc", 3);
    await page.evaluate(() => {
      const form = document.querySelector<HTMLFormElement>("form:has([data-testid=confirm-order])")!;
      form.requestSubmit();
      form.requestSubmit();
      form.requestSubmit();
    });
    await expect(page).toHaveURL(/\/dashboard\/checkout\//);
    await page.goto("/dashboard/orders");
    await expect(page.getByTestId("order-row").filter({ hasText: display })).toHaveCount(1);
  });

  test("when two customers race for one number, only one wins", async ({ browser }) => {
    const a = await newCustomerPage(browser, E2E.customer.email);
    const b = await newCustomerPage(browser, "priya.nair@vnum.test");
    const display = await openNumber(a, "country=US&sort=price_desc", 1);
    const url = a.url();
    await b.goto(url);
    await expect(b.getByTestId("number-heading")).toHaveText(display);

    await Promise.all([a.getByTestId("confirm-order").click(), b.getByTestId("confirm-order").click()]);
    for (const p of [a, b]) {
      await expect(p.locator("main")).toContainText(/Pay for|Someone else just took this number/);
    }
    const outcomes = await Promise.all(
      [a, b].map(async (p) => ({ ok: /checkout/.test(p.url()), lost: await p.getByText(/Someone else just took this number/).count() })),
    );
    expect(outcomes.filter((o) => o.ok)).toHaveLength(1);
    expect(outcomes.filter((o) => o.lost > 0)).toHaveLength(1);

    // And the number is now reserved for the winner only.
    const loser = outcomes[0].ok ? b : a;
    await loser.goto(url);
    await expect(loser.getByText("Reserved by another customer")).toBeVisible();
    await a.context().close();
    await b.context().close();
  });
});

async function newCustomerPage(browser: Browser, email: string) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await signIn(page, { email, password: E2E.customer.password }, /\/dashboard/);
  return page;
}

test.describe("customer settings", () => {
  test("can rename the account and the new name appears in the greeting", async ({ page }) => {
    await signIn(page, { email: "sam.whitfield@vnum.test", password: E2E.customer.password });
    await page.goto("/dashboard/settings");
    await page.getByLabel("Display name").fill("Sam W.");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Profile updated.")).toBeVisible();
    await page.goto("/dashboard");
    await expect(page.getByTestId("greeting-text")).toContainText("Sam");
  });

  test("password change requires the current password", async ({ page }) => {
    await signIn(page, { email: "sam.whitfield@vnum.test", password: E2E.customer.password });
    await page.goto("/dashboard/settings");
    await page.getByLabel("Current password").fill("wrong-password-1");
    await page.getByLabel("New password").fill("Another-pass-2025");
    await page.getByRole("button", { name: "Update password" }).click();
    await expect(page.getByText("Current password is incorrect")).toBeVisible();
  });
});
