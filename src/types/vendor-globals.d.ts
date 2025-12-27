import type { MarkmapAPI } from "./markmap";
import type { CodeMirrorStatic } from "./codemirror";
import type {
  JSON5Global,
  MathJaxAPI,
  MermaidAPI,
  TurndownConstructor,
  VegaEmbedFn,
  VizGlobal,
  WaveDromGlobal,
} from "./vendors";

declare global {
  interface Window {
    markmap?: MarkmapAPI;
    mermaid?: MermaidAPI;
    MathJax?: MathJaxAPI;
    TurndownService?: TurndownConstructor;
    Viz?: VizGlobal;
    WaveDrom?: WaveDromGlobal;
    vegaEmbed?: VegaEmbedFn;
    JSON5?: JSON5Global;
    CodeMirror?: CodeMirrorStatic;
  }
}

export {};
