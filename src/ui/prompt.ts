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

function fallbackCopyText(text: string) {
  const temp = document.createElement("textarea");
  temp.value = text;
  temp.setAttribute("readonly", "");
  temp.style.position = "absolute";
  temp.style.left = "-9999px";
  document.body.appendChild(temp);
  temp.select();
  try { document.execCommand("copy"); } catch { /* ignore execCommand failures */ }
  document.body.removeChild(temp);
}

async function copyPromptToClipboard() {
  try {
    const promptMd = await loadPromptMd();
    await navigator.clipboard.writeText(promptMd);
    return true;
  } catch {
    fallbackCopyText(promptMd);
    return false;
  }
}

export function setupPrompt(copyPromptBtn: HTMLButtonElement) {
  copyPromptBtn.addEventListener("click", async () => {
    const original = copyPromptBtn.textContent;
    const ok = await copyPromptToClipboard();
    copyPromptBtn.textContent = ok ? "Copied" : "Copied (fallback)";
    setTimeout(() => { copyPromptBtn.textContent = original || "Copy Prompt"; }, 1200);
  });
}
