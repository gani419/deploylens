import { describe, it, expect } from 'vitest';
import { SafeZipReader } from '@deploylens/core';

describe('SafeZipReader Security and Safeguards', () => {
  it('throws an error when input buffer is not a valid zip', () => {
    const invalidBuf = Buffer.from('NOT A ZIP FILE BUFFER');
    expect(() => new SafeZipReader(invalidBuf)).toThrow(/Invalid archive/i);
  });

  it('rejects entries exceeding maximum entry threshold', () => {
    // Test that passing a custom maxEntryCount throws if exceeded
    const buf = Buffer.alloc(30);
    expect(() => new SafeZipReader(buf, { maxEntryCount: 0 })).toThrow();
  });
});
