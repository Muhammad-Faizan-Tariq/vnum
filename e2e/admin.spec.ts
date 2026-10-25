import { createHmac, randomUUID } from "node:crypto";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { Client } from "pg";
import { E2E } from "./env";
import { signIn, signInAsAdmin, signInAsCustomer, watchForErrors } from "./helpers";

async function sql<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  const c = new Client({ connectionString: process.env.E2E_DB_URL ?? E2E.databaseUrl });
  await c.connect();
  try {
    return (await c.query(text, params)).rows as T[];
  } finally {
    await c.end();
  }
}

const mockWeather = (page: Page) =>
  page.route("**/api.open-meteo.com/**", (r) =>
    r.fulfill({ json: { current: { temperature_2m: 14, weather_code: 3, is_day: 1 }, current_units: { temperature_2m: "°C" } } }),
  );

/** Clicks a dialog trigger, retrying until hydration has attached the handler and the dialog opens. */
async function openConfirm(page: Page, trigger: Locator) {
  await expect(async () => {
    if (!(await page.getByRole("dialog").isVisible())) await trigger.click({ timeout: 2000 });
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 20_000 });
}

const sign = (raw: string) => createHmac("sha256", E2E.webhookSecret).update(raw).digest("hex");

test.describe("admin access control", () => {
  test("anonymous visitors are sent to sign-in", async ({ page }) => {
    await page.goto("/admin/orders");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fadmin%2Forders/);
  });

  test("a regular user is redirected away from every admin page", async ({ page }) => {
    await signInAsCustomer(page);
    for (const path of ["/admin", "/admin/numbers", "/admin/orders", "/admin/users", "/admin/payments", "/admin/settings"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/dashboard\?notice=admin-only/);
    }
  });

  const mutations: [string, string, unknown][] = [
    ["POST", "/api/admin/numbers", { e164: "+14155550111" }],
    ["PATCH", "/api/admin/numbers/anything", {}],
    ["POST", "/api/admin/orders/anything/transition", { to: "CANCELLED" }],
    ["PATCH", "/api/admin/users/anything", { role: "ADMIN" }],
    ["POST", "/api/admin/payments/anything/scenario", { scenario: "confirm" }],
    ["PUT", "/api/admin/settings", {}],
  ];

  test("admin mutations reject anonymous callers with 401", async ({ request }) => {
    for (const [method, url, data] of mutations) {
      const res = await request.fetch(url, { method, data });
      expect(res.status(), `${method} ${url}`).toBe(401);
    }
  });

  test("admin mutations reject a signed-in customer with 403", async ({ page }) => {
    await signInAsCustomer(page);
    for (const [method, url, data] of mutations) {
      const res = await page.request.fetch(url, { method, data });
      expect(res.status(), `${method} ${url}`).toBe(403);
      expect((await res.json()).error.code).toBe("FORBIDDEN");
    }
  });

  test("a customer cannot promote themselves by sending a role", async ({ page }) => {
    await signInAsCustomer(page);
    const [me] = await sql<{ id: string }>(`SELECT id FROM "User" WHERE email = $1`, [E2E.customer.email]);
    const res = await page.request.patch(`/api/admin/users/${me.id}`, { data: { role: "ADMIN" } });
    expect(res.status()).toBe(403);
    const [row] = await sql<{ role: string }>(`SELECT role FROM "User" WHERE id = $1`, [me.id]);
    expect(row.role).toBe("USER");
  });
});

