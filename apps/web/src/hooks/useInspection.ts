import { useEffect, useRef, useState } from 'react';
import type { ScanEvent, ScanSummary, ValidationStage } from '@deploylens/contracts';

type WireEvent = ScanEvent | { type: 'upload.completed'; scanId: string } | { type: 'scan.error'; message: string };
export function useInspection() {
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<'idle' | 'uploading' | 'scanning'>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState<ScanSummary | null>(null);
  const [stages, setStages] = useState<ValidationStage[]>([]);
  const [limit, setLimit] = useState(512 * 1024 * 1024);
  const request = useRef<XMLHttpRequest | null>(null);
  const busy = phase !== 'idle';
  useEffect(() => {
    fetch('/api/health').then(r => r.ok ? r.json() : Promise.reject()).then(data => setLimit(data.maxUploadBytes)).catch(() => {});
    return () => request.current?.abort();
  }, []);
  function choose(candidate?: File) {
    if (!candidate || busy) return;
    setSummary(null); setStages([]); setError('');
    if (!/\.(apk|aab|ipa)$/i.test(candidate.name)) { setFile(null); setError('Choose an APK, AAB, or IPA build archive. Other archive formats are not supported.'); return; }
    if (candidate.size < 4 || candidate.size > limit) { setFile(null); setError(`Choose a non-empty archive up to ${Math.round(limit / 1024 / 1024)} MB.`); return; }
    setFile(candidate);
  }
  function start() {
    if (!file || busy) return;
    setError(''); setSummary(null); setStages([]); setProgress(0); setPhase('uploading');
    const xhr = new XMLHttpRequest(); request.current = xhr;
    let offset = 0, terminal = false, invalidStream = false;
    const event = (message: WireEvent) => {
      if (message.type === 'upload.completed' || message.type === 'scan.started') setPhase('scanning');
      else if (message.type === 'stage.started') setStages(previous => [...previous, { id: message.stageId, name: message.stageName, stageNumber: message.stageNumber, totalStages: message.totalStages, lifecycle: 'running', checks: [] }]);
      else if (message.type === 'stage.completed') setStages(previous => previous.map(stage => stage.id === message.stage.id ? message.stage : stage));
      else if (message.type === 'stage.error') setStages(previous => previous.map(stage => stage.id === message.stageId ? { ...stage, lifecycle: 'error', error: message.error } : stage));
      else if (message.type === 'scan.completed') { terminal = true; setSummary(message.summary); }
      else if (message.type === 'scan.error') { terminal = true; setError(message.message); }
    };
    const consume = () => {
      if (xhr.status !== 200 || invalidStream) return;
      const end = xhr.responseText.lastIndexOf('\n');
      if (end < offset) return;
      try { for (const line of xhr.responseText.slice(offset, end).split('\n')) if (line) event(JSON.parse(line)); }
      catch { invalidStream = true; setError('The inspection response was interrupted. Please retry.'); }
      offset = end + 1;
    };
    xhr.open('POST', `/api/scans?filename=${encodeURIComponent(file.name)}`);
    xhr.setRequestHeader('Content-Type', 'application/octet-stream'); xhr.timeout = 260000;
    xhr.upload.onprogress = e => { if (e.lengthComputable) setProgress(Math.round(e.loaded / e.total * 100)); };
    xhr.onprogress = consume;
    xhr.onload = () => {
      consume();
      if (xhr.status !== 200) {
        try { setError(JSON.parse(xhr.responseText).error); } catch { setError('Upload service is unavailable. Please try again.'); }
      } else if (!terminal && !invalidStream) setError('Inspection ended before a verdict was available. Please retry.');
      setPhase('idle'); request.current = null;
    };
    xhr.onerror = () => { setError('Connection lost. Check your connection and retry.'); setPhase('idle'); request.current = null; };
    xhr.ontimeout = () => { setError('Upload or inspection timed out. Please retry with a smaller archive.'); setPhase('idle'); request.current = null; };
    xhr.onabort = () => { setPhase('idle'); request.current = null; setError('Inspection cancelled. No verdict was issued.'); };
    xhr.send(file);
  }
  function reset() { request.current?.abort(); request.current = null; setPhase('idle'); setFile(null); setSummary(null); setStages([]); setError(''); setProgress(0); }
  return { file, phase, progress, error, summary, stages, limit, busy, choose, start, reset, cancel: () => request.current?.abort() };
}
export type Inspection = ReturnType<typeof useInspection>;
