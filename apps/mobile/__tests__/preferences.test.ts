import {normalizeServiceUrl} from '../src/app/preferences';
test('normalizes a service URL', () => expect(normalizeServiceUrl('https://inspect.example.com/')).toBe('https://inspect.example.com'));
test('rejects incomplete and credential-bearing URLs', () => { expect(() => normalizeServiceUrl('inspect.example.com')).toThrow(); expect(() => normalizeServiceUrl('https://me:secret@example.com')).toThrow(); });
