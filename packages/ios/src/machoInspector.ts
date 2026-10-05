const MH_MAGIC = 0xfeedface;
const MH_CIGAM = 0xcefaedfe;
const MH_MAGIC_64 = 0xfeedfacf;
const MH_CIGAM_64 = 0xcffaedfe;
const FAT_MAGIC = 0xcafebabe;
const FAT_CIGAM = 0xbebafeca;
const FAT_MAGIC_64 = 0xcafebabf;

const CPU_TYPE_ARM = 12;
const CPU_TYPE_ARM64 = 0x0100000c;
const CPU_TYPE_X86 = 7;
const CPU_TYPE_X86_64 = 0x01000007;

function cpuTypeToName(cpuType: number): string {
  switch (cpuType) {
    case CPU_TYPE_ARM64:
      return 'arm64';
    case CPU_TYPE_ARM:
      return 'armv7';
    case CPU_TYPE_X86_64:
      return 'x86_64';
    case CPU_TYPE_X86:
      return 'x86';
    default:
      return `cpu_0x${cpuType.toString(16)}`;
  }
}

export function inspectMachOBinary(buffer: Buffer): {
  isMachO: boolean;
  architectures: string[];
  isFatBinary: boolean;
} {
  if (buffer.length < 12) {
    return { isMachO: false, architectures: [], isFatBinary: false };
  }

  const magic = buffer.readUInt32BE(0);
  const magicLE = buffer.readUInt32LE(0);

  // Check Fat / Universal binary
  if (magic === FAT_MAGIC || magicLE === FAT_CIGAM) {
    const isLittleEndian = magicLE === FAT_CIGAM;
    const nfatArch = isLittleEndian ? buffer.readUInt32LE(4) : buffer.readUInt32BE(4);
    const archs: string[] = [];

    let offset = 8;
    for (let i = 0; i < nfatArch; i++) {
      if (offset + 20 > buffer.length) break;
      const cputype = isLittleEndian ? buffer.readUInt32LE(offset) : buffer.readUInt32BE(offset);
      const name = cpuTypeToName(cputype);
      if (!archs.includes(name)) archs.push(name);
      offset += 20;
    }

    return {
      isMachO: true,
      architectures: archs,
      isFatBinary: true,
    };
  }

  if (magic === FAT_MAGIC_64) {
    const nfatArch = buffer.readUInt32BE(4);
    const archs: string[] = [];
    let offset = 8;
    for (let i = 0; i < nfatArch; i++) {
      if (offset + 32 > buffer.length) break;
      const cputype = buffer.readUInt32BE(offset);
      const name = cpuTypeToName(cputype);
      if (!archs.includes(name)) archs.push(name);
      offset += 32;
    }
    return {
      isMachO: true,
      architectures: archs,
      isFatBinary: true,
    };
  }

  // Single architecture Mach-O 32-bit
  if (magic === MH_MAGIC || magicLE === MH_CIGAM) {
    const isLittleEndian = magicLE === MH_CIGAM;
    const cputype = isLittleEndian ? buffer.readUInt32LE(4) : buffer.readUInt32BE(4);
    return {
      isMachO: true,
      architectures: [cpuTypeToName(cputype)],
      isFatBinary: false,
    };
  }

  // Single architecture Mach-O 64-bit
  if (magic === MH_MAGIC_64 || magicLE === MH_CIGAM_64) {
    const isLittleEndian = magicLE === MH_CIGAM_64;
    const cputype = isLittleEndian ? buffer.readUInt32LE(4) : buffer.readUInt32BE(4);
    return {
      isMachO: true,
      architectures: [cpuTypeToName(cputype)],
      isFatBinary: false,
    };
  }

  return { isMachO: false, architectures: [], isFatBinary: false };
}
