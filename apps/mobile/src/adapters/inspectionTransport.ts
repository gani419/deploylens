import ReactNativeBlobUtil, {type FetchBlobResponse, type StatefulPromise} from 'react-native-blob-util';
import {createInspectionDecoder, scanUploadPath, type InspectionObserver} from '@deploylens/api-client';
import type {MobileArchive} from './documentPicker';

type StreamingTask = StatefulPromise<FetchBlobResponse> & {
  stateChange(callback: (state: {state: string; status: number; taskId: string}) => void): StreamingTask;
  progress(config: {interval?: number; count?: number}, callback: (received: number, total: number, chunk?: string) => void): StreamingTask;
};

function messageFromResponse(text: string, status: number) {
  try { const parsed: unknown = JSON.parse(text); if (parsed && typeof parsed === 'object' && 'error' in parsed && typeof parsed.error === 'string') return parsed.error; } catch { /* use fallback */ }
  return status === 429 ? 'All inspection slots are busy. Try again shortly.' : status ? `Inspection service returned HTTP ${status}.` : 'Could not reach the inspection service.';
}

export function inspectArchive(baseUrl: string, archive: MobileArchive, observer: InspectionObserver) {
  const path = decodeURIComponent(archive.localUri.replace(/^file:\/\//, ''));
  let status = 0, receivedChunks = false, stopped = false;
  const decoder = createInspectionDecoder(observer.onEvent);
  const task = ReactNativeBlobUtil.config({timeout: 260000}).fetch('POST', `${baseUrl}${scanUploadPath(archive.name)}`, {
    'Content-Type': 'application/octet-stream', 'Content-Length': String(archive.size), Accept: 'application/x-ndjson',
  }, ReactNativeBlobUtil.wrap(path)) as StreamingTask;
  task.stateChange(state => { if (state.state === '2') status = Math.floor(state.status); });
  task.uploadProgress({interval: 150}, (sent, total) => { if (!stopped) observer.onProgress(total > 0 ? sent / total * 100 : 0); });
  task.progress({interval: 80}, (_received: number, _total: number, chunk?: string) => {
    if (stopped || status < 200 || status >= 300 || !chunk) return;
    receivedChunks = true;
    try { decoder.push(chunk); } catch { stopped = true; task.cancel(); observer.onError('The inspection service returned an invalid event stream.'); }
  });
  task.then(response => {
    if (stopped) return;
    const responseStatus = status || Math.floor(response.info().status);
    const text = String(response.text() ?? '');
    if (responseStatus < 200 || responseStatus >= 300) { observer.onError(messageFromResponse(text, responseStatus)); return; }
    try { if (!receivedChunks && text) decoder.push(text); decoder.finish(); observer.onComplete(); }
    catch { observer.onError('The inspection stream ended with malformed or incomplete data.'); }
  }).catch(error => {
    if (!stopped) observer.onError(error instanceof Error && /cancel/i.test(error.message) ? 'Inspection cancelled. No verdict was issued.' : 'The upload or inspection connection was interrupted.');
  });
  return {cancel() { if (stopped) return; stopped = true; task.cancel(); }};
}
