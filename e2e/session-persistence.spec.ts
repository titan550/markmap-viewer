import { test, expect } from "@playwright/test";

test.describe("Session Persistence", () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing session data before navigating
    await page.goto("/");
    await page.evaluate(async () => {
      localStorage.removeItem("markmap-session");
      // Delete IndexedDB databases and wait
      await Promise.all([
        new Promise<void>((resolve) => {
          const req = indexedDB.deleteDatabase("markmap-session");
          req.onsuccess = () => resolve();
          req.onerror = () => resolve();
          req.onblocked = () => resolve();
        }),
        new Promise<void>((resolve) => {
          const req = indexedDB.deleteDatabase("markmap-history");
          req.onsuccess = () => resolve();
          req.onerror = () => resolve();
          req.onblocked = () => resolve();
        }),
      ]);
    });
    // Navigate again after clearing to start fresh
    await page.goto("/");
  });

  test("always shows overlay on fresh page load", async ({ page }) => {
    await page.waitForSelector("#paste", { state: "attached" });

    // Enter content and wait for session save
    const testMarkdown = "# Session Test\n\n- Item 1\n- Item 2";
    await page.fill("#paste", testMarkdown);
    await page.waitForTimeout(1500);

    // Force save
    await page.evaluate(() => {
      window.dispatchEvent(new Event("pagehide"));
    });
    await page.waitForTimeout(200);

    // Reload the page
    await page.reload();
    await page.waitForSelector("#paste", { state: "attached" });

    // Overlay should be visible (new design: always show landing page)
    const overlayVisible = await page.evaluate(() => {
      const overlay = document.querySelector("#overlay");
      return overlay && !overlay.classList.contains("hidden");
    });
    expect(overlayVisible).toBe(true);

    // Paste textarea should be empty on fresh load
    const content = await page.evaluate(() => {
      const paste = document.querySelector("#paste") as HTMLTextAreaElement;
      return paste?.value || "";
    });
    expect(content).toBe("");
  });

  test("clears session when reset button is clicked", async ({ page }) => {
    // The reset button is in the overlay
    await page.waitForSelector("#paste", { state: "attached" });
    await page.waitForSelector("#resetSession", { state: "visible" });

    // Set content directly without triggering input event (to avoid rendering)
    await page.evaluate((text) => {
      const paste = document.querySelector("#paste") as HTMLTextAreaElement;
      if (paste) paste.value = text;
    }, "# Reset Test");

    // Force save via pagehide
    await page.evaluate(() => {
      window.dispatchEvent(new Event("pagehide"));
    });
    await page.waitForTimeout(200);

    // Click reset button using force since SVG might be in the way
    await page.click("#resetSession", { force: true });

    // Verify content was cleared
    const content = await page.evaluate(() => {
      const paste = document.querySelector("#paste") as HTMLTextAreaElement;
      return paste?.value || "";
    });
    expect(content).toBe("");

    // Verify overlay is visible
    const overlayHidden = await page.evaluate(() => {
      const overlay = document.querySelector("#overlay");
      return overlay?.classList.contains("hidden");
    });
    expect(overlayHidden).toBe(false);
  });

  test("shows overlay when no session exists", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("#overlay", { state: "visible" });

    const overlayVisible = await page.evaluate(() => {
      const overlay = document.querySelector("#overlay");
      return overlay && !overlay.classList.contains("hidden");
    });

    expect(overlayVisible).toBe(true);
  });

  test("session saves on visibility change for bfcache recovery", async ({ page }) => {
    const testMarkdown = "# Visibility Test";

    await page.goto("/");
    await page.waitForSelector("#paste", { state: "attached" });

    // Enter content which triggers session save
    await page.fill("#paste", testMarkdown);

    // Wait for debounced save (1000ms + buffer)
    await page.waitForTimeout(1500);

    // Simulate visibility change to trigger immediate flush
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", {
        value: "hidden",
        writable: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForTimeout(200);

    // Check localStorage fallback contains the session
    // (SessionStore uses localStorage as fallback, and it's easier to check)
    const hasSession = await page.evaluate(() => {
      const session = localStorage.getItem("markmap-session");
      return session !== null && session.includes("Visibility Test");
    });

    // Session might be in IDB or localStorage - either is fine
    // Just verify some form of persistence happened by checking if we can read it
    expect(hasSession).toBe(true);
  });
});
