import { test, expect } from "@playwright/test";

test.describe("Session Persistence", () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing session data before navigating
    await page.goto("/");
    await page.evaluate(async () => {
      localStorage.removeItem("markmap-session");
      // Delete IndexedDB and wait for it
      await new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase("markmap-session");
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        req.onblocked = () => resolve();
      });
    });
    // Navigate again after clearing to start fresh
    await page.goto("/");
  });

  test("restores content after page reload", async ({ page }) => {
    const testMarkdown = "# Session Test\n\n- Item 1\n- Item 2";

    await page.waitForSelector("#paste", { state: "attached" });

    // Enter markdown content
    await page.evaluate((text) => {
      const paste = document.querySelector("#paste") as HTMLTextAreaElement;
      if (!paste) return;
      paste.value = text;
      paste.dispatchEvent(new Event("input", { bubbles: true }));
    }, testMarkdown);

    // Wait for debounced session save (1000ms + buffer)
    await page.waitForTimeout(1500);

    // Trigger pagehide event to force immediate save (more reliable than visibilitychange)
    await page.evaluate(() => {
      window.dispatchEvent(new Event("pagehide"));
    });
    await page.waitForTimeout(200);

    // Reload the page
    await page.reload();
    await page.waitForSelector("#paste", { state: "attached" });

    // Wait for session restore (load event + async IDB read)
    await page.waitForTimeout(1000);

    // Verify content was restored
    const restoredContent = await page.evaluate(() => {
      const paste = document.querySelector("#paste") as HTMLTextAreaElement;
      return paste?.value || "";
    });

    expect(restoredContent).toBe(testMarkdown);

    // Verify overlay is hidden (content was restored)
    const overlayHidden = await page.evaluate(() => {
      const overlay = document.querySelector("#overlay");
      return overlay?.classList.contains("hidden");
    });

    expect(overlayHidden).toBe(true);
  });

  test("clears session when reset button is clicked", async ({ page }) => {
    // The reset button is in the overlay, which is visible on initial load
    await page.waitForSelector("#paste", { state: "attached" });
    await page.waitForSelector("#resetSession", { state: "visible" });

    // First, create a session by entering content
    const testMarkdown = "# Reset Test";
    await page.evaluate((text) => {
      const paste = document.querySelector("#paste") as HTMLTextAreaElement;
      if (!paste) return;
      paste.value = text;
      paste.dispatchEvent(new Event("input", { bubbles: true }));
    }, testMarkdown);

    // Wait for session save
    await page.waitForTimeout(1500);

    // Force save
    await page.evaluate(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForTimeout(100);

    // Reload to verify session was saved
    await page.reload();
    await page.waitForSelector("#paste", { state: "attached" });
    await page.waitForTimeout(1000);

    // At this point, overlay should be hidden (session restored)
    // We need to make overlay visible to click reset
    await page.evaluate(() => {
      const overlay = document.querySelector("#overlay");
      overlay?.classList.remove("hidden");
    });

    // Now click reset button
    await page.click("#resetSession");

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

    // Reload and verify session was cleared
    await page.reload();
    await page.waitForSelector("#paste", { state: "attached" });
    await page.waitForTimeout(500);

    const restoredContent = await page.evaluate(() => {
      const paste = document.querySelector("#paste") as HTMLTextAreaElement;
      return paste?.value || "";
    });

    expect(restoredContent).toBe("");
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

  test("session saves on visibility change", async ({ page }) => {
    const testMarkdown = "# Visibility Test";

    await page.goto("/");
    await page.waitForSelector("#paste", { state: "attached" });

    // Enter markdown content
    await page.evaluate((text) => {
      const paste = document.querySelector("#paste") as HTMLTextAreaElement;
      if (!paste) return;
      paste.value = text;
      paste.dispatchEvent(new Event("input", { bubbles: true }));
    }, testMarkdown);

    // Simulate visibility change (tab switch)
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", {
        value: "hidden",
        writable: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });

    // Small delay for async save
    await page.waitForTimeout(100);

    // Reload and verify content was saved
    await page.reload();
    await page.waitForSelector("#paste", { state: "attached" });
    await page.waitForTimeout(500);

    const restoredContent = await page.evaluate(() => {
      const paste = document.querySelector("#paste") as HTMLTextAreaElement;
      return paste?.value || "";
    });

    expect(restoredContent).toBe(testMarkdown);
  });
});
