export function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

export async function nextFrames(n: number): Promise<void> {
  for (let i = 0; i < n; i += 1) {
    await nextFrame();
  }
}
