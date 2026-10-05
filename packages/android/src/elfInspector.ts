import type { NativeLibraryInfo } from '@deploylens/contracts';

const ELF_MAGIC = 0x464c457f; // 0x7f, 'E', 'L', 'F' in little-endian

export interface ParsedElfInfo {
  isElf: boolean;
  is64Bit: boolean;
  isLittleEndian: boolean;
  machine: string;
  abi: string;
  is16KbAligned: boolean;
  minLoadAlignmentBytes: number;
  errorMessage?: string;
}

export function inspectElfBuffer(buffer: Buffer, filePath: string): ParsedElfInfo {
  if (buffer.length < 52) {
    return {
      isElf: false,
      is64Bit: false,
      isLittleEndian: true,
      machine: 'Unknown',
      abi: 'unknown',
      is16KbAligned: false,
      minLoadAlignmentBytes: 0,
      errorMessage: 'File too small for ELF header',
    };
  }

  const magic = buffer.readUInt32LE(0);
  if (magic !== ELF_MAGIC) {
    return {
      isElf: false,
      is64Bit: false,
      isLittleEndian: true,
      machine: 'Non-ELF',
      abi: 'unknown',
      is16KbAligned: false,
      minLoadAlignmentBytes: 0,
      errorMessage: 'Invalid ELF magic bytes',
    };
  }

  const eiClass = buffer.readUInt8(4); // 1 = 32-bit, 2 = 64-bit
  const eiData = buffer.readUInt8(5); // 1 = Little-endian, 2 = Big-endian
  const is64Bit = eiClass === 2;
  const isLittleEndian = eiData === 1;

  const readU16 = (off: number) => (isLittleEndian ? buffer.readUInt16LE(off) : buffer.readUInt16BE(off));
  const readU32 = (off: number) => (isLittleEndian ? buffer.readUInt32LE(off) : buffer.readUInt32BE(off));
  const readU64 = (off: number) => {
    if (isLittleEndian) {
      return Number(buffer.readBigUInt64LE(off));
    } else {
      return Number(buffer.readBigUInt64BE(off));
    }
  };

  const eMachine = readU16(18);
  let machine = 'Unknown';
  let abi = 'unknown';

  switch (eMachine) {
    case 0x28: // 40
      machine = 'ARM';
      abi = 'armeabi-v7a';
      break;
    case 0xb7: // 183
      machine = 'AArch64';
      abi = 'arm64-v8a';
      break;
    case 0x03: // 3
      machine = 'Intel 80386';
      abi = 'x86';
      break;
    case 0x3e: // 62
      machine = 'x86-64';
      abi = 'x86_64';
      break;
    case 0xf3: // 243
      machine = 'RISC-V';
      abi = 'riscv64';
      break;
    default:
      machine = `Machine_${eMachine}`;
      abi = filePath.includes('arm64') ? 'arm64-v8a' : filePath.includes('armeabi') ? 'armeabi-v7a' : 'unknown';
  }

  // Parse program headers for PT_LOAD segment alignment
  let is16KbAligned = true;
  let minLoadAlignment = 0;
  const PT_LOAD = 1;

  try {
    if (is64Bit) {
      if (buffer.length < 64) throw new Error('Truncated 64-bit ELF header');
      const ePhoOff = readU64(32);
      const ePhentSize = readU16(54);
      const ePhNum = readU16(56);

      let phOffset = ePhoOff;
      for (let i = 0; i < ePhNum; i++) {
        if (phOffset + 56 > buffer.length) break;
        const pType = readU32(phOffset);
        if (pType === PT_LOAD) {
          const pOffset = readU64(phOffset + 8);
          const pVaddr = readU64(phOffset + 16);
          const pAlign = readU64(phOffset + 48);

          if (minLoadAlignment === 0 || pAlign < minLoadAlignment) {
            minLoadAlignment = pAlign;
          }

          if (pAlign < 16384) {
            is16KbAligned = false;
          }
          if (pAlign > 0 && pOffset % pAlign !== pVaddr % pAlign) {
            is16KbAligned = false;
          }
        }
        phOffset += ePhentSize > 0 ? ePhentSize : 56;
      }
    } else {
      // 32-bit ELF (Android 32-bit usually uses 4 KB pages, but 16KB alignment applies primarily to 64-bit for Android 15)
      const ePhoOff = readU32(28);
      const ePhentSize = readU16(42);
      const ePhNum = readU16(44);

      let phOffset = ePhoOff;
      for (let i = 0; i < ePhNum; i++) {
        if (phOffset + 32 > buffer.length) break;
        const pType = readU32(phOffset);
        if (pType === PT_LOAD) {
          const pOffset = readU32(phOffset + 4);
          const pVaddr = readU32(phOffset + 8);
          const pAlign = readU32(phOffset + 28);

          if (minLoadAlignment === 0 || pAlign < minLoadAlignment) {
            minLoadAlignment = pAlign;
          }

          if (pAlign < 16384) {
            is16KbAligned = false;
          }
          if (pAlign > 0 && pOffset % pAlign !== pVaddr % pAlign) {
            is16KbAligned = false;
          }
        }
        phOffset += ePhentSize > 0 ? ePhentSize : 32;
      }
    }
  } catch (err) {
    return {
      isElf: true,
      is64Bit,
      isLittleEndian,
      machine,
      abi,
      is16KbAligned: false,
      minLoadAlignmentBytes: 0,
      errorMessage: err instanceof Error ? err.message : 'Error parsing program headers',
    };
  }

  return {
    isElf: true,
    is64Bit,
    isLittleEndian,
    machine,
    abi,
    is16KbAligned,
    minLoadAlignmentBytes: minLoadAlignment,
  };
}

export function toNativeLibraryInfo(
  path: string,
  buffer: Buffer
): NativeLibraryInfo {
  const parts = path.split('/');
  const name = parts[parts.length - 1] || 'lib.so';
  const abiMatch = path.match(/lib\/([^/]+)\//);
  const detectedAbi = abiMatch ? abiMatch[1]! : 'unknown';

  const elf = inspectElfBuffer(buffer, path);

  return {
    path,
    name,
    abi: elf.abi !== 'unknown' ? elf.abi : detectedAbi,
    fileSizeBytes: buffer.length,
    is16KbAligned: elf.isElf ? elf.is16KbAligned : null,
    loadAlignmentBytes: elf.minLoadAlignmentBytes,
  };
}
