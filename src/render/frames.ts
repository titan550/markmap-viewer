export const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

export const nextFrames = async (n: number) => {
  for (let i = 0; i < n; i++) await nextFrame();
};
