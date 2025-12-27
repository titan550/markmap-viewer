# Paste → Markmap

Instant markdown to mindmap converter. Paste anywhere, see it visualized.

**Live demo:** https://titan550.github.io/markmap-viewer/

## Features

- **Paste anywhere** — works on desktop and mobile
- **Live rendering** — updates as you type
- **Auto-fit** — automatically scales to fit viewport
- **Diagrams** — Mermaid, Graphviz (DOT), WaveDrom, Vega-Lite
- **Math** — LaTeX via MathJax (rendered to images for Safari stability)
- **Client-only** — static assets, CDN dependencies, no server required

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

## Development

```bash
npm install
npm run dev
```

```bash
npm run test
npm run test:coverage
npm run test:e2e
npm run lint
npm run build
npm run preview
```

## Tech Stack

- [markmap](https://markmap.js.org/) — markdown to mindmap transformer
- [D3.js](https://d3js.org/) — visualization
- [Mermaid](https://mermaid.js.org/) — diagrams
- [Viz.js](https://viz-js.com/) — Graphviz/DOT
- [WaveDrom](https://wavedrom.com/) — timing diagrams
- [Vega-Lite](https://vega.github.io/vega-lite/) — charts
- [MathJax](https://www.mathjax.org/) — LaTeX
- Vite + TypeScript

## Notes

- Safari/WebKit foreignObject constraints and the rendering choices: `docs/foreignobject-safari-notes.md`

## License

MIT
