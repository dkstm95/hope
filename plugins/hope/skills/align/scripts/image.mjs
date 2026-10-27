import { lstat, readFile } from "node:fs/promises";

export const IMAGE_MAXIMUM_BYTES = 512 * 1024;
export const IMAGE_TOTAL_MAXIMUM_BYTES = 1024 * 1024;

const IMAGE_MAXIMUM_EDGE = 4_096;
const IMAGE_MAXIMUM_PIXELS = 8_000_000;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * Check what the renderer relies on: a PNG signature and an IHDR header whose
 * dimensions stay within the limits. The browser decodes the rest.
 */
export function pngImage(bytes, label) {
  if (bytes.length > IMAGE_MAXIMUM_BYTES) {
    throw new Error(`${label} exceeds ${IMAGE_MAXIMUM_BYTES} bytes`);
  }
  if (
    bytes.length < 33
    || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)
    || bytes.readUInt32BE(8) !== 13
    || bytes.toString("ascii", 12, 16) !== "IHDR"
  ) {
    throw new Error(`${label} must be a PNG image`);
  }
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (
    width === 0
    || height === 0
    || width > IMAGE_MAXIMUM_EDGE
    || height > IMAGE_MAXIMUM_EDGE
    || width * height > IMAGE_MAXIMUM_PIXELS
  ) {
    throw new Error(`${label} exceeds the supported image dimensions`);
  }
  return Object.freeze({ mimeType: "image/png", width, height });
}

/** Read design-direction PNGs from absolute paths and enforce the total size. */
export async function readPngImages(paths) {
  let totalBytes = 0;
  const images = [];
  for (const [index, path] of paths.entries()) {
    const label = `Design direction image ${index + 1}`;
    const info = await lstat(path);
    if (!info.isFile()) throw new Error(`${label} must be a regular file`);
    if (info.size > IMAGE_MAXIMUM_BYTES) {
      throw new Error(`${label} exceeds ${IMAGE_MAXIMUM_BYTES} bytes`);
    }
    const bytes = await readFile(path);
    totalBytes += bytes.length;
    if (totalBytes > IMAGE_TOTAL_MAXIMUM_BYTES) {
      throw new Error(`Design direction images exceed ${IMAGE_TOTAL_MAXIMUM_BYTES} bytes`);
    }
    images.push(Object.freeze({ ...pngImage(bytes, label), data: bytes.toString("base64") }));
  }
  return Object.freeze(images);
}
