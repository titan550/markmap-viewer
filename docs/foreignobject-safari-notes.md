# Safari foreignObject constraints (Markmap, Mermaid, Math)

We target Safari/WebKit stability. The core issue is long‑standing bugs in how `<foreignObject>` is positioned and transformed inside SVG. This affects any HTML embedded in SVG, regardless of whether it originates from Markmap or Mermaid.

## Why this matters even with SVG images

We render Mermaid blocks to SVG images before feeding Markdown to Markmap. That avoids nested SVG/HTML inside Markmap nodes, but it does **not** eliminate foreignObject risks in two places:

1. **Mermaid can emit `<foreignObject>` inside its own SVG** when `htmlLabels: true`. Safari can mis‑position these, so labels render at `(0,0)` or disappear. We therefore set `htmlLabels: false` (and `flowchart.htmlLabels: false`).

2. **Markmap uses `<foreignObject>` for node labels**. Any HTML inside labels (math, inline HTML, embedded images) is still rendered via foreignObject. We minimize HTML by pre‑rendering complex content to images and by keeping labels as plain text when possible.

## Design choices

- **Mermaid**: pre‑render to SVG; disable htmlLabels to avoid foreignObject in Mermaid output.
- **Math**: pre‑render to images (SVG/PNG) and inject `<img>` into Markdown so Markmap lays out images rather than HTML.
- **Labels**: sanitize Mermaid labels to be parser‑safe while preserving display characters; use markdown strings when safe and avoid entity litter in output.

## Sanitization strategy (Mermaid)

Labels are parsed as syntax, not raw text. We use a context‑aware sanitizer:

- **Markdown‑string labels** (backtick‑wrapped) are preferred for wrapping. In this mode, only backticks and control characters are escaped; Unicode characters are left intact so symbols like `↑` render correctly.
- **Plain labels** encode syntax‑sensitive characters as Mermaid entities (`#<codepoint>;`).
- Existing entities are preserved to avoid double‑encoding.

This minimizes parse failures while keeping output readable.

## Outcome

- **Single code path** for Safari + Chrome.
- **No nested foreignObject in Mermaid SVG**.
- **Stable label rendering** across browsers.
