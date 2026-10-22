import type { ScanSummary } from '@deploylens/contracts';
import { product } from '@deploylens/config';
import { renderReportHtml } from '@deploylens/reporting';
import reportCss from '../styles/export-report.css?raw';
export { escapeHtml } from '@deploylens/reporting';

export function reportFile(summary: ScanSummary) {
  return new File([renderReportHtml(summary, {css: reportCss, productLabel: `${product.name} ${product.version}`})], `${summary.artifact.fileName}.deploylens.html`, {type: 'text/html'});
}
export function saveFile(file: Blob, name: string) {
  const url = URL.createObjectURL(file), link = document.createElement('a');
  link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function emailDraft(subject: string, body: string, to: string, attachment: File) {
  // Export a portable MIME email with a real report attachment; no message is sent.
  const bytes = new Uint8Array(await attachment.arrayBuffer());
  let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte);
  const encoded = btoa(binary).match(/.{1,76}/g)?.join('\r\n') ?? '';
  const utf8Base64 = (value: string) => {
    let text = ''; for (const byte of new TextEncoder().encode(value)) text += String.fromCharCode(byte);
    return btoa(text);
  };
  const boundary = `deploylens-${crypto.randomUUID()}`;
  const message = [`To: ${to.replace(/[\r\n]/g, '')}`, `Subject: =?UTF-8?B?${utf8Base64(subject)}?=`, 'MIME-Version: 1.0', `Content-Type: multipart/mixed; boundary="${boundary}"`, '', `--${boundary}`, 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', utf8Base64(body).match(/.{1,76}/g)?.join('\r\n') ?? '', `--${boundary}`, 'Content-Type: text/html; charset=UTF-8', 'Content-Disposition: attachment; filename="DeployLens-report.html"', 'Content-Transfer-Encoding: base64', '', encoded, `--${boundary}--`, ''].join('\r\n');
  return new File([message], 'DeployLens-report.eml', { type: 'message/rfc822' });
}
