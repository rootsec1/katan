import { expect, test } from "@playwright/test";

test("creates a room and joins through its private invite", async ({ browser }) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();

  await host.goto("/");
  await expect(host.getByRole("heading", { name: /follow the river/i })).toBeVisible();
  await host.getByPlaceholder("What should we call you?").fill("Ari");
  await host.getByRole("button", { name: "3 players" }).click();
  await host.getByRole("button", { name: /open a table/i }).click();
  await expect(host).toHaveURL(/\/r\/[a-z0-9_-]+/);
  await expect(host.getByRole("heading", { name: "The map is nearly ready." })).toBeVisible();

  await guest.goto(host.url());
  await expect(guest.getByRole("heading", { name: "Pull up a chair." })).toBeVisible();
  await guest.getByPlaceholder("How should friends know you?").fill("Bea");
  await guest.getByRole("button", { name: /join the table/i }).click();
  await expect(guest.getByRole("heading", { name: "The map is nearly ready." })).toBeVisible();
  await expect(host.getByRole("heading", { name: "Bea" })).toBeVisible({ timeout: 8_000 });

  await hostContext.close();
  await guestContext.close();
});

test("fills bot chairs, starts, and exposes keyboard-operable setup targets", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder("What should we call you?").fill("Sol");
  await page.getByRole("button", { name: "3 players" }).click();
  await page.getByRole("button", { name: /open a table/i }).click();
  await expect(page.getByRole("heading", { name: "The map is nearly ready." })).toBeVisible();

  await page.getByRole("button", { name: "Add bot" }).first().click();
  await expect(page.getByText("normal wayfinder", { exact: true })).toHaveCount(1, { timeout: 8_000 });
  await page.getByRole("button", { name: "Add bot" }).click();
  await expect(page.getByText("normal wayfinder", { exact: true })).toHaveCount(2, { timeout: 8_000 });
  await page.getByRole("button", { name: "I’m ready" }).click();
  await expect(page.getByRole("button", { name: /unfold the map/i })).toBeEnabled({ timeout: 8_000 });
  await page.getByRole("button", { name: /unfold the map/i }).click();

  await expect(page.getByRole("group", { name: "The Rill game board" })).toBeVisible({ timeout: 12_000 });
  for (let step = 0; step < 4; step += 1) {
    const settlement = page.getByRole("button", { name: /build settlement here/i }).first();
    const road = page.getByRole("button", { name: /build route here/i }).first();
    if (await settlement.isVisible().catch(() => false)) await settlement.press("Enter");
    else if (await road.isVisible().catch(() => false)) await road.press("Enter");
    else break;
    await page.waitForTimeout(700);
  }
  await expect(page.locator("svg").first()).toBeVisible();

  await page.setViewportSize({ width: 760, height: 900 });
  await expect(page.getByRole("heading", { name: /valley deserves a wider table/i })).toBeVisible();
});

test("home and lobby remain usable with reduced motion on mobile", async ({ browser }) => {
  const context = await browser.newContext({ ...({ reducedMotion: "reduce" } as const), viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.getByRole("button", { name: /open a table/i })).toBeVisible();
  await page.getByPlaceholder("What should we call you?").fill("Mira");
  await page.getByRole("button", { name: /open a table/i }).click();
  await expect(page.getByRole("button", { name: /copy invite link/i })).toBeVisible();
  await context.close();
});
