export function revokeBlobs(urls: string[] | null | undefined): void {
  if (!urls?.length) return;
  for (const url of urls) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      /* ignore revoke errors */
    }
  }
}

export function collectBlobUrls(text: string): string[] {
  const urls: string[] = [];
  const re = /src=['"](blob:[^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    urls.push(match[1]);
  }
  return urls;
}
