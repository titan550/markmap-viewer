export function setupExampleButton(
  exampleBtn: HTMLButtonElement,
  pasteEl: HTMLTextAreaElement,
  onRender: (mdText: string) => void
) {
  exampleBtn.addEventListener("click", () => {
    const mdText = [
      "# Renderers Test",
      "",
      "## Nested list (must stay nested)",
      "- Parent node",
      "    - DOT child",
      "      ```dot",
      "      digraph G { rankdir=LR; A -> B -> C; }",
      "      ```",
      "    - WaveDrom child",
      "      ```wavedrom",
      "      { signal: [",
      "        { name: \"clk\", wave: \"p.....\" },",
      "        { name: \"req\", wave: \"01..0.\" },",
      "        { name: \"ack\", wave: \"0.1..0\" }",
      "      ], head: { text: \"join late data timeline\", tick: 0, every: 2 } }",
      "      ```",
      "    - Vega-Lite SVG child",
      "      ```vega-lite",
      "      {",
      "        \"$schema\": \"https://vega.github.io/schema/vega-lite/v6.json\",",
      "        \"width\": 260,",
      "        \"height\": 160,",
      "        \"data\": { \"values\": [",
      "          {\"k\":\"A\",\"v\":28}, {\"k\":\"B\",\"v\":55}, {\"k\":\"C\",\"v\":43}",
      "        ]},",
      "        \"mark\": \"bar\",",
      "        \"encoding\": {",
      "          \"x\": {\"field\":\"k\",\"type\":\"nominal\"},",
      "          \"y\": {\"field\":\"v\",\"type\":\"quantitative\"}",
      "        }",
      "      }",
      "      ```",
      "",
      "## Mermaid baseline",
      "```mermaid",
      "flowchart LR",
      "  A[\"`hello`\"] --> B[\"`world`\"]",
      "```",
    ].join("\n");
    pasteEl.value = mdText;
    onRender(mdText);
  });
}
