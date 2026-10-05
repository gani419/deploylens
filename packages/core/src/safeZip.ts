import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

export interface ZipEntryHeader {
  fileName: string;
  compressionMethod: number; // 0 = stored, 8 = deflated
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
  dataOffset?: number;
}

export interface SafeZipOptions {
  maxEntryCount?: number;
  maxTotalUncompressedBytes?: number;
  maxCompressionRatio?: number;
}

const DEFAULT_MAX_ENTRIES = 50000;
const DEFAULT_MAX_UNCOMPRESSED_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB
const DEFAULT_MAX_RATIO = 100;

export class SafeZipReader {
  private buffer: Buffer;
  private entries: Map<string, ZipEntryHeader> = new Map();
  private totalUncompressedBytes = 0;

  constructor(buffer: Buffer, options: SafeZipOptions = {}) {
    this.buffer = buffer;
    this.parseCentralDirectory(
      options.maxEntryCount ?? DEFAULT_MAX_ENTRIES,
      options.maxTotalUncompressedBytes ?? DEFAULT_MAX_UNCOMPRESSED_BYTES,
      options.maxCompressionRatio ?? DEFAULT_MAX_RATIO
    );
  }

  static fromFile(filePath: string, options: SafeZipOptions = {}): SafeZipReader {
    const stat = fs.statSync(filePath);
    if (stat.size > 2 * 1024 * 1024 * 1024) {
      throw new Error(`File size ${stat.size} bytes exceeds maximum supported scan limit of 2GB`);
    }
    const buf = fs.readFileSync(filePath);
    return new SafeZipReader(buf, options);
  }

  private parseCentralDirectory(
    maxEntries: number,
    maxTotalBytes: number,
    maxRatio: number
  ) {
    const buf = this.buffer;
    if (buf.length < 22) {
      throw new Error('Invalid archive: file too small to contain ZIP header');
    }

    // Locate EOCD record
    let eocdOffset = -1;
    const minEocdSearch = Math.max(0, buf.length - 65557);
    for (let i = buf.length - 22; i >= minEocdSearch; i--) {
      if (buf.readUInt32LE(i) === 0x06054b50) {
        eocdOffset = i;
        break;
      }
    }

    if (eocdOffset === -1) {
      throw new Error('Invalid archive: End of Central Directory record not found');
    }

    const cdTotalEntries = buf.readUInt16LE(eocdOffset + 10);
    const cdSize = buf.readUInt32LE(eocdOffset + 12);
    const cdOffset = buf.readUInt32LE(eocdOffset + 16);

    if (cdTotalEntries > maxEntries) {
      throw new Error(`Archive exceeds maximum entry limit of ${maxEntries} (found ${cdTotalEntries} entries)`);
    }

    if (cdOffset + cdSize > buf.length) {
      throw new Error('Malformed archive: Central Directory extends beyond file boundaries');
    }

    let cur = cdOffset;
    const cdEnd = cdOffset + cdSize;

    while (cur + 46 <= cdEnd) {
      const signature = buf.readUInt32LE(cur);
      if (signature !== 0x02014b50) {
        break; // End of valid CD entries
      }

      const method = buf.readUInt16LE(cur + 10);
      const compressedSize = buf.readUInt32LE(cur + 20);
      const uncompressedSize = buf.readUInt32LE(cur + 24);
      const fileNameLen = buf.readUInt16LE(cur + 28);
      const extraLen = buf.readUInt16LE(cur + 30);
      const commentLen = buf.readUInt16LE(cur + 32);
      const localHeaderOffset = buf.readUInt32LE(cur + 42);

      const nameStart = cur + 46;
      if (nameStart + fileNameLen > buf.length) {
        throw new Error('Malformed archive: entry name extends beyond file boundary');
      }

      const rawFileName = buf.toString('utf8', nameStart, nameStart + fileNameLen);
      // Normalize path separators to forward slash
      const fileName = rawFileName.replace(/\\/g, '/');

      // Security Check: Path Traversal prevention (Zip Slip)
      if (
        fileName.startsWith('/') ||
        fileName.includes('../') ||
        fileName.includes('/..') ||
        fileName === '..' ||
        /^[a-zA-Z]:/.test(fileName)
      ) {
        throw new Error(`Security violation: Archive entry contains path traversal: "${rawFileName}"`);
      }

      // Security Check: ZIP Bomb ratio
      if (compressedSize > 0 && uncompressedSize > 10 * 1024 * 1024) {
        const ratio = uncompressedSize / compressedSize;
        if (ratio > maxRatio) {
          throw new Error(`Potential ZIP bomb detected: entry "${fileName}" has compression ratio ${ratio.toFixed(1)}:1 (limit ${maxRatio}:1)`);
        }
      }

      this.totalUncompressedBytes += uncompressedSize;
      if (this.totalUncompressedBytes > maxTotalBytes) {
        throw new Error(`Archive total uncompressed size exceeds maximum threshold of ${maxTotalBytes} bytes`);
      }

      this.entries.set(fileName, {
        fileName,
        compressionMethod: method,
        compressedSize,
        uncompressedSize,
        localHeaderOffset,
      });

      cur += 46 + fileNameLen + extraLen + commentLen;
    }
  }

  getEntries(): ZipEntryHeader[] {
    return Array.from(this.entries.values());
  }

  hasEntry(entryPath: string): boolean {
    const normalized = entryPath.replace(/\\/g, '/');
    return this.entries.has(normalized);
  }

  readEntry(entryPath: string): Buffer | null {
    const normalized = entryPath.replace(/\\/g, '/');
    const header = this.entries.get(normalized);
    if (!header) return null;

    const buf = this.buffer;
    const lOffset = header.localHeaderOffset;
    if (lOffset + 30 > buf.length) return null;

    const lSig = buf.readUInt32LE(lOffset);
    if (lSig !== 0x04034b50) {
      return null;
    }

    const fnLen = buf.readUInt16LE(lOffset + 26);
    const extraLen = buf.readUInt16LE(lOffset + 28);
    const dataStart = lOffset + 30 + fnLen + extraLen;
    const dataEnd = dataStart + header.compressedSize;

    if (dataEnd > buf.length) return null;

    const compressedData = buf.subarray(dataStart, dataEnd);

    if (header.compressionMethod === 0) {
      // Stored (no compression)
      return Buffer.from(compressedData);
    } else if (header.compressionMethod === 8) {
      // Deflated
      try {
        return zlib.inflateRawSync(compressedData);
      } catch (err: any) {
        throw new Error(`Failed to decompress entry "${entryPath}": ${err.message}`);
      }
    } else {
      throw new Error(`Unsupported compression method ${header.compressionMethod} in entry "${entryPath}"`);
    }
  }

  /**
   * Safely extracts selective entries to a target directory with strict containment validation.
   */
  extractEntrySafely(entryPath: string, destinationDir: string): string {
    const normalized = entryPath.replace(/\\/g, '/');
    const data = this.readEntry(normalized);
    if (!data) {
      throw new Error(`Entry "${entryPath}" not found in archive`);
    }

    const resolvedDest = path.resolve(destinationDir);
    const targetFile = path.resolve(resolvedDest, normalized);

    // Strict containment check
    if (!targetFile.startsWith(resolvedDest + path.sep) && targetFile !== resolvedDest) {
      throw new Error(`Path traversal attempt blocked: "${entryPath}" resolves outside "${destinationDir}"`);
    }

    fs.mkdirSync(path.dirname(targetFile), { recursive: true });
    fs.writeFileSync(targetFile, data);
    return targetFile;
  }
}
