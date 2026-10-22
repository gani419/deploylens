import { createInspectionDecoder, scanUploadPath } from '@deploylens/api-client';
import type { InspectionTransport } from '@deploylens/api-client';
import { inspectionLimits } from '@deploylens/config';
import type { InspectionServiceHealth } from '@deploylens/contracts';

/** Browser-only binary transport. Native and Electron supply their own adapters. */
export const browserInspectionTransport: InspectionTransport<File> = {
  async health() {
    const response = await fetch('/api/health');
    if (!response.ok) throw new Error('Inspection service unavailable');
    return await response.json() as InspectionServiceHealth;
  },
  inspect(file, observer) {
    const xhr = new XMLHttpRequest();
    let offset = 0, terminal = false, stopped = false;
    const fail = (message: string) => { if (!stopped) { stopped = true; observer.onError(message); } };
    const decoder = createInspectionDecoder(event => {
      if (stopped || terminal) return;
      if (['scan.completed', 'scan.error', 'scan.cancelled'].includes(event.type)) terminal = true;
      observer.onEvent(event);
    });
    const consume = () => {
      if (xhr.status !== 200 || stopped) return;
      const chunk = xhr.responseText.slice(offset); offset = xhr.responseText.length;
      try { decoder.push(chunk); }
      catch { fail('The inspection response was interrupted. Please retry.'); xhr.abort(); }
    };
    xhr.open('POST', scanUploadPath(file.name));
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    xhr.timeout = inspectionLimits.requestTimeoutMs;
    xhr.upload.onprogress = event => { if (!stopped && event.lengthComputable) observer.onProgress(Math.round(event.loaded / event.total * 100)); };
    xhr.onprogress = consume;
    xhr.onload = () => {
      if (stopped) return;
      if (xhr.status !== 200) {
        let message = 'Upload service is unavailable. Please try again.';
        try { const data: unknown = JSON.parse(xhr.responseText); if (typeof data === 'object' && data !== null && 'error' in data && typeof data.error === 'string') message = data.error; } catch { /* Use a readable transport error. */ }
        fail(message); return;
      }
      consume(); if (stopped) return;
      try { decoder.finish(); } catch { fail('The inspection response was interrupted. Please retry.'); return; }
      if (!terminal) { fail('Inspection ended before a verdict was available. Please retry.'); return; }
      stopped = true; observer.onComplete();
    };
    xhr.onerror = () => fail('Connection lost. Check your connection and retry.');
    xhr.ontimeout = () => fail('Upload or inspection timed out. Please retry with a smaller archive.');
    xhr.onabort = () => { /* Cancellation state is owned by the caller. */ };
    xhr.send(file);
    return { cancel() { stopped = true; xhr.abort(); } };
  },
};
