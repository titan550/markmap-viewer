let promptCache: Promise<string> | null = null;

async function loadPromptMd() {
  if (!promptCache) {
    promptCache = fetch("/prompt.md").then(async (res) => {
      if (!res.ok) {
        throw new Error(`Failed to load prompt.md: ${res.status}`);
      }
      return await res.text();
    });
  }
  return promptCache;
}

async function copyPromptToClipboard() {
  try {
    const promptMd = await loadPromptMd();
    await navigator.clipboard.writeText(promptMd);
    return true;
  } catch {
    return false;
  }
}

export function setupPrompt(copyPromptBtn: HTMLButtonElement) {
  copyPromptBtn.addEventListener("click", async () => {
    const original = copyPromptBtn.textContent;
    const ok = await copyPromptToClipboard();
    copyPromptBtn.textContent = ok ? "Copied" : "Copy failed";
    setTimeout(() => { copyPromptBtn.textContent = original || "Copy Prompt"; }, 1200);
  });
}
