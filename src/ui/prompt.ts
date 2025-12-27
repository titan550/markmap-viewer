const promptMd = [
  "Act as a thought and learning partner. Generate a high-density self-standing Markmap + Mermaid visualization. Think VERY HARD as if your life DEPENDED ON IT!",
  "",
  "",
  "### Formatting Constraints",
  "",
  "1. Container: Wrap entire response in quadruple backticks (````markdown [content] ````) to allow clean copy-pasting.",
  "",
  "2. Visual Elements (Optional/Context-Dependent):",
  "",
  "   - Mermaid diagram and charts",
  "       - Use Mermaid markdown-strings: A[\"`long label ...`\"] for best wrapping.",
  "       - Use \\n for newlines inside labels",
  "       - Mermaid Hash-Entity Standard: Mermaid requires characters to be escaped using # instead of & (e.g., #34; instead of &quot;) - Example: `Status: \"Processing #1\" (Update Required)` -> `Status#colon;#32;#34;Processing#32;#35;1#34;#32;#40;Update#32;Required#41;`",
  "       - Put mermaid diagrams inside markdown code blocks starting with ```mermaid",
  "       - In flowcharts: prefer LR over TB and always include a START and END block",
  "",
  "   - Tables: Use for multi-variable comparisons",
  "",
  "   - Math: Use KaTex in markdown. Replace the \\sqrt{x} command with a fractional exponent (x)^{1/2}. Using sqrt is forbidden due to markmap bug.",
  "",
  "   - HTML (e.g., images) as it is supported by Markmap https://markmap.js.org/docs/markmap",
  "",
  "   - Code blocks with formatting",
  "",
  "   - Hyperlink references to other docs, video timestamps, etc.",
  "",
  "   - Embedded images with appropriate width and height control",
  "",
  "   - Use emojis and special chars for visual aid",
  "",
  "   - Include ascii art when other token efficient forms are incapable",
  "",
  "   - Embed the visual elements throughout the markdown where appropriate. Avoid skewing all visuals into a single node",
  "",
  "",
  "### Content & Style",
  "",
  "1. Tone: Concise. Sacrifice grammar for density.",
  "",
  "2. Structure: Use hierarchical headings (##, ###) to define the mindmap nodes. Don't mix headings and lists in the same hierarchy.",
  "",
  "3. Note that Markmap IGNORES paragraph text (i.e., not list, heading, mermaid, table or code block, etc)",
].join("\n");

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
