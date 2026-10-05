import { parse, parseBinary } from 'plist';

export function parsePlistBuffer(buffer: Buffer): Record<string, unknown> | null {
  if (buffer.length < 8) return null;

  // Check binary plist magic header 'bplist'
  if (buffer.subarray(0, 6).toString('ascii') === 'bplist') {
    try {
      const parsed = parseBinary(buffer);
      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object' && parsed[0] !== null) {
        return parsed[0] as Record<string, unknown>;
      }
      if (parsed && typeof parsed === 'object') {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Fall through to text parse
    }
  }

  // XML / Plaintext plist
  try {
    const text = buffer.toString('utf8');
    const parsed = parse(text);
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Fallback slice between <plist> and </plist>
    try {
      const text = buffer.toString('utf8');
      const start = text.indexOf('<plist');
      const end = text.lastIndexOf('</plist>');
      if (start !== -1 && end !== -1) {
        const sliced = text.substring(start, end + 8);
        const parsed = parse(sliced);
        if (parsed && typeof parsed === 'object') {
          return parsed as Record<string, unknown>;
        }
      }
    } catch {
      return null;
    }
  }

  return null;
}
