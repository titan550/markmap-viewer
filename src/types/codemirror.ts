export type CodeMirrorEditor = {
  getValue: () => string;
  setValue: (value: string) => void;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  refresh: () => void;
  focus: () => void;
  execCommand: (command: string) => void;
  replaceSelection: (value: string, mode?: string) => void;
};

export type CodeMirrorStatic = {
  fromTextArea: (el: HTMLTextAreaElement, opts: Record<string, unknown>) => CodeMirrorEditor;
};
