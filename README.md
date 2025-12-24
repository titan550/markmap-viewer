# Paste → Markmap

Instant markdown to mindmap converter. Paste anywhere, see it visualized.

**Live demo:** https://titan550.github.io/markmap-viewer/

## Features

- **Paste anywhere** — works on desktop and mobile
- **Live rendering** — updates as you type
- **Auto-fit** — automatically scales to fit viewport
- **Dark mode** — respects system preference
- **Zero dependencies** — single HTML file, runs entirely in browser

## Usage

1. Open the page
2. Paste markdown (or tap textarea on mobile)
3. Watch it render as an interactive mindmap

Works best with headings and lists:

```markdown
# Main Topic
## Subtopic 1
- Point A
- Point B
## Subtopic 2
- Point C
```

## Tech Stack

- [markmap](https://markmap.js.org/) — markdown to mindmap transformer
- [D3.js](https://d3js.org/) — visualization
- Vanilla JS — no build step

## License

MIT
