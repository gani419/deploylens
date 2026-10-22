jest.mock('@react-native-clipboard/clipboard', () => ({__esModule: true, default: {setString: jest.fn()}}));
jest.mock('@deploylens/reporting', () => ({renderReportHtml: jest.fn(() => '<html>Readable report</html>')}));
jest.mock('react-native-share', () => ({__esModule: true, default: {open: jest.fn()}}));
jest.mock('react-native-blob-util', () => ({__esModule: true, default: {fs: {
  dirs: {CacheDir: '/cache'}, mkdir: jest.fn(async () => {}), writeFile: jest.fn(async () => {}),
  exists: jest.fn(async () => true), unlink: jest.fn(async () => {}), cp: jest.fn(async () => {}), ls: jest.fn(async () => []),
}}}));

import ReactNativeBlobUtil from 'react-native-blob-util';
import Share from 'react-native-share';
import type {ScanSummary} from '@deploylens/contracts';
import {copyText, shareReport, removeOrphanedReportExports} from '../src/adapters/collaboration';
import Clipboard from '@react-native-clipboard/clipboard';

const fs = ReactNativeBlobUtil.fs;
const open = Share.open as jest.Mock;
const data = {scanId: 'one', artifact: {fileName: '../../release.apk'}} as ScanSummary;
const archive = {name: 'release build.apk', size: 100, type: 'apk' as const, localUri: 'file:///cache/release%20build.apk'};
beforeEach(() => {jest.clearAllMocks(); open.mockResolvedValue({success: true, message: 'recipient'});});

test('copies editable messages to the native clipboard', () => {
  copyText('Subject\nEdited message'); expect(Clipboard.setString).toHaveBeenCalledWith('Subject\nEdited message');
});
test('exports a readable report and keeps successful attachments available after handoff', async () => {
  expect(await shareReport(data, 'Edited subject', 'Edited message', archive, true)).toBe('shared');
  expect(fs.writeFile).toHaveBeenCalledWith(expect.stringMatching(/^\/cache\/deploylens-export-\d+-\d+\//), '<html>Readable report</html>', 'utf8');
  expect(fs.cp).toHaveBeenCalledWith('/cache/release build.apk', expect.stringMatching(/\/release-build.apk$/));
  expect(open).toHaveBeenCalledWith(expect.objectContaining({subject: 'Edited subject', message: 'Edited message', type: '*/*', failOnCancel: false, useInternalStorage: true, urls: [expect.stringContaining('.deploylens.html'), expect.stringContaining('/release-build.apk')]}));
  expect(fs.unlink).not.toHaveBeenCalled();
});
test('JSON report export works without an original and uses its actual MIME type', async () => {
  await shareReport(data, 'Report', 'Message', null, false, 'json');
  expect(fs.writeFile).toHaveBeenCalledWith(expect.stringContaining('.json'), JSON.stringify(data, null, 2), 'utf8');
  expect(open).toHaveBeenCalledWith(expect.objectContaining({type: 'application/json', urls: [expect.stringContaining('.json')]}));
  expect(fs.cp).not.toHaveBeenCalled();
});
test('cleans a cancelled export without treating it as a delivery', async () => {
  open.mockResolvedValueOnce({success: false, dismissedAction: true});
  expect(await shareReport(data, 'Report', 'Message', null, false)).toBe('cancelled');
  expect(fs.unlink).toHaveBeenCalledWith(expect.stringMatching(/^\/cache\/deploylens-export-\d+-\d+$/));
});
test('cleans failed exports and permits retrying after an unsupported receiver', async () => {
  open.mockRejectedValueOnce(new Error('Unsupported file type'));
  await expect(shareReport(data, 'Report', 'Message', archive, true)).rejects.toThrow('Unsupported file type');
  expect(fs.unlink).toHaveBeenCalled();
  await expect(shareReport(data, 'Report', 'Message', null, false)).resolves.toBe('shared');
});
test('rejects an unavailable original instead of silently omitting the selected attachment', async () => {
  await expect(shareReport(data, 'Report', 'Message', null, true)).rejects.toThrow('no longer available');
  expect(open).not.toHaveBeenCalled();
});
test('prevents overlapping shares while the native sheet is open', async () => {
  let close!: (result: {success: boolean}) => void;
  open.mockReturnValueOnce(new Promise(resolve => {close = resolve;}));
  const pending = shareReport(data, 'Report', 'Message', null, false);
  await expect(shareReport(data, 'Report', 'Message', null, false)).rejects.toThrow('Close the open share sheet');
  await new Promise<void>(resolve => setImmediate(resolve));
  close({success: true}); await pending;
});
test('startup cleanup removes only owned export directories', async () => {
  (fs.ls as jest.Mock).mockResolvedValueOnce(['deploylens-export-123-1', 'private.txt', 'other-folder', 'deploylens-export-other']);
  await removeOrphanedReportExports();
  expect(fs.unlink).toHaveBeenCalledTimes(1);
  expect(fs.unlink).toHaveBeenCalledWith('/cache/deploylens-export-123-1');
});
