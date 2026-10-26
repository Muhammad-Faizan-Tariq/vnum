import { execSync, spawn, type ChildProcess } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";
import { E2E } from "./env";
import { signIn, signInAsAdmin, signInAsCustomer } from "./helpers";

// Real SMPP over TCP against the local simulator server. The worker runs as its own process,
// exactly as it would in production.
test.describe.configure({ mode: "serial" });

const env = {
  ...process.env,
  DATABASE_URL: E2E.databaseUrl,
  PAYMENT_WEBHOOK_SECRET: E2E.webhookSecret,
  SMPP_ENCRYPTION_KEY: E2E.smppKey,
  SMPP_WORKER_POLL_MS: "1000",
  // Different ports from `npm run smpp:sim` so a dev simulator can keep running.
  SMPP_SIM_PORT: "2785",
  SMPP_SIM_CONTROL_PORT: "2786",
};
const procs: ChildProcess[] = [];

function start(script: string, ready: RegExp) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", "tsx", script], { env, stdio: ["ignore", "pipe", "pipe"] });
    procs.push(child);
    const timer = setTimeout(() => reject(new Error(`${script} did not become ready`)), 60_000);
    const onData = (d: Buffer) => {
      if (ready.test(d.toString())) {
        clearTimeout(timer);
        resolve();
      }
    };
    child.stdout!.on("data", onData);
    child.stderr!.on("data", (d) => process.env.E2E_DEBUG && console.error(String(d)));
    child.once("exit", (c) => reject(new Error(`${script} exited early (${c})`)));
  });
}

const kill = (c: ChildProcess) => {
  c.removeAllListeners("exit");
  try {
    if (process.platform === "win32") execSync(`taskkill /pid ${c.pid} /T /F`, { stdio: "ignore" });
    else c.kill("SIGTERM");
  } catch {
    /* already exited */
  }
};

async function sql<T = Record<string, unknown>>(query: string, params: unknown[] = []) {
  const c = new Client({ connectionString: E2E.databaseUrl });
  await c.connect();
  try {
    return (await c.query(query, params)).rows as T[];
  } finally {
    await c.end();
  }
}

const sim = (path: string, body?: object) =>
  fetch(`http://127.0.0.1:2786${path}`, body ? { method: "POST", body: JSON.stringify(body) } : undefined).then((r) => r.json());

async function addVendorViaUi(page: Page, v: { name: string; password: string }) {
  await page.goto("/admin/smpp/new");
  await expect(page.getByTestId("smpp-vendor-form")).toBeVisible();
  await page.getByLabel("Vendor name").fill(v.name);
  await page.getByLabel("SMPP host / IP").fill("127.0.0.1");
  await page.getByLabel("Port").fill("2785");
  await page.getByLabel("System ID / username").fill("vnumtest");
  await page.getByLabel("Password").fill(v.password);
  await page.getByRole("button", { name: "Create vendor" }).click();
  await expect(page).toHaveURL(/\/admin\/smpp$/);
}

const row = (page: Page, name: string) => page.getByTestId("vendor-row").filter({ hasText: name });

test.beforeAll(async () => {
  await start("scripts/smpp-sim-server.ts", /control API/);
  await start("scripts/smpp-worker.ts", /started, polling/);
});
test.afterAll(() => procs.forEach(kill));

