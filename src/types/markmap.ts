export type MarkmapTransformer = {
  transform: (md: string) => { root: unknown };
  md?: {
    renderInline?: (text: string) => string;
  };
};

export type MarkmapInstance = {
  setData: (root: unknown) => void | Promise<void>;
  fit: () => void;
};

export type MarkmapToolbar = {
  attach: (mm: MarkmapInstance) => void;
  render: () => HTMLElement;
};

export type MarkmapAPI = {
  Transformer: new () => MarkmapTransformer;
  Markmap: {
    create: (svg: SVGSVGElement) => MarkmapInstance;
  };
  Toolbar: new () => MarkmapToolbar;
};
