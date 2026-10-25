import { expect, test } from "@playwright/test";
import { watchForErrors } from "./helpers";

test.describe("marketing site", () => {
  test("homepage renders with a single h1 and honest sandbox copy", async ({ page }) => {
    const errors = watchForErrors(page);
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Virtual numbers");
    await expect(page.getByText("Sample data").first()).toBeVisible();
    await expect(page.locator("#features")).toBeVisible();
    await expect(page.locator("#how-it-works")).toBeVisible();
    errors.assertClean();
  });

  test("primary navigation reaches pricing, faq and in-page anchors", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByTestId("marketing-nav");
    await nav.getByRole("link", { name: "Pricing" }).click();
    await expect(page).toHaveURL(/\/pricing$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("sandbox plans");

    await page.getByTestId("marketing-nav").getByRole("link", { name: "FAQ" }).click();
    await expect(page).toHaveURL(/\/faq$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Frequently asked questions");

    await page.getByTestId("marketing-nav").getByRole("link", { name: "Features" }).click();
    await expect(page).toHaveURL(/\/#features$/);
    await expect(page.locator("#features")).toBeInViewport();

    await page.getByTestId("marketing-nav").getByRole("link", { name: "How it works" }).click();
    await expect(page).toHaveURL(/\/#how-it-works$/);

    await page.getByRole("link", { name: "Get started" }).first().click();
    await expect(page).toHaveURL(/\/sign-up$/);
    await page.goto("/");
    await page.getByRole("link", { name: "Sign in" }).first().click();
    await expect(page).toHaveURL(/\/sign-in$/);
  });

  test("every internal link on the homepage resolves", async ({ page }) => {
    await page.goto("/");
    const hrefs = await page.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href") ?? ""));
    const internal = [...new Set(hrefs.filter((h) => h.startsWith("/")).map((h) => h.split("#")[0] || "/"))].filter(
      (h) => !h.startsWith("/dashboard") && !h.startsWith("/admin"),
    );
    expect(internal.length).toBeGreaterThan(4);
    for (const href of internal) {
      const res = await page.request.get(href);
      expect(res.status(), `GET ${href}`).toBeLessThan(400);
    }
  });

  test("pricing and faq content render", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page.getByTestId("plan-explorer")).toBeVisible();
    await expect(page.getByTestId("plan-buyer")).toBeVisible();
    await expect(page.getByTestId("plan-admin")).toBeVisible();
    await expect(page.getByText("No real transactions")).toBeVisible();

    await page.goto("/faq");
    const q = page.getByText("Are the phone numbers real?");
    await expect(q).toBeVisible();
    await q.click();
    await expect(page.getByText("not active on any telecom network").first()).toBeVisible();
    await expect(page.getByText("Does VNum send email?")).toBeVisible();
  });

  for (const path of ["/terms", "/privacy", "/contact"]) {
    test(`${path} is labelled as draft demo content`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expect(page.getByText("Draft demo content", { exact: true })).toBeVisible();
    });
  }

  test("unknown routes show the branded 404", async ({ page }) => {
    const res = await page.goto("/definitely-not-a-page");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: /doesn.t exist/ })).toBeVisible();
  });

  test("theme toggle flips, persists across reload and does not flash", async ({ page }) => {
    await page.addInitScript(() => {
      // Pre-seed an explicit dark preference once; later toggles must win.
      if (!sessionStorage.getItem("seeded")) {
        localStorage.setItem("vnum-theme", "dark");
        sessionStorage.setItem("seeded", "1");
      }
    });
    await page.goto("/");
    const html = page.locator("html");
    // Applied by the inline head script before hydration, not after.
    await expect(html).toHaveClass(/dark/);
    const toggle = page.getByTestId("theme-toggle");
    await expect(toggle).toHaveAttribute("aria-checked", "true");

    await toggle.click();
    await expect(html).not.toHaveClass(/dark/);
    await page.reload();
    await expect(html).not.toHaveClass(/dark/);
    expect(await page.evaluate(() => localStorage.getItem("vnum-theme"))).toBe("light");

    await page.getByTestId("theme-toggle").click();
    await expect(html).toHaveClass(/dark/);
    await page.reload();
    await expect(html).toHaveClass(/dark/);
  });

  test("dark class is present at first paint when preference is stored", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("vnum-theme", "dark"));
    await page.goto("/pricing", { waitUntil: "commit" });
    const early = await page.evaluate(
      () =>
        new Promise<boolean>((resolve) => {
          const check = () => (document.documentElement ? document.documentElement.classList.contains("dark") : false);
          if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", () => resolve(check()));
          } else resolve(check());
        }),
    );
    expect(early).toBe(true);
  });
});

test.describe("responsive layout", () => {
  const pages = ["/", "/pricing", "/faq", "/terms", "/contact", "/sign-in", "/sign-up"];

  for (const [label, size] of [
    ["mobile", { width: 375, height: 812 }],
    ["desktop", { width: 1280, height: 800 }],
  ] as const) {
    test(`no horizontal overflow on ${label}`, async ({ page }) => {
      await page.setViewportSize(size);
      for (const p of pages) {
        await page.goto(p);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow, `${p} overflows by ${overflow}px at ${size.width}px`).toBeLessThanOrEqual(0);
      }
    });
  }

  test("mobile shows a menu button instead of the desktop nav and the menu navigates", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    await expect(page.getByTestId("marketing-nav")).toBeHidden();
    await page.getByTestId("marketing-menu-trigger").click();
    const menu = page.getByRole("dialog");
    await expect(menu).toBeVisible();
    await menu.getByRole("link", { name: "Pricing" }).click();
    await expect(page).toHaveURL(/\/pricing$/);
    await expect(page.getByRole("dialog")).toBeHidden();

    await page.getByTestId("marketing-menu-trigger").click();
    await page.getByRole("button", { name: "Close menu" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
  });

  test("desktop shows the full nav and hides the menu button", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    await expect(page.getByTestId("marketing-nav")).toBeVisible();
    await expect(page.getByTestId("marketing-menu-trigger")).toBeHidden();
  });
});
