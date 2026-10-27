const MAX_SIDE = 2048;

/** Reads a picked photo, scaling it down to MAX_SIDE so phone photos don't fill the browser's storage. */
export async function prepareImage(file: File): Promise<{ blob: Blob; w: number; h: number }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    if (scale === 1) return { blob: file, w, h };
    const canvas = new OffscreenCanvas(w, h);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, w, h);
    return { blob: await canvas.convertToBlob({ type: "image/jpeg", quality: 0.85 }), w, h };
  } finally {
    bitmap.close();
  }
}
