import { test, expect, Page } from "@playwright/test";

// Helper to save via keyboard shortcut and confirm in save modal
async function saveWithModal(page: Page): Promise<void> {
  const isMac = process.platform === "darwin";
  await page.keyboard.press(isMac ? "Meta+s" : "Control+s");
  await page.waitForSelector(".save-modal:not(.hidden)");
  await page.click("#saveConfirmBtn");
  await page.waitForSelector(".save-modal.hidden");
  await page.waitForTimeout(100);
}

test.describe("History Feature", () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing data before navigating
    await page.goto("/");
    await page.evaluate(async () => {
      localStorage.removeItem("markmap-session");
      // Delete both databases
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
    await page.waitForSelector("#paste", { state: "attached" });
  });

  test("saves and loads snapshot from history", async ({ page }) => {
    const testMarkdown = "# History Test\n\n- Item 1\n- Item 2";

    // Use keyboard shortcut to open history (works even when overlay is hidden)
    const isMac = process.platform === "darwin";
    await page.keyboard.press(isMac ? "Meta+Shift+o" : "Control+Shift+o");
    await page.waitForSelector(".history-modal:not(.hidden)");

    // Modal should show empty state initially
    await expect(page.locator(".history-empty")).toBeVisible();

    // Close modal
    await page.click("#closeHistory");
    await page.waitForSelector(".history-modal.hidden");

    // Enter markdown content via overlay textarea
    await page.fill("#paste", testMarkdown);

    // Wait for render to trigger (input debounce)
    await page.waitForTimeout(200);

    // Now save via keyboard shortcut and confirm in modal
    await saveWithModal(page);

    // Open history modal again with keyboard
    await page.keyboard.press(isMac ? "Meta+Shift+o" : "Control+Shift+o");
    await page.waitForSelector(".history-modal:not(.hidden)");

    // Should now have one item
    await expect(page.locator(".history-item")).toHaveCount(1);
    await expect(page.locator(".history-item-title")).toHaveText("History Test");

    // Close modal
    await page.click("#closeHistory");
  });

  test("opens history modal with keyboard shortcut", async ({ page }) => {
    // Use keyboard shortcut to open history
    const isMac = process.platform === "darwin";
    await page.keyboard.press(isMac ? "Meta+Shift+o" : "Control+Shift+o");

    // Modal should be visible
    await page.waitForSelector(".history-modal:not(.hidden)");
    await expect(page.locator("#historyTitle")).toHaveText("Saved Diagrams");

    // Close with Escape
    await page.keyboard.press("Escape");
    await page.waitForSelector(".history-modal.hidden");
  });

  test("loads snapshot from history", async ({ page }) => {
    const firstMarkdown = "# First Diagram\n\n- A\n- B";
    const secondMarkdown = "# Second Diagram\n\n- C\n- D";

    // Save first diagram
    await page.fill("#paste", firstMarkdown);
    await page.waitForTimeout(300);
    await saveWithModal(page);

    // After rendering, overlay is hidden. Open editor to change content
    await page.click("#toggleEditor");
    await page.waitForSelector("#editorPanel.visible");

    // Use CodeMirror to change content
    await page.evaluate((md) => {
      const wrapper = document.querySelector(".CodeMirror") as HTMLElement & {
        CodeMirror?: { setValue: (s: string) => void };
      };
      if (wrapper?.CodeMirror) {
        wrapper.CodeMirror.setValue(md);
      }
    }, secondMarkdown);

    await page.waitForTimeout(500);

    // Save second diagram
    await saveWithModal(page);

    // Open history
    const isMac = process.platform === "darwin";
    await page.keyboard.press(isMac ? "Meta+Shift+o" : "Control+Shift+o");
    await page.waitForSelector(".history-modal:not(.hidden)");

    // Should have 2 items
    await expect(page.locator(".history-item")).toHaveCount(2);

    // Click Load on the second item (First Diagram - older one at bottom)
    await page.locator(".history-item").nth(1).locator(".history-load-btn").click();

    // Modal should close
    await page.waitForSelector(".history-modal.hidden");

    // Content should be restored to first diagram (may have trailing newline from normalization)
    const content = await page.inputValue("#paste");
    expect(content.trim()).toBe(firstMarkdown.trim());
  });

  test("deletes snapshot from history", async ({ page }) => {
    const testMarkdown = "# Delete Test\n\n- Item";

    // Save a diagram
    await page.fill("#paste", testMarkdown);
    await page.waitForTimeout(200);
    await saveWithModal(page);

    // Open history
    const isMac = process.platform === "darwin";
    await page.keyboard.press(isMac ? "Meta+Shift+o" : "Control+Shift+o");
    await page.waitForSelector(".history-modal:not(.hidden)");
    await expect(page.locator(".history-item")).toHaveCount(1);

    // Set up dialog handler to accept delete confirmation
    page.on("dialog", (dialog) => dialog.accept());

    // Click Delete
    await page.click(".history-delete-btn");
    await page.waitForTimeout(100);

    // Item should be gone, empty state shown
    await expect(page.locator(".history-item")).toHaveCount(0);
    await expect(page.locator(".history-empty")).toBeVisible();
  });

  test("deduplicates identical content", async ({ page }) => {
    const testMarkdown = "# Dedupe Test\n\n- Same content";

    // Save the same content twice
    await page.fill("#paste", testMarkdown);
    await page.waitForTimeout(200);
    await saveWithModal(page);

    // Try to save again - should show "Already saved" since same content
    const isMac = process.platform === "darwin";
    await page.keyboard.press(isMac ? "Meta+s" : "Control+s");
    await page.waitForSelector(".save-modal:not(.hidden)");
    await page.click("#saveConfirmBtn");
    await page.waitForSelector(".save-modal.hidden");
    await page.waitForTimeout(100);

    // Open history
    await page.keyboard.press(isMac ? "Meta+Shift+o" : "Control+Shift+o");
    await page.waitForSelector(".history-modal:not(.hidden)");

    // Should still have only 1 item (deduplicated)
    await expect(page.locator(".history-item")).toHaveCount(1);
  });

  test("Save button in editor header works", async ({ page }) => {
    const testMarkdown = "# Editor Save Test\n\n- Content";

    // Fill content and hide overlay by rendering
    await page.fill("#paste", testMarkdown);
    await page.waitForTimeout(300);

    // Click toggle editor button to show editor
    await page.click("#toggleEditor");
    await page.waitForSelector("#editorPanel.visible");

    // Click Save button in editor header
    await page.click("#saveSnapshot");
    await page.waitForSelector(".save-modal:not(.hidden)");
    await page.click("#saveConfirmBtn");
    await page.waitForSelector(".save-modal.hidden");
    await page.waitForTimeout(100);

    // Click History button in editor header
    await page.click("#openHistory");
    await page.waitForSelector(".history-modal:not(.hidden)");

    // Should have 1 item
    await expect(page.locator(".history-item")).toHaveCount(1);
    await expect(page.locator(".history-item-title")).toHaveText("Editor Save Test");
  });

  test("closes modal on backdrop click", async ({ page }) => {
    // Open history
    await page.click("#openHistoryOverlay");
    await page.waitForSelector(".history-modal:not(.hidden)");

    // Click on backdrop (outside modal content)
    await page.click(".history-modal", { position: { x: 10, y: 10 } });

    // Modal should close
    await page.waitForSelector(".history-modal.hidden");
  });

  test("history persists across page reloads", async ({ page }) => {
    const testMarkdown = "# Persist Test\n\n- Survives reload";

    // Save a diagram
    await page.fill("#paste", testMarkdown);
    await page.waitForTimeout(200);
    await saveWithModal(page);

    // Reload the page
    await page.reload();
    await page.waitForSelector("#paste", { state: "attached" });
    await page.waitForTimeout(500);

    // Open history
    const isMac = process.platform === "darwin";
    await page.keyboard.press(isMac ? "Meta+Shift+o" : "Control+Shift+o");
    await page.waitForSelector(".history-modal:not(.hidden)");

    // Saved diagram should still be there
    await expect(page.locator(".history-item")).toHaveCount(1);
    await expect(page.locator(".history-item-title")).toHaveText("Persist Test");
  });

  test("pins and unpins a snapshot", async ({ page }) => {
    const testMarkdown = "# Pin Test\n\n- Item to pin";

    // Save a diagram
    await page.fill("#paste", testMarkdown);
    await page.waitForTimeout(200);
    await saveWithModal(page);

    // Open history
    const isMac = process.platform === "darwin";
    await page.keyboard.press(isMac ? "Meta+Shift+o" : "Control+Shift+o");
    await page.waitForSelector(".history-modal:not(.hidden)");

    // Pin button should exist and not be pinned
    const pinBtn = page.locator(".history-pin-btn");
    await expect(pinBtn).toBeVisible();
    await expect(pinBtn).not.toHaveClass(/pinned/);

    // Click pin button
    await pinBtn.click();
    await page.waitForTimeout(100);

    // Should now be pinned
    await expect(pinBtn).toHaveClass(/pinned/);

    // Item should show pinned indicator
    await expect(page.locator(".history-item")).toHaveClass(/pinned/);

    // Unpin it
    await pinBtn.click();
    await page.waitForTimeout(100);

    // Should no longer be pinned
    await expect(pinBtn).not.toHaveClass(/pinned/);
  });

  test("searches snapshots by title", async ({ page }) => {
    // Save two diagrams with different titles
    await page.fill("#paste", "# Apple Diagram\n\n- Fruit");
    await page.waitForTimeout(200);
    await saveWithModal(page);

    // Open editor and change content
    await page.click("#toggleEditor");
    await page.waitForSelector("#editorPanel.visible");
    await page.evaluate(() => {
      const wrapper = document.querySelector(".CodeMirror") as HTMLElement & {
        CodeMirror?: { setValue: (s: string) => void };
      };
      if (wrapper?.CodeMirror) {
        wrapper.CodeMirror.setValue("# Banana Diagram\n\n- Another fruit");
      }
    });
    await page.waitForTimeout(300);
    await saveWithModal(page);

    // Open history
    const isMac = process.platform === "darwin";
    await page.keyboard.press(isMac ? "Meta+Shift+o" : "Control+Shift+o");
    await page.waitForSelector(".history-modal:not(.hidden)");

    // Should have 2 items
    await expect(page.locator(".history-item")).toHaveCount(2);

    // Search for "Apple"
    await page.fill("#historySearch", "Apple");
    await page.waitForTimeout(200); // Wait for debounce

    // Should only show Apple diagram
    await expect(page.locator(".history-item")).toHaveCount(1);
    await expect(page.locator(".history-item-title")).toHaveText("Apple Diagram");

    // Clear search
    await page.fill("#historySearch", "");
    await page.waitForTimeout(200);

    // Should show both again
    await expect(page.locator(".history-item")).toHaveCount(2);
  });

  test("renames a snapshot by double-clicking title", async ({ page }) => {
    const testMarkdown = "# Original Title\n\n- Content";

    // Save a diagram
    await page.fill("#paste", testMarkdown);
    await page.waitForTimeout(200);
    await saveWithModal(page);

    // Open history
    const isMac = process.platform === "darwin";
    await page.keyboard.press(isMac ? "Meta+Shift+o" : "Control+Shift+o");
    await page.waitForSelector(".history-modal:not(.hidden)");

    // Verify original title
    await expect(page.locator(".history-item-title")).toHaveText("Original Title");

    // Double-click on title to edit
    await page.locator(".history-item-title").dblclick();
    await page.waitForTimeout(100);

    // Input should appear
    const input = page.locator(".history-item-title-input");
    await expect(input).toBeVisible();

    // Clear and type new title
    await input.fill("Renamed Title");
    await input.press("Enter");
    await page.waitForTimeout(100);

    // Title should be updated
    await expect(page.locator(".history-item-title")).toHaveText("Renamed Title");

    // Input should be gone
    await expect(input).not.toBeVisible();
  });

  test("pinned items appear first in list", async ({ page }) => {
    // Save three diagrams
    await page.fill("#paste", "# First\n\n- 1");
    await page.waitForTimeout(200);
    await saveWithModal(page);

    await page.click("#toggleEditor");
    await page.waitForSelector("#editorPanel.visible");

    await page.evaluate(() => {
      const wrapper = document.querySelector(".CodeMirror") as HTMLElement & {
        CodeMirror?: { setValue: (s: string) => void };
      };
      if (wrapper?.CodeMirror) wrapper.CodeMirror.setValue("# Second\n\n- 2");
    });
    await page.waitForTimeout(300);
    await saveWithModal(page);

    await page.evaluate(() => {
      const wrapper = document.querySelector(".CodeMirror") as HTMLElement & {
        CodeMirror?: { setValue: (s: string) => void };
      };
      if (wrapper?.CodeMirror) wrapper.CodeMirror.setValue("# Third\n\n- 3");
    });
    await page.waitForTimeout(300);
    await saveWithModal(page);

    // Open history
    const isMac = process.platform === "darwin";
    await page.keyboard.press(isMac ? "Meta+Shift+o" : "Control+Shift+o");
    await page.waitForSelector(".history-modal:not(.hidden)");

    // Should have 3 items, newest first
    await expect(page.locator(".history-item")).toHaveCount(3);
    await expect(page.locator(".history-item-title").nth(0)).toHaveText("Third");
    await expect(page.locator(".history-item-title").nth(1)).toHaveText("Second");
    await expect(page.locator(".history-item-title").nth(2)).toHaveText("First");

    // Pin the "First" item (last in list)
    await page.locator(".history-item").nth(2).locator(".history-pin-btn").click();
    await page.waitForTimeout(100);

    // Now "First" should be at the top (pinned items first)
    await expect(page.locator(".history-item-title").nth(0)).toHaveText("First");
    await expect(page.locator(".history-item").nth(0)).toHaveClass(/pinned/);
  });

  test("save modal allows custom title", async ({ page }) => {
    const testMarkdown = "# Auto Title\n\n- Content";

    // Fill content
    await page.fill("#paste", testMarkdown);
    await page.waitForTimeout(200);

    // Open save modal
    const isMac = process.platform === "darwin";
    await page.keyboard.press(isMac ? "Meta+s" : "Control+s");
    await page.waitForSelector(".save-modal:not(.hidden)");

    // Title should be pre-filled with auto-extracted title
    await expect(page.locator("#saveTitle")).toHaveValue("Auto Title");

    // Change to custom title
    await page.fill("#saveTitle", "My Custom Title");
    await page.click("#saveConfirmBtn");
    await page.waitForSelector(".save-modal.hidden");
    await page.waitForTimeout(100);

    // Open history and verify custom title was saved
    await page.keyboard.press(isMac ? "Meta+Shift+o" : "Control+Shift+o");
    await page.waitForSelector(".history-modal:not(.hidden)");

    await expect(page.locator(".history-item-title")).toHaveText("My Custom Title");
  });
});
