import { expect, test } from "@playwright/test";
import { signInAsAdmin, signInAsCustomer, watchForErrors } from "./helpers";

const isDark = (page: import("@playwright/test").Page) =>
  page.evaluate(() => document.documentElement.classList.contains("dark"));

test.describe("theme in the application", () => {
  test("toggle switches the dashboard theme and the choice survives navigation and reload", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await signInAsCustomer(page);
    expect(await isDark(page)).toBe(false);
    const lightBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);

    await page.getByTestId("theme-toggle").click();
    await expect.poll(() => isDark(page)).toBe(true);
    const darkBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(darkBg).not.toBe(lightBg);
    await expect(page.getByTestId("theme-toggle")).toHaveAttribute("aria-checked", "true");

    await page.getByRole("link", { name: "My orders" }).first().click();
    await expect(page).toHaveURL(/orders/);
    expect(await isDark(page)).toBe(true);
    await page.reload();
    expect(await isDark(page)).toBe(true);

    await page.getByTestId("theme-toggle").click();
    await expect.poll(() => isDark(page)).toBe(false);
    await page.reload();
    expect(await isDark(page)).toBe(false);
  });

  test("follows the OS preference until the user chooses, then the choice wins", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await signInAsCustomer(page);
    expect(await isDark(page)).toBe(true);
    await page.getByTestId("theme-toggle").click();
    await expect.poll(() => isDark(page)).toBe(false);
    await page.reload();
    expect(await isDark(page)).toBe(false);
  });

  test("dark mode applies to admin pages, menus and tables too", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await signInAsAdmin(page);
    await page.goto("/admin/orders");
    expect(await isDark(page)).toBe(true);
    const surface = await page.evaluate(() => {
      const t = document.querySelector("table");
      return t ? getComputedStyle(t.closest("div")!.parentElement!).backgroundColor : "";
    });
    expect(surface).not.toBe("rgb(255, 255, 255)");
    await page.getByTestId("user-menu").click();
    const menuBg = await page.getByRole("menu").evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(menuBg).not.toBe("rgb(255, 255, 255)");
  });
});

test.describe("responsive application layouts", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("customer pages fit a phone without horizontal scroll and the drawer navigates", async ({ page }) => {
    const errors = watchForErrors(page);
    await signInAsCustomer(page);
    for (const path of ["/dashboard", "/dashboard/numbers", "/dashboard/orders", "/dashboard/payments", "/dashboard/messages", "/dashboard/settings"]) {
      await page.goto(path);
      await expect(page.getByRole("main")).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${path} overflows by ${overflow}px`).toBeLessThanOrEqual(0);
    }
    await page.goto("/dashboard");
    await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeHidden();
    await page.getByTestId("mobile-nav-trigger").click();
    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();
    await drawer.getByRole("link", { name: "Browse numbers" }).click();
    await expect(page).toHaveURL(/\/dashboard\/numbers/);
    await expect(drawer).toBeHidden();
    errors.assertClean();
  });

  test("admin pages fit a phone without horizontal scroll", async ({ page }) => {
    await signInAsAdmin(page);
    for (const path of ["/admin", "/admin/numbers", "/admin/orders", "/admin/users", "/admin/payments", "/admin/settings"]) {
      await page.goto(path);
      await expect(page.getByRole("main")).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${path} overflows by ${overflow}px`).toBeLessThanOrEqual(0);
    }
  });
});

test.describe("desktop application layout", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test("shows the sidebar with the active item marked", async ({ page }) => {
    await signInAsCustomer(page);
    await page.goto("/dashboard/orders");
    const nav = page.getByRole("navigation", { name: "Main navigation" });
    await expect(nav.getByRole("link", { name: "My orders" })).toHaveAttribute("aria-current", "page");
    await expect(nav.getByRole("link", { name: "Overview" })).not.toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toContainText("Orders");
  });
});
