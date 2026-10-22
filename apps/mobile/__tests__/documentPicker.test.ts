jest.mock('@react-native-documents/picker', () => ({
  errorCodes: {OPERATION_CANCELED: 'cancelled'}, isErrorWithCode: (error: {code?: string}) => !!error.code,
  types: {allFiles: '*/*'}, pick: jest.fn(), keepLocalCopy: jest.fn(),
}));
jest.mock('react-native-blob-util', () => ({__esModule: true, default: {fs: {
  dirs: {CacheDir: '/cache'}, ls: jest.fn(), exists: jest.fn(async () => true), unlink: jest.fn(async () => {}),
}}}));
import {pick, keepLocalCopy} from '@react-native-documents/picker';
import ReactNativeBlobUtil from 'react-native-blob-util';
import {pickBuild, removeCachedBuild, removeOrphanedBuildCopies} from '../src/adapters/documentPicker';
const fs = ReactNativeBlobUtil.fs;
beforeEach(() => {jest.clearAllMocks();});
test('copies under an owned name while retaining the user-facing archive filename', async () => {
  (pick as jest.Mock).mockResolvedValueOnce([{name: 'release.apk', size: 100, uri: 'content://provider/release', isVirtual: false}]);
  (keepLocalCopy as jest.Mock).mockResolvedValueOnce([{status: 'success', localUri: 'file:///cache/owned.apk'}]);
  expect(await pickBuild(200)).toEqual({name: 'release.apk', size: 100, type: 'apk', localUri: 'file:///cache/owned.apk'});
  expect(keepLocalCopy).toHaveBeenCalledWith(expect.objectContaining({files: [expect.objectContaining({fileName: expect.stringMatching(/^deploylens-build-\d+-\d+\.apk$/)})]}));
});
test('does not copy virtual or oversized documents and treats cancellation as no selection', async () => {
  (pick as jest.Mock).mockResolvedValueOnce([{name: 'release.apk', size: 100, isVirtual: true}]);
  await expect(pickBuild(200)).rejects.toThrow('Virtual');
  (pick as jest.Mock).mockResolvedValueOnce([{name: 'release.apk', size: 300, isVirtual: false}]);
  await expect(pickBuild(200)).rejects.toThrow();
  (pick as jest.Mock).mockRejectedValueOnce({code: 'cancelled'});
  await expect(pickBuild(200)).resolves.toBeNull();
  expect(keepLocalCopy).not.toHaveBeenCalled();
});
test('startup cleanup preserves unrelated files and directories in the cache', async () => {
  (fs.ls as jest.Mock).mockImplementation(async (path: string) => path === '/cache' ? ['provider'] : ['deploylens-build-123-1.apk', 'unrelated.apk', 'notes.txt']);
  await removeOrphanedBuildCopies();
  expect(fs.unlink).toHaveBeenCalledTimes(1);
  expect(fs.unlink).toHaveBeenCalledWith('/cache/provider/deploylens-build-123-1.apk');
});
test('removes only the selected cached copy and decodes its provider URI', async () => {
  await removeCachedBuild({name: 'release build.apk', size: 100, type: 'apk', localUri: 'file:///cache/release%20build.apk'});
  expect(fs.unlink).toHaveBeenCalledWith('/cache/release build.apk');
});
