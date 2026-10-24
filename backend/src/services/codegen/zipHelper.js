/**
 * Native ZIP Packer for Node.js
 * Creates valid .zip archives in memory using Node's built-in zlib module.
 * No external npm dependencies required.
 */

const zlib = require('zlib');

// Precomputed CRC32 table
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[i] = c >>> 0;
}

function calculateCrc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// Convert Date to MS-DOS date & time
function getDosDateTime(date = new Date()) {
  const time = ((date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1)) & 0xFFFF;
  const dosDate = (((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()) & 0xFFFF;
  return { time, date: dosDate };
}

/**
 * Creates a valid ZIP buffer from an array of { path: string, content: string | Buffer }
 */
function createZipBuffer(files = []) {
  const localHeaders = [];
  const centralHeaders = [];
  let currentOffset = 0;

  const now = new Date();
  const { time: dosTime, date: dosDate } = getDosDateTime(now);

  for (const file of files) {
    // Normalize path separators to forward slashes
    const rawPath = file.path.replace(/\\/g, '/').replace(/^\/+/, '');
    const filenameBuf = Buffer.from(rawPath, 'utf8');

    const contentBuf = Buffer.isBuffer(file.content)
      ? file.content
      : Buffer.from(file.content || '', 'utf8');

    const uncompressedSize = contentBuf.length;
    const crc32 = calculateCrc32(contentBuf);

    // Deflate compression
    const compressedBuf = zlib.deflateRawSync(contentBuf, { level: 6 });
    const compressedSize = compressedBuf.length;

    // --- Local File Header (30 bytes + filename + data) ---
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034B50, 0); // Local file header signature
    localHeader.writeUInt16LE(20, 4);         // Version needed: 2.0
    localHeader.writeUInt16LE(0x0800, 6);     // Flags: UTF-8 filename
    localHeader.writeUInt16LE(8, 8);          // Compression: Deflate
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(crc32, 14);
    localHeader.writeUInt32LE(compressedSize, 18);
    localHeader.writeUInt32LE(uncompressedSize, 22);
    localHeader.writeUInt16LE(filenameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);         // Extra field length: 0

    localHeaders.push(localHeader, filenameBuf, compressedBuf);

    // --- Central Directory File Header (46 bytes + filename) ---
    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014B50, 0); // Central directory signature
    centralHeader.writeUInt16LE(20, 4);         // Version made by: 2.0
    centralHeader.writeUInt16LE(20, 6);         // Version needed: 2.0
    centralHeader.writeUInt16LE(0x0800, 8);     // Flags: UTF-8
    centralHeader.writeUInt16LE(8, 10);         // Deflate
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(crc32, 16);
    centralHeader.writeUInt32LE(compressedSize, 20);
    centralHeader.writeUInt32LE(uncompressedSize, 24);
    centralHeader.writeUInt16LE(filenameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);         // Extra field length: 0
    centralHeader.writeUInt16LE(0, 32);         // File comment length: 0
    centralHeader.writeUInt16LE(0, 34);         // Disk number: 0
    centralHeader.writeUInt16LE(0, 36);         // Internal attributes: 0
    centralHeader.writeUInt32LE((0o100644 << 16) >>> 0, 38); // Standard POSIX file permissions
    centralHeader.writeUInt32LE(currentOffset, 42); // Relative offset of local header

    centralHeaders.push(centralHeader, filenameBuf);

    currentOffset += 30 + filenameBuf.length + compressedSize;
  }

  const centralDirectoryOffset = currentOffset;
  const centralDirectoryBuf = Buffer.concat(centralHeaders);
  const centralDirectorySize = centralDirectoryBuf.length;

  // --- End of Central Directory Record (22 bytes) ---
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054B50, 0);               // EOCD signature
  eocd.writeUInt16LE(0, 4);                        // Disk number: 0
  eocd.writeUInt16LE(0, 6);                        // Start disk: 0
  eocd.writeUInt16LE(files.length, 8);             // Entries on disk
  eocd.writeUInt16LE(files.length, 10);            // Total entries
  eocd.writeUInt32LE(centralDirectorySize, 12);    // Size of central directory
  eocd.writeUInt32LE(centralDirectoryOffset, 16);  // Offset of central directory
  eocd.writeUInt16LE(0, 20);                       // Comment length: 0

  return Buffer.concat([...localHeaders, centralDirectoryBuf, eocd]);
}

module.exports = {
  createZipBuffer
};
