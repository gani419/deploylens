import Clipboard from '@react-native-clipboard/clipboard';
import ReactNativeBlobUtil from 'react-native-blob-util';
import Share from 'react-native-share';
import type {ScanSummary} from '@deploylens/contracts';
import {renderReportHtml, type ReportHtmlOptions} from '@deploylens/reporting';
import type {MobileArchive} from './documentPicker';

export function copyText(value: string) { Clipboard.setString(value); }

const exportPrefix = 'deploylens-export-';
let sequence = 0;
let sharing = false;
function safeFilePart(value: string) { return value.replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 100) || 'deploylens-report'; }
async function removeExport(path: string) {
  try { if (await ReactNativeBlobUtil.fs.exists(path)) await ReactNativeBlobUtil.fs.unlink(path); } catch { /* retry orphan cleanup on next launch */ }
}

/** Only our own export directories are eligible for startup deletion. */
export async function removeOrphanedReportExports() {
  const cache = ReactNativeBlobUtil.fs.dirs.CacheDir;
  try {
    for (const entry of await ReactNativeBlobUtil.fs.ls(cache)) {
      if (/^deploylens-export-\d+-\d+$/.test(entry)) await removeExport(`${cache}/${entry}`);
    }
  } catch { /* startup cleanup is best-effort */ }
}

export type ReportFormat = 'html' | 'json';
export async function shareReport(
  summary: ScanSummary, subject: string, message: string,
  archive: MobileArchive | null, includeBuild: boolean,
  format: ReportFormat = 'html', annotations: ReportHtmlOptions = {},
): Promise<'cancelled' | 'shared'> {
  if (sharing) throw new Error('Close the open share sheet before sharing again.');
  if (includeBuild && !archive) throw new Error('The original build is no longer available. Turn off Include original build and try again.');
  sharing = true;
  const directory = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${exportPrefix}${Date.now()}-${++sequence}`;
  try {
    await ReactNativeBlobUtil.fs.mkdir(directory);
    const reportPath = `${directory}/${safeFilePart(summary.artifact.fileName)}.deploylens.${format}`;
    await ReactNativeBlobUtil.fs.writeFile(reportPath, format === 'html' ? renderReportHtml(summary, annotations) : JSON.stringify(summary, null, 2), 'utf8');
    const urls = [`file://${reportPath}`];
    if (includeBuild && archive) {
      const source = decodeURIComponent(archive.localUri.replace(/^file:\/\//, ''));
      if (!await ReactNativeBlobUtil.fs.exists(source)) throw new Error('The original build cache was cleared. Share the report without the build.');
      // A separate native file copy survives resetting the inspection during a handoff.
      const buildPath = `${directory}/${safeFilePart(archive.name.replace(/\.(apk|aab|ipa)$/i, ''))}.${archive.type}`;
      await ReactNativeBlobUtil.fs.cp(source, buildPath);
      urls.push(`file://${buildPath}`);
    }
    const result = await Share.open({title: subject, subject, message, urls,
      type: includeBuild ? '*/*' : format === 'html' ? 'text/html' : 'application/json',
      failOnCancel: false, useInternalStorage: true});
    if (result.dismissedAction || result.success === false) { await removeExport(directory); return 'cancelled'; }
    // Selecting a recipient does not mean it has finished reading these files.
    // Successful handoffs are removed on next launch, never in a finally block.
    return 'shared';
  } catch (error) {
    await removeExport(directory);
    throw error;
  } finally { sharing = false; }
}
