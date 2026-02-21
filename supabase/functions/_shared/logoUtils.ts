// Shared logo utility for PDF embedding
// Fetches the logo PNG and returns raw RGB data for PDF Image XObject

const LOGO_URL = "https://awdysfgjmhnqwsoyhbah.supabase.co/storage/v1/object/public/media/logo.png";

interface LogoData {
  width: number;
  height: number;
  rgbHex: string; // hex-encoded RGB stream for PDF
}

export async function fetchLogoPngData(): Promise<LogoData | null> {
  try {
    const res = await fetch(LOGO_URL, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());

    // Verify PNG signature
    const sig = [137, 80, 78, 71, 13, 10, 26, 10];
    for (let i = 0; i < 8; i++) {
      if (buf[i] !== sig[i]) return null;
    }

    // Read IHDR
    const ihdrLen = readU32(buf, 8);
    const ihdrType = String.fromCharCode(buf[12], buf[13], buf[14], buf[15]);
    if (ihdrType !== "IHDR" || ihdrLen < 13) return null;
    const width = readU32(buf, 16);
    const height = readU32(buf, 20);
    const bitDepth = buf[24];
    const colorType = buf[25];

    if (bitDepth !== 8) return null; // only support 8-bit

    // Collect IDAT chunks
    const idatChunks: Uint8Array[] = [];
    let offset = 8;
    while (offset < buf.length - 4) {
      const chunkLen = readU32(buf, offset);
      const chunkType = String.fromCharCode(buf[offset + 4], buf[offset + 5], buf[offset + 6], buf[offset + 7]);
      if (chunkType === "IDAT") {
        idatChunks.push(buf.slice(offset + 8, offset + 8 + chunkLen));
      }
      if (chunkType === "IEND") break;
      offset += 12 + chunkLen;
    }

    if (idatChunks.length === 0) return null;

    // Concatenate and decompress
    const totalLen = idatChunks.reduce((s, c) => s + c.length, 0);
    const compressed = new Uint8Array(totalLen);
    let pos = 0;
    for (const chunk of idatChunks) {
      compressed.set(chunk, pos);
      pos += chunk.length;
    }

    const ds = new DecompressionStream("deflate");
    const writer = ds.writable.getWriter();
    const reader = ds.readable.getReader();

    writer.write(compressed);
    writer.close();

    const decompressedChunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      decompressedChunks.push(value);
    }

    const rawLen = decompressedChunks.reduce((s, c) => s + c.length, 0);
    const raw = new Uint8Array(rawLen);
    pos = 0;
    for (const c of decompressedChunks) {
      raw.set(c, pos);
      pos += c.length;
    }

    // Determine bytes per pixel based on color type
    // 0=gray, 2=RGB, 4=gray+alpha, 6=RGBA
    const bpp = colorType === 6 ? 4 : colorType === 4 ? 2 : colorType === 2 ? 3 : 1;
    const stride = width * bpp;

    // Unfilter and extract RGB
    const rgb = new Uint8Array(width * height * 3);
    const prevRow = new Uint8Array(stride);
    let rawOff = 0;
    for (let row = 0; row < height; row++) {
      const filterByte = raw[rawOff++];
      const curRow = new Uint8Array(stride);

      for (let i = 0; i < stride; i++) {
        const x = raw[rawOff++] || 0;
        const a = i >= bpp ? curRow[i - bpp] : 0;
        const b = prevRow[i];
        const c = i >= bpp ? prevRow[i - bpp] : 0;

        switch (filterByte) {
          case 0: curRow[i] = x; break;
          case 1: curRow[i] = (x + a) & 0xFF; break;
          case 2: curRow[i] = (x + b) & 0xFF; break;
          case 3: curRow[i] = (x + ((a + b) >> 1)) & 0xFF; break;
          case 4: curRow[i] = (x + paethPredictor(a, b, c)) & 0xFF; break;
          default: curRow[i] = x;
        }
      }

      // Extract RGB from this row
      for (let px = 0; px < width; px++) {
        const srcOff = px * bpp;
        const dstOff = (row * width + px) * 3;

        if (colorType === 6) { // RGBA
          const alpha = curRow[srcOff + 3] / 255;
          rgb[dstOff] = Math.round(curRow[srcOff] * alpha + 255 * (1 - alpha));
          rgb[dstOff + 1] = Math.round(curRow[srcOff + 1] * alpha + 255 * (1 - alpha));
          rgb[dstOff + 2] = Math.round(curRow[srcOff + 2] * alpha + 255 * (1 - alpha));
        } else if (colorType === 4) { // Gray + Alpha
          const gray = curRow[srcOff];
          const alpha = curRow[srcOff + 1] / 255;
          const val = Math.round(gray * alpha + 255 * (1 - alpha));
          rgb[dstOff] = rgb[dstOff + 1] = rgb[dstOff + 2] = val;
        } else if (colorType === 2) { // RGB
          rgb[dstOff] = curRow[srcOff];
          rgb[dstOff + 1] = curRow[srcOff + 1];
          rgb[dstOff + 2] = curRow[srcOff + 2];
        } else { // Grayscale
          rgb[dstOff] = rgb[dstOff + 1] = rgb[dstOff + 2] = curRow[srcOff];
        }
      }

      prevRow.set(curRow);
    }

    // Convert to hex string for PDF stream
    let hex = "";
    for (let i = 0; i < rgb.length; i++) {
      hex += rgb[i].toString(16).padStart(2, "0");
    }

    return { width, height, rgbHex: hex };
  } catch (e) {
    console.error("Logo fetch/parse failed:", e);
    return null;
  }
}

function readU32(buf: Uint8Array, off: number): number {
  return (buf[off] << 24) | (buf[off + 1] << 16) | (buf[off + 2] << 8) | buf[off + 3];
}

function paethPredictor(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}