test.describe("admin console", () => {
  test.beforeEach(async ({ page }) => {
    await mockWeather(page);
    await signInAsAdmin(page);
  });

  test("overview shows a greeting and counts that match the database", async ({ page }) => {
    const errors = watchForErrors(page);
    await page.goto("/admin");
    await expect(page.getByTestId("greeting-text")).toContainText(/Good (morning|afternoon|evening), Avery/);
    await expect(page.getByTestId("weather-temp")).toHaveText("14°C");

    const [{ n }] = await sql<{ n: string }>(`SELECT count(*)::text AS n FROM "VirtualNumber" WHERE status = 'AVAILABLE'`);
    await expect(page.getByTestId("stat-number-AVAILABLE")).toHaveText(n);
    const [{ u }] = await sql<{ u: string }>(`SELECT count(*)::text AS u FROM "User"`);
    await expect(page.getByTestId("stat-users")).toHaveText(u);
    await expect(page.getByTestId("activity-list").locator("li").first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Add a demo number" })).toBeVisible();
    errors.assertClean();
  });

  test("creates a number, finds it in the list, edits its price and rejects a duplicate", async ({ page }) => {
    const suffix = String(Math.floor(1000 + Math.random() * 8999));
    const e164 = `+1202555${suffix}`;

    await page.goto("/admin/numbers/new");
    await page.getByLabel("Number (E.164)").fill(e164);
    await page.getByLabel("Price (USD)").fill("4.25");
    await page.getByLabel("Country code").fill("US");
    await page.getByLabel("Country name").fill("United States");
    await page.getByLabel("Region (optional)").fill("Washington");
    await page.getByRole("checkbox", { name: "Telegram" }).check();
    await page.getByRole("button", { name: "Create number" }).click();
    await expect(page).toHaveURL(/\/admin\/numbers\/[a-z0-9]{20,}$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(`+1 202 555 ${suffix}`);

    await page.goto(`/admin/numbers?q=${suffix}`);
    const row = page.getByTestId("numbers-table").getByRole("row", { name: new RegExp(`555 ${suffix}`) });
    await expect(row).toBeVisible();
    await expect(row).toContainText("$4.25");
    await expect(row).toContainText("Available");

    await row.getByRole("link").click();
    await page.getByLabel("Price (USD)").fill("9.99");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Number updated")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Price (USD)")).toHaveValue("9.99");

    await page.goto("/admin/numbers/new");
    await page.getByLabel("Number (E.164)").fill(e164);
    await page.getByLabel("Price (USD)").fill("1.00");
    await page.getByLabel("Country code").fill("US");
    await page.getByLabel("Country name").fill("United States");
    await page.getByRole("button", { name: "Create number" }).click();
    await expect(page.locator("[role=alert]").filter({ hasText: "already exists" })).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/numbers\/new/);
  });

  test("validation errors are shown inline for a malformed number", async ({ page }) => {
    await page.goto("/admin/numbers/new");
    await page.getByLabel("Number (E.164)").fill("12345");
    await page.getByLabel("Price (USD)").fill("3");
    await page.getByLabel("Country code").fill("US");
    await page.getByLabel("Country name").fill("United States");
    await page.getByRole("button", { name: "Create number" }).click();
    await expect(page.getByText("Use E.164 format")).toBeVisible();
  });

  test("a number that has orders cannot change identity (409)", async ({ page }) => {
    const [n] = await sql<{ id: string }>(
      `SELECT n.id FROM "VirtualNumber" n JOIN "Order" o ON o."numberId" = n.id WHERE o.status = 'COMPLETED' LIMIT 1`,
    );
    const res = await page.request.patch(`/api/admin/numbers/${n.id}`, {
      data: {
        e164: "+14155550199", countryCode: "US", countryName: "United States", priceCents: 300,
        serviceSlugs: ["generic-otp"], smsInbound: true, voice: false, status: "AVAILABLE",
      },
    });
    expect(res.status()).toBe(409);
    expect((await res.json()).error.code).toBe("NUMBER_LOCKED");

    await page.goto(`/admin/numbers/${n.id}`);
    await expect(page.getByText("Some fields are locked")).toBeVisible();
    await expect(page.getByLabel("Number (E.164)")).toBeDisabled();
  });

  test("a sold number's availability cannot be changed (409)", async ({ page }) => {
    const [n] = await sql<{ id: string; e164: string; countryCode: string; countryName: string; priceCents: number }>(
      `SELECT id, e164, "countryCode", "countryName", "priceCents" FROM "VirtualNumber" WHERE status = 'SOLD' LIMIT 1`,
    );
    const res = await page.request.patch(`/api/admin/numbers/${n.id}`, {
      data: {
        e164: n.e164, countryCode: n.countryCode, countryName: n.countryName, priceCents: n.priceCents,
        serviceSlugs: ["generic-otp"], smsInbound: true, voice: false, status: "DISABLED",
      },
    });
    expect(res.status()).toBe(409);
    expect((await res.json()).error.code).toBe("STATUS_LOCKED");
  });

  test("orders can be searched and filtered by status", async ({ page }) => {
    await page.goto("/admin/orders");
    const table = page.getByTestId("orders-table");
    await expect(table.getByRole("row")).not.toHaveCount(1);

    await page.getByLabel("Status").selectOption("PAID_SANDBOX");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page).toHaveURL(/status=PAID_SANDBOX/);
    await expect(table.getByText("VN-PRIY02")).toBeVisible();
    await expect(table.getByText("VN-DEMO01")).toHaveCount(0);

    await page.goto("/admin/orders");
    await page.getByLabel("Search").fill("tomas.berg@vnum.test");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(table.getByText("VN-TOMA01")).toBeVisible();
    await expect(table.getByText("VN-PRIY02")).toHaveCount(0);

    await page.getByLabel("Search").fill("no-such-order-xyz");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByText("No orders match")).toBeVisible();
  });

  test("applies valid order transitions only and rejects invalid ones", async ({ page }) => {
    await page.goto("/admin/orders?q=VN-PRIY02");
    await page.getByRole("link", { name: "VN-PRIY02" }).click();
    await expect(page.getByTestId("transition-PROCESSING")).toBeVisible();
    // Only moves allowed from PAID_SANDBOX are offered.
    await expect(page.getByTestId("transition-COMPLETED")).toHaveCount(0);
    await expect(page.getByTestId("transition-PENDING_PAYMENT")).toHaveCount(0);

    await openConfirm(page, page.getByTestId("transition-PROCESSING"));
    await page.getByTestId("confirm-action").click();
    await expect(page.getByText("Currently Processing")).toBeVisible();

    await openConfirm(page, page.getByTestId("transition-COMPLETED"));
    await page.getByTestId("confirm-action").click();
    await expect(page.getByText("Currently Completed")).toBeVisible();
    await expect(page.getByText("This order is in a final state")).toBeVisible();
    await expect(page.getByTestId("order-timeline")).toContainText("order.completed");

    const id = page.url().split("/").pop();
    const bad = await page.request.post(`/api/admin/orders/${id}/transition`, { data: { to: "PENDING_PAYMENT" } });
    expect(bad.status()).toBe(409);
    expect((await bad.json()).error.code).toBe("INVALID_TRANSITION");
    const junk = await page.request.post(`/api/admin/orders/${id}/transition`, { data: { to: "SHIPPED" } });
    expect(junk.status()).toBe(422);
  });

  test("cancelling an order releases its number after confirmation", async ({ page }) => {
    // VN-TOMA01 is PROCESSING in the seed; cancelling must return the number to inventory.
    const [before] = await sql<{ status: string }>(
      `SELECT n.status FROM "VirtualNumber" n JOIN "Order" o ON o."numberId" = n.id WHERE o.reference = 'VN-TOMA01'`,
    );
    expect(before.status).toBe("SOLD");
    await page.goto("/admin/orders?q=VN-TOMA01");
    await page.getByRole("link", { name: "VN-TOMA01" }).click();
    await openConfirm(page, page.getByTestId("transition-CANCELLED"));
    await expect(page.getByRole("dialog")).toContainText("cannot be undone");
    await page.getByTestId("confirm-action").click();
    await expect(page.getByText("Currently Cancelled")).toBeVisible();
    const [after] = await sql<{ status: string }>(
      `SELECT n.status FROM "VirtualNumber" n JOIN "Order" o ON o."numberId" = n.id WHERE o.reference = 'VN-TOMA01'`,
    );
    expect(after.status).toBe("AVAILABLE");
  });

  test("payment detail is clearly marked as simulated", async ({ page }) => {
    await page.goto("/admin/payments?q=PAY-DEMO01");
    const row = page.getByTestId("payments-table").getByRole("row", { name: /PAY-DEMO01/ });
    await expect(row).toContainText("Simulated");
    await row.getByRole("link", { name: "PAY-DEMO01" }).click();
    await expect(page.getByText("Simulated payment", { exact: true })).toBeVisible();
    await expect(page.getByText("Placeholder deposit address")).toBeVisible();
    await expect(page.getByText(/Scenarios are only available while a payment is pending/)).toBeVisible();

    await page.goto("/admin/payments?status=FAILED");
    await expect(page.getByTestId("payments-table").getByText("PAY-DEMO04")).toBeVisible();
  });

  test("scenario endpoint refuses non-pending payments (409)", async ({ page }) => {
    const [p] = await sql<{ id: string }>(`SELECT id FROM "Payment" WHERE reference = 'PAY-DEMO01'`);
    const res = await page.request.post(`/api/admin/payments/${p.id}/scenario`, { data: { scenario: "confirm" } });
    expect(res.status()).toBe(409);
    const bad = await page.request.post(`/api/admin/payments/${p.id}/scenario`, { data: { scenario: "refund" } });
    expect(bad.status()).toBe(422);
  });

  test("settings persist after reload and invalid values are rejected", async ({ page }) => {
    await page.goto("/admin/settings");
    await expect(page.getByTestId("env-health")).toContainText("Configured");
    await expect(page.getByTestId("env-health")).not.toContainText("postgresql://");

    const window = page.getByLabel("Payment window (minutes)");
    const original = await window.inputValue();
    await window.fill("20");
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(page.getByText("Settings saved")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Payment window (minutes)")).toHaveValue("20");

    const invalid = await page.request.put("/api/admin/settings", {
      data: { paymentWindowMinutes: 0, autoFulfil: true, registrationOpen: true, smpp: { mode: "online" }, weatherFallback: { label: "x", latitude: 0, longitude: 0 } },
    });
    expect(invalid.status()).toBe(422);
    expect((await invalid.json()).error.fields.paymentWindowMinutes).toBeTruthy();

    await page.getByLabel("Payment window (minutes)").fill(original);
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(page.getByText("Settings saved")).toBeVisible();
  });

  test("users can be searched, suspended and reactivated; self-changes are blocked", async ({ page }) => {
    await page.goto("/admin/users");
    await page.getByLabel("Search").fill("sam.whitfield");
    await page.getByRole("button", { name: "Apply" }).click();
    const row = page.getByTestId("user-row-sam.whitfield@vnum.test");
    await expect(row).toBeVisible();
    await expect(page.getByTestId("users-table").getByRole("row")).toHaveCount(2);

    await openConfirm(page, row.getByRole("button", { name: "Suspend" }));
    await page.getByTestId("confirm-action").click();
    await expect(row).toContainText("Suspended");
    await row.getByRole("button", { name: "Reactivate" }).click();
    await expect(row).toContainText("Active");

    const [me] = await sql<{ id: string }>(`SELECT id FROM "User" WHERE email = $1`, [E2E.admin.email]);
    const self = await page.request.patch(`/api/admin/users/${me.id}`, { data: { role: "USER" } });
    expect(self.status()).toBe(409);
    expect((await self.json()).error.code).toBe("SELF_CHANGE");
    const empty = await page.request.patch(`/api/admin/users/${me.id}`, { data: {} });
    expect(empty.status()).toBe(422);
  });

  test("a suspended user can no longer sign in", async ({ page, browser }) => {
    const [u] = await sql<{ id: string }>(`SELECT id FROM "User" WHERE email = 'priya.nair@vnum.test'`);
    const suspend = await page.request.patch(`/api/admin/users/${u.id}`, { data: { status: "SUSPENDED" } });
    expect(suspend.status()).toBe(200);
    try {
      const ctx = await browser.newContext();
      const other = await ctx.newPage();
      await other.goto("/sign-in");
      await other.getByLabel("Email").fill("priya.nair@vnum.test");
      await other.getByLabel("Password").fill(E2E.customer.password);
      await other.getByRole("button", { name: "Sign in" }).click();
      await expect(other.locator("[role=alert]").filter({ hasText: /suspended/i })).toBeVisible();
      await ctx.close();
    } finally {
      await page.request.patch(`/api/admin/users/${u.id}`, { data: { status: "ACTIVE" } });
    }
  });
});

