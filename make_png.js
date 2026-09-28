import fs from 'fs';
import zlib from 'zlib';

function createCRC32Table() {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
}

const crcTable = createCRC32Table();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);

  const crcBuf = Buffer.alloc(4);
  const toCrc = Buffer.concat([typeBuf, data]);
  crcBuf.writeUInt32BE(crc32(toCrc), 0);

  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function generateLogoPNG(width, height) {
  // RGBA buffer with filter byte at beginning of each row
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(rowSize * height);

  const cx = width / 2;
  const cy = height / 2;
  const rOuter = width * 0.47;
  const rGoldInner = width * 0.44;
  const rBody = width * 0.42;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter type 0 (None)

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > rOuter) {
        // Outside circle - transparent
        rawData[pxOffset] = 0;
        rawData[pxOffset + 1] = 0;
        rawData[pxOffset + 2] = 0;
        rawData[pxOffset + 3] = 0;
      } else if (dist > rGoldInner) {
        // Gold Outer Ring
        const angle = Math.atan2(dy, dx);
        const goldShimmer = (Math.sin(angle * 3) + 1) * 0.5;
        const r = Math.floor(210 + goldShimmer * 40);
        const g = Math.floor(165 + goldShimmer * 45);
        const b = Math.floor(55 + goldShimmer * 35);
        rawData[pxOffset] = r;
        rawData[pxOffset + 1] = g;
        rawData[pxOffset + 2] = b;
        rawData[pxOffset + 3] = 255;
      } else if (dist > rBody) {
        // Thin inner dark accent
        rawData[pxOffset] = 110;
        rawData[pxOffset + 1] = 80;
        rawData[pxOffset + 2] = 20;
        rawData[pxOffset + 3] = 255;
      } else {
        // Inside Badge - Soft Cream Pink Radial Gradient
        const grad = dist / rBody;
        const r = Math.floor(255 - grad * 12);
        const g = Math.floor(248 - grad * 24);
        const b = Math.floor(245 - grad * 20);

        // Simple decorative boutique elements inside:
        // Center text zone / ribbon banner
        const isRibbonY = y > cy + 25 && y < cy + 70 && Math.abs(dx) < rBody * 0.75;
        const isCenterHeart = Math.abs(dx) < 18 && Math.abs(dy - (cy + 10)) < 15;
        const isHatArea = y < cy - 35 && y > cy - 120 && dx > -110 && dx < 40;
        const isDressArea = y < cy - 20 && y > cy - 100 && dx > 40 && dx < 110;

        if (isCenterHeart) {
          rawData[pxOffset] = 226;
          rawData[pxOffset + 1] = 51;
          rawData[pxOffset + 2] = 110;
          rawData[pxOffset + 3] = 255;
        } else if (isRibbonY) {
          // Dokan Eileen banner text area
          const textDark = Math.sin(x * 0.15) > 0.3 || Math.sin(y * 0.2) > 0.3;
          if (textDark && Math.abs(dx) < rBody * 0.65) {
            rawData[pxOffset] = 30;
            rawData[pxOffset + 1] = 30;
            rawData[pxOffset + 2] = 35;
          } else {
            rawData[pxOffset] = 255;
            rawData[pxOffset + 1] = 235;
            rawData[pxOffset + 2] = 240;
          }
          rawData[pxOffset + 3] = 255;
        } else if (isHatArea) {
          // Silhouette tone
          rawData[pxOffset] = 247;
          rawData[pxOffset + 1] = 155;
          rawData[pxOffset + 2] = 183;
          rawData[pxOffset + 3] = 255;
        } else if (isDressArea) {
          rawData[pxOffset] = 247;
          rawData[pxOffset + 1] = 167;
          rawData[pxOffset + 2] = 191;
          rawData[pxOffset + 3] = 255;
        } else {
          rawData[pxOffset] = r;
          rawData[pxOffset + 1] = g;
          rawData[pxOffset + 2] = b;
          rawData[pxOffset + 3] = 255;
        }
      }
    }
  }

  // Header chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth
  ihdr[9] = 6; // Color type 6 (RGBA)
  ihdr[10] = 0; // Compression
  ihdr[11] = 0; // Filter
  ihdr[12] = 0; // Interlace

  const compressedData = zlib.deflateSync(rawData, { level: 9 });
  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  return Buffer.concat([
    pngSignature,
    createChunk('IHDR', ihdr),
    createChunk('IDAT', compressedData),
    createChunk('IEND', Buffer.alloc(0))
  ]);
}

const logoBuf = generateLogoPNG(400, 400);
fs.writeFileSync('assets/logo.png', logoBuf);
fs.writeFileSync('public/assets/logo.png', logoBuf);
console.log('PNG written successfully, bytes:', logoBuf.length);
