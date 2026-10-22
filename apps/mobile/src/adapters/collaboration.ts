import Clipboard from '@react-native-clipboard/clipboard';
import ReactNativeBlobUtil from 'react-native-blob-util';
import Share from 'react-native-share';
import type {ScanSummary} from '@deploylens/contracts';
import type {MobileArchive} from './documentPicker';

export function copyText(value: string) { Clipboard.setString(value); }

function safeFilePart(value: string) { return value.replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || 'deploylens-report'; }

export async function shareReport(summary: ScanSummary, subject: string, message: string, archive: MobileArchive | null, includeBuild: boolean) {
  const reportPath = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${safeFilePart(summary.artifact.fileName)}-deploylens-report.json`;
  await ReactNativeBlobUtil.fs.writeFile(reportPath, JSON.stringify(summary, null, 2), 'utf8');
  const urls = [`file://${reportPath}`];
  if (includeBuild && archive) urls.push(archive.localUri);
  try {
    await Share.open({title: subject, subject, message, urls, failOnCancel: false, showAppsToView: true});
  } finally {
    try { if (await ReactNativeBlobUtil.fs.exists(reportPath)) await ReactNativeBlobUtil.fs.unlink(reportPath); } catch { /* best-effort export cleanup */ }
  }
}
