import { sanitizeSvgForXml } from "../core/svgSanitize";

export function getRasterScale(): number {
  const dpr = window.devicePixelRatio || 1;
  return Math.max(1, Math.min(2, dpr));
}

export async function preloadImages(urls: string[], shouldContinue: () => boolean): Promise<void> {
  if (!urls?.length) return;
  for (const url of urls) {
    if (!shouldContinue()) return;
    await new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => resolve();
      img.src = url;
    });
  }
}

export async function waitForDomImages(root: ParentNode, shouldContinue: () => boolean): Promise<void> {
  if (!root) return;
  const imgs = Array.from(root.querySelectorAll("img"));
  if (!imgs.length) return;
  await Promise.all(
    imgs.map((img) => {
      if (!shouldContinue()) return Promise.resolve();
      if (img.complete) return Promise.resolve();
      if (img.decode) {
        return img.decode().catch(() => undefined);
      }
      return new Promise<void>((resolve) => {
        const done = () => {
          img.removeEventListener("load", done);
          img.removeEventListener("error", done);
          resolve();
        };
        img.addEventListener("load", done);
        img.addEventListener("error", done);
      });
    })
  );
}

export async function svgToPngBlob(svgText: string, width: number, height: number, scale = 1): Promise<Blob> {
  const svgBlob = new Blob([sanitizeSvgForXml(svgText)], { type: "image/svg+xml" });
  const url = URL.createObjectURL(svgBlob);
  try {
    const img = new Image();
    img.decoding = "async";
    const loadPromise = new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = (err) => reject(err);
    });
    img.src = url;
    if (img.decode) {
      await img.decode().catch(() => loadPromise);
    } else {
      await loadPromise;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.ceil(width * scale));
    canvas.height = Math.max(1, Math.ceil(height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not available");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas PNG export failed"));
      }, "image/png");
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
