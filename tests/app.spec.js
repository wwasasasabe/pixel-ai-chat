import { expect, test } from "@playwright/test";

test("renders the open-source chat template", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Chat Room" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Chat" })).toBeVisible();
  await expect(page.getByRole("button", { name: "API" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "" }).first()).toBeVisible();
  await expect(page.frameLocator(".companion-frame").locator("#companion")).toBeVisible();
});

