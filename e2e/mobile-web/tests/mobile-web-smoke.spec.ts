import { expect, test } from "@playwright/test";

test.describe("GRIDGO mobile web smoke", () => {
  test("loads the Flutter web shell and reaches the auth flow without runtime errors", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(message.text());
      }
    });
    page.on("pageerror", (error) => {
      consoleErrors.push(error.message);
    });

    await page.goto("/");
    await expect(page).toHaveTitle("GRIDGO");

    const semanticsPlaceholder = page.locator("flt-semantics-placeholder");
    await expect(semanticsPlaceholder).toHaveCount(1);
    await semanticsPlaceholder.evaluate((element) => {
      element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await expect(page).toHaveURL(/#\/auth\/login$/);
    await expect(page.locator("body")).toContainText("Welcome back");
    await expect(page.locator("body")).toContainText("Sign In");

    const emailInput = page.locator('input[aria-label="you@example.com"]');
    const passwordInput = page.locator('input[aria-label="Enter your password"]');
    await expect(emailInput).toHaveCount(1);
    await expect(passwordInput).toHaveAttribute("type", "password");

    await page.getByRole("switch", { name: /Show password/ }).evaluate((element) => {
      element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await expect(passwordInput).toHaveAttribute("type", "text");

    const relevantErrors = consoleErrors.filter(
      (message) =>
        !message.includes("Failed to load resource") &&
        !message.includes("ERR_CONNECTION_REFUSED"),
    );
    expect(relevantErrors).toEqual([]);
  });
});