test.describe("payment callback webhook", () => {
  const post = (request: import("@playwright/test").APIRequestContext, body: unknown, signature: string | null) => {
    const raw = typeof body === "string" ? body : JSON.stringify(body);
    return request.post("/api/payments/callback", {
      data: Buffer.from(raw),
      headers: { "content-type": "application/json", ...(signature === null ? {} : { "x-vnum-signature": signature }) },
    });
  };

  test("rejects missing or wrong signatures with 401", async ({ request }) => {
    const body = { eventId: `evt_${randomUUID()}`, paymentReference: "PAY-DEMO01", type: "payment.confirmed" };
    expect((await post(request, body, null)).status()).toBe(401);
    expect((await post(request, body, "00".repeat(32))).status()).toBe(401);
    expect((await post(request, body, sign(JSON.stringify({ ...body, eventId: "tampered-id-123" })))).status()).toBe(401);
  });

  test("validates the payload and the payment reference", async ({ request }) => {
    const bad = JSON.stringify({ eventId: "x", type: "nope" });
    expect((await post(request, bad, sign(bad))).status()).toBe(422);
    const unknown = JSON.stringify({ eventId: `evt_${randomUUID()}`, paymentReference: "PAY-NOPE99", type: "payment.confirmed" });
    expect((await post(request, unknown, sign(unknown))).status()).toBe(404);
    const notJson = "not json";
    expect((await post(request, notJson, sign(notJson))).status()).toBe(400);
  });

  test("a replayed event id is a no-op and does not change the payment", async ({ request }) => {
    const raw = JSON.stringify({ eventId: `evt_${randomUUID()}`, paymentReference: "PAY-DEMO01", type: "payment.confirmed" });
    const [before] = await sql<{ status: string; confirmedAt: Date }>(`SELECT status, "confirmedAt" FROM "Payment" WHERE reference = 'PAY-DEMO01'`);

    const first = await post(request, raw, sign(raw));
    expect(first.status()).toBe(200);
    expect((await first.json()).result).toBe("ignored");

    const replay = await post(request, raw, sign(raw));
    expect(replay.status()).toBe(200);
    expect((await replay.json()).result).toBe("duplicate");

    const events = await sql(`SELECT 1 FROM "PaymentEvent" WHERE "eventId" = $1`, [JSON.parse(raw).eventId]);
    expect(events).toHaveLength(1);
    const [after] = await sql<{ status: string; confirmedAt: Date }>(`SELECT status, "confirmedAt" FROM "Payment" WHERE reference = 'PAY-DEMO01'`);
    expect(after).toEqual(before);
  });
});

test("admin can sign in directly and lands on the admin console", async ({ page }) => {
  await signIn(page, E2E.admin, /\/admin/);
  await expect(page.getByRole("navigation", { name: "Admin navigation" })).toBeVisible();
});