test.describe("SMPP vendors (admin) and the receive-only worker", () => {
  test("only admins can manage vendors", async ({ page, request }) => {
    const body = { name: "x", host: "127.0.0.1", port: 2775, systemId: "a", password: "b" };
    expect((await request.post("/api/admin/smpp-vendors", { data: body })).status()).toBe(401);
    await signInAsCustomer(page);
    for (const [method, url] of [
      ["post", "/api/admin/smpp-vendors"],
      ["patch", "/api/admin/smpp-vendors/anything"],
      ["delete", "/api/admin/smpp-vendors/anything"],
      ["post", "/api/admin/smpp-vendors/anything/test"],
    ] as const) {
      const res = await page.request[method](url, { data: body });
      expect(res.status(), `${method} ${url}`).toBe(403);
    }
    await page.goto("/admin/smpp");
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("validates connection details on the server", async ({ page }) => {
    await signInAsAdmin(page);
    const res = await page.request.post("/api/admin/smpp-vendors", {
      data: { name: "x", host: "smpp://bad host", port: 70000, systemId: "waytoolongsystemid1", password: "" },
    });
    expect(res.status()).toBe(422);
    const fields = (await res.json()).error.fields;
    expect(Object.keys(fields)).toEqual(expect.arrayContaining(["name", "host", "port", "systemId", "password"]));
  });

  test("a wrong password is reported with the vendor's SMPP error, then fixed by editing", async ({ page }) => {
    await signInAsAdmin(page);
    await addVendorViaUi(page, { name: "E2E Vendor", password: "wrongpass" });
    await expect(row(page, "E2E Vendor")).toBeVisible();

    await expect(async () => {
      await page.reload();
      await expect(row(page, "E2E Vendor")).toHaveAttribute("data-state", "FAILED");
    }).toPass({ timeout: 30_000 });
    await expect(row(page, "E2E Vendor")).toContainText("ESME_RINVPASWD");

    await row(page, "E2E Vendor").getByRole("link", { name: "Edit" }).click();
    await page.getByLabel("Password").fill("testpass");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page).toHaveURL(/\/admin\/smpp$/);
    await expect(async () => {
      await page.reload();
      await expect(row(page, "E2E Vendor")).toHaveAttribute("data-state", "BOUND");
    }).toPass({ timeout: 30_000 });
    expect((await sim("/status")).bound).toBe(1);
  });

  test("the password is stored encrypted and never sent back to the browser", async ({ page }) => {
    await signInAsAdmin(page);
    const [vendor] = await sql<{ id: string; passwordEnc: string }>(`SELECT id, "passwordEnc" FROM "SmppVendor" WHERE name = 'E2E Vendor'`);
    expect(vendor.passwordEnc).not.toContain("testpass");
    expect(vendor.passwordEnc.split(".")).toHaveLength(3);
    await page.goto(`/admin/smpp/${vendor.id}`);
    const html = await page.content();
    expect(html).not.toContain("testpass");
    expect(html).not.toContain(vendor.passwordEnc);
    await expect(page.getByLabel("Password")).toHaveValue("");
  });

  test("duplicate vendor names are rejected", async ({ page }) => {
    await signInAsAdmin(page);
    const res = await page.request.post("/api/admin/smpp-vendors", {
      data: { name: "E2E Vendor", host: "127.0.0.1", port: 2785, systemId: "vnumtest", password: "testpass" },
    });
    expect(res.status()).toBe(409);
  });

  test("a message pushed through real SMPP lands in the owner's inbox only", async ({ page, browser }) => {
    const [owned] = await sql<{ id: string; e164: string }>(
      `SELECT n.id, n.e164 FROM "Order" o JOIN "VirtualNumber" n ON n.id = o."numberId" JOIN "User" u ON u.id = o."userId"
       WHERE u.email = $1 AND o.status = 'COMPLETED' ORDER BY o."completedAt" DESC LIMIT 1`,
      [E2E.customer.email],
    );
    const text = `SMPP e2e ${Date.now()}`;
    expect((await sim("/deliver", { from: "ACME-BANK", to: owned.e164, text })).delivered).toBe(1);

    await signInAsCustomer(page);
    await expect(async () => {
      await page.goto(`/dashboard/messages?number=${owned.id}`);
      await expect(page.getByTestId("inbox-message").filter({ hasText: text })).toBeVisible();
    }).toPass({ timeout: 20_000 });
    const msg = page.getByTestId("inbox-message").filter({ hasText: text });
    await expect(msg).toContainText("ACME-BANK");
    await expect(msg).toContainText("via SMPP vendor: E2E Vendor");

    // Another customer must not see it.
    const ctx = await browser.newContext();
    const other = await ctx.newPage();
    await signIn(other, { email: "priya.nair@vnum.test", password: E2E.customer.password });
    await other.goto("/dashboard/messages");
    await expect(other.getByText(text)).toHaveCount(0);
    await ctx.close();

    // A destination nobody owns is acknowledged but not stored.
    const stray = `stray ${Date.now()}`;
    expect((await sim("/deliver", { to: "+19995550100", text: stray })).delivered).toBe(1);
    await expect(async () => {
      const rows = await sql(`SELECT 1 FROM "ActivityLog" WHERE action = 'smpp.unrouted' AND metadata->>'destination' = '+19995550100'`);
      expect(rows.length).toBeGreaterThan(0);
    }).toPass({ timeout: 15_000 });
    expect(await sql(`SELECT 1 FROM "Message" WHERE body = $1`, [stray])).toHaveLength(0);
  });

  test("admin can send a simulator test SMS and see it under Recent traffic", async ({ page, browser }) => {
    const [vendor] = await sql<{ id: string }>(`SELECT id FROM "SmppVendor" WHERE name = 'E2E Vendor'`);
    const [owned] = await sql<{ e164: string }>(
      `SELECT n.e164 FROM "Order" o JOIN "VirtualNumber" n ON n.id = o."numberId" JOIN "User" u ON u.id = o."userId"
       WHERE u.email = $1 AND o.status = 'COMPLETED' ORDER BY o."completedAt" DESC LIMIT 1`,
      [E2E.customer.email],
    );
    // Customers cannot use the endpoint.
    const customer = await browser.newContext();
    const cp = await customer.newPage();
    await signInAsCustomer(cp);
    expect((await cp.request.post(`/api/admin/smpp-vendors/${vendor.id}/test-message`, { data: { to: owned.e164, text: "x" } })).status()).toBe(403);
    await customer.close();

    await signInAsAdmin(page);
    await page.goto(`/admin/smpp/${vendor.id}`);
    const stamp = Date.now();
    await page.getByLabel("Destination number").fill(owned.e164);
    await page.getByLabel("Message", { exact: true }).fill(`click test ${stamp}`);
    await page.getByTestId("send-test-sms").click();
    await expect(async () => {
      await page.reload();
      await expect(page.getByTestId("traffic-row").filter({ hasText: `click test ${stamp}` })).toHaveAttribute("data-routed", "true");
    }).toPass({ timeout: 20_000 });

    // A number nobody owns is visible too, flagged as not routed.
    await page.getByLabel("Destination number").fill("+19995550111");
    await page.getByLabel("Message", { exact: true }).fill(`stray click ${stamp}`);
    await page.getByTestId("send-test-sms").click();
    await expect(async () => {
      await page.reload();
      const row = page.getByTestId("traffic-row").filter({ hasText: `stray click ${stamp}` });
      await expect(row).toHaveAttribute("data-routed", "false");
      await expect(row).toContainText("Not routed");
    }).toPass({ timeout: 20_000 });

    // Validation.
    await page.getByLabel("Destination number").fill("12345");
    await page.getByTestId("send-test-sms").click();
    await expect(page.getByText("Use E.164 format")).toBeVisible();
  });

  test("disabling a vendor unbinds it; deleting removes it", async ({ page }) => {
    await signInAsAdmin(page);
    const [vendor] = await sql<{ id: string }>(`SELECT id FROM "SmppVendor" WHERE name = 'E2E Vendor'`);
    await page.goto(`/admin/smpp/${vendor.id}`);
    await page.getByLabel(/Enabled/).uncheck();
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page).toHaveURL(/\/admin\/smpp$/);
    await expect(row(page, "E2E Vendor")).toHaveAttribute("data-state", "DISABLED");
    await expect(async () => expect((await sim("/status")).bound).toBe(0)).toPass({ timeout: 15_000 });

    await page.goto(`/admin/smpp/${vendor.id}`);
    await page.getByTestId("delete-vendor").click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
    await expect(async () => {
      await page.goto("/admin/smpp");
      await expect(row(page, "E2E Vendor")).toHaveCount(0);
    }).toPass({ timeout: 15_000 });
  });
});
