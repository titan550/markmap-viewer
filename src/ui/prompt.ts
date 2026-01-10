let promptCache: Promise<string> | null = null;

async function loadPromptMd(): Promise<string> {
  if (!promptCache) {
    const base = import.meta.env.BASE_URL || "/";
    promptCache = fetch(`${base}prompt.md`).then(async (res) => {
      if (!res.ok) {
        throw new Error(`Failed to load prompt.md: ${res.status}`);
      }
      return await res.text();
    });
  }
  return promptCache;
}

async function copyPromptToClipboard(): Promise<boolean> {
  return loadPromptMd()
    .then((promptMd) => navigator.clipboard.writeText(promptMd))
    .then(() => true)
    .catch(() => false);
}

export function setupPrompt(copyPromptBtn: HTMLButtonElement): void {
  copyPromptBtn.addEventListener("click", async () => {
    const original = copyPromptBtn.textContent;
    const ok = await copyPromptToClipboard();
    copyPromptBtn.textContent = ok ? "Copied" : "Copy failed";
    setTimeout(() => { copyPromptBtn.textContent = original || "Copy Prompt"; }, 1200);
  });
}

loadPromptMd();
