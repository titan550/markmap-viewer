export type PrismLanguage = {
  [key: string]: unknown;
};

export type PrismAutoloader = {
  languages_path?: string;
};

export type PrismAPI = {
  manual?: boolean;
  highlightAll: () => void;
  highlightAllUnder: (element: Element) => void;
  highlight: (text: string, grammar: PrismLanguage, language: string) => string;
  languages: Record<string, PrismLanguage>;
  plugins?: {
    autoloader?: PrismAutoloader;
  };
};

declare global {
  interface Window {
    Prism?: PrismAPI;
  }
}
