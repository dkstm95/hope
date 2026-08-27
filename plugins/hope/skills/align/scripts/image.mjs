import { inflateSync } from "node:zlib";

export const IMAGE_MAXIMUM_BYTES = 512 * 1024;

const IMAGE_MAXIMUM_EDGE = 4_096;
const IMAGE_MAXIMUM_PIXELS = 8_000_000;

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertKeys(value, allowed, path) {
  const extras = Object.keys(value).filter((key) => !allowed.includes(key));
  if (extras.length > 0) {
    throw new TypeError(`${path} contains unsupported field: ${extras[0]}`);
  }
}

function crc32(...chunks) {
  let checksum = 0xffffffff;
  for (const bytes of chunks) {
    for (const byte of bytes) {
      checksum ^= byte;
      for (let bit = 0; bit < 8; bit += 1) {
        checksum = (checksum >>> 1) ^ (checksum & 1 ? 0xedb88320 : 0);
      }
    }
  }
  return (checksum ^ 0xffffffff) >>> 0;
}

function assertImageDimensions(width, height, label) {
  if (
    width <= 0
    || height <= 0
    || width > IMAGE_MAXIMUM_EDGE
    || height > IMAGE_MAXIMUM_EDGE
    || width * height > IMAGE_MAXIMUM_PIXELS
  ) {
    throw new Error(`${label} exceeds the supported image dimensions`);
  }
}

function pngImage(bytes, label) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (bytes.length < 8 || !bytes.subarray(0, 8).equals(signature)) {
    throw new Error(`${label} must be a PNG image`);
  }
  let offset = 8;
  let header;
  let paletteEntries = 0;
  let sawPalette = false;
  let sawImageData = false;
  let endedImageData = false;
  let sawEnd = false;
  const imageData = [];
  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) throw new Error("PNG image has a truncated chunk");
    const length = bytes.readUInt32BE(offset);
    const chunkEnd = offset + 12 + length;
    if (chunkEnd > bytes.length) throw new Error("PNG image has a truncated chunk");
    const typeBytes = bytes.subarray(offset + 4, offset + 8);
    const type = typeBytes.toString("ascii");
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    const recordedChecksum = bytes.readUInt32BE(offset + 8 + length);
    if (crc32(typeBytes, data) !== recordedChecksum) {
      throw new Error(`PNG image has an invalid ${type} checksum`);
    }
    if (!header && type !== "IHDR") throw new Error("PNG image must start with IHDR");
    if (type === "IHDR") {
      if (header || length !== 13) throw new Error("PNG image has an invalid IHDR chunk");
      const width = data.readUInt32BE(0);
      const height = data.readUInt32BE(4);
      const bitDepth = data[8];
      const colorType = data[9];
      const allowedDepths = new Map([
        [0, [1, 2, 4, 8, 16]],
        [2, [8, 16]],
        [3, [1, 2, 4, 8]],
        [4, [8, 16]],
        [6, [8, 16]],
      ]);
      if (
        !allowedDepths.get(colorType)?.includes(bitDepth)
        || data[10] !== 0
        || data[11] !== 0
        || data[12] !== 0
      ) {
        throw new Error("PNG image uses an unsupported encoding");
      }
      assertImageDimensions(width, height, label);
      header = { bitDepth, colorType, height, width };
    } else if (type === "PLTE") {
      if (sawPalette || sawImageData || length === 0 || length % 3 !== 0 || length > 768) {
        throw new Error("PNG image has an invalid palette");
      }
      sawPalette = true;
      paletteEntries = length / 3;
    } else if (type === "IDAT") {
      if (endedImageData) throw new Error("PNG image has non-consecutive image data");
      if (header.colorType === 3 && !sawPalette) {
        throw new Error("Indexed PNG image has no palette");
      }
      sawImageData = true;
      imageData.push(data);
    } else if (type === "IEND") {
      if (!sawImageData || length !== 0 || chunkEnd !== bytes.length) {
        throw new Error("PNG image has an invalid end chunk");
      }
      sawEnd = true;
    } else {
      if (sawImageData) endedImageData = true;
      if ((typeBytes[0] & 0x20) === 0) {
        throw new Error(`PNG image has unsupported critical chunk ${type}`);
      }
      if (type === "tRNS") {
        const validTransparency = (
          (header.colorType === 0 && length === 2)
          || (header.colorType === 2 && length === 6)
          || (header.colorType === 3 && sawPalette && length <= paletteEntries)
        );
        if (!validTransparency || sawImageData) {
          throw new Error("PNG image has invalid transparency data");
        }
      }
    }
    offset = chunkEnd;
    if (sawEnd) break;
  }
  if (!header || !sawEnd) throw new Error("PNG image is incomplete");
  const channels = new Map([[0, 1], [2, 3], [3, 1], [4, 2], [6, 4]]).get(header.colorType);
  const rowBytes = Math.ceil((header.width * channels * header.bitDepth) / 8);
  const expectedBytes = header.height * (rowBytes + 1);
  let pixels;
  try {
    pixels = inflateSync(Buffer.concat(imageData), { maxOutputLength: expectedBytes + 1 });
  } catch (error) {
    throw new Error("PNG image data cannot be decoded", { cause: error });
  }
  if (pixels.length !== expectedBytes) throw new Error("PNG image data has the wrong length");
  for (let row = 0; row < header.height; row += 1) {
    if (pixels[row * (rowBytes + 1)] > 4) throw new Error("PNG image uses an invalid row filter");
  }
  return Object.freeze({ mimeType: "image/png", width: header.width, height: header.height });
}

export function rasterImage(bytes, label) {
  try {
    return pngImage(bytes, label);
  } catch (error) {
    if (error.message.startsWith(`${label} `)) throw error;
    throw new Error(`${label} is not a valid PNG image`, { cause: error });
  }
}

export function embeddedImage(value, path) {
  if (!isRecord(value)) throw new TypeError(`${path} must be an object`);
  assertKeys(value, ["mimeType", "width", "height", "data"], path);
  if (typeof value.data !== "string" || !/^[A-Za-z0-9+/]*={0,2}$/u.test(value.data)) {
    throw new TypeError(`${path}.data must be canonical base64`);
  }
  const bytes = Buffer.from(value.data, "base64");
  if (bytes.toString("base64") !== value.data || bytes.length > IMAGE_MAXIMUM_BYTES) {
    throw new TypeError(`${path}.data must be bounded canonical base64`);
  }
  const image = rasterImage(bytes, path);
  if (
    image.mimeType !== value.mimeType
    || image.width !== value.width
    || image.height !== value.height
  ) {
    throw new TypeError(`${path} metadata does not match its image bytes`);
  }
  return Object.freeze({ ...image, data: value.data });
}
