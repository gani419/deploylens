const mockTasks: MockTask[] = [];

type Response = {info(): {status: number}; text(): string};
type MockTask = Promise<Response> & {
  stateChange(callback: (state: {state: string; status: number; taskId: string}) => void): MockTask;
  uploadProgress(config: object, callback: (sent: number, total: number) => void): MockTask;
  progress(config: object, callback: (received: number, total: number, chunk?: string) => void): MockTask;
  cancel: jest.Mock;
  emitState(status: number): void;
  emitUpload(sent: number, total: number): void;
  emitChunk(chunk: string): void;
  resolveResponse(status: number, text?: string): void;
  rejectResponse(error: Error): void;
};

function mockMakeTask(): MockTask {
  let resolve!: (response: Response) => void, reject!: (error: Error) => void;
  const promise = new Promise<Response>((yes, no) => { resolve = yes; reject = no; }) as MockTask;
  let state = (_value: {state: string; status: number; taskId: string}) => {};
  let upload = (_sent: number, _total: number) => {};
  let progress = (_received: number, _total: number, _chunk?: string) => {};
  promise.stateChange = callback => { state = callback; return promise; };
  promise.uploadProgress = (_config, callback) => { upload = callback; return promise; };
  promise.progress = (_config, callback) => { progress = callback; return promise; };
  promise.cancel = jest.fn();
  promise.emitState = status => state({state: '2', status, taskId: 'test'});
  promise.emitUpload = (sent, total) => upload(sent, total);
  promise.emitChunk = chunk => progress(chunk.length, chunk.length, chunk);
  promise.resolveResponse = (status, text = '') => resolve({info: () => ({status}), text: () => text});
  promise.rejectResponse = reject;
  return promise;
}

jest.mock('react-native-blob-util', () => ({
  __esModule: true,
  default: {
    config: jest.fn(() => ({fetch: jest.fn(() => { const task = mockMakeTask(); mockTasks.push(task); return task; })})),
    wrap: jest.fn((path: string) => `wrapped:${path}`),
  },
}));

import {inspectArchive} from '../src/adapters/inspectionTransport';

const archive = {name: 'release build.apk', size: 128, type: 'apk' as const, localUri: 'file:///cache/release%20build.apk'};
const nextTick = () => new Promise<void>(resolve => setImmediate(() => resolve()));
function observer() {
  return {onEvent: jest.fn(), onProgress: jest.fn(), onError: jest.fn(), onComplete: jest.fn()};
}

beforeEach(() => { mockTasks.length = 0; jest.clearAllMocks(); });

test('streams progress and completes only after a terminal event', async () => {
  const sink = observer();
  inspectArchive('https://inspect.example.com', archive, sink);
  const task = mockTasks[0];
  task.emitState(200);
  task.emitUpload(64, 128);
  task.emitChunk('{"type":"upload.completed","scanId":"one"}\n');
  task.emitChunk('{"type":"scan.error","message":"Archive rejected"}\n');
  task.resolveResponse(200);
  await nextTick();
  expect(sink.onProgress).toHaveBeenCalledWith(50);
  expect(sink.onEvent).toHaveBeenCalledTimes(2);
  expect(sink.onComplete).toHaveBeenCalledTimes(1);
  expect(sink.onError).not.toHaveBeenCalled();
});

test('rejects a successful but truncated stream without a verdict', async () => {
  const sink = observer();
  inspectArchive('https://inspect.example.com', archive, sink);
  const task = mockTasks[0];
  task.emitState(200);
  task.emitChunk('{"type":"upload.completed","scanId":"one"}\n');
  task.resolveResponse(200);
  await nextTick();
  expect(sink.onError).toHaveBeenCalledWith('Inspection ended before a verdict was available. Please retry.');
  expect(sink.onComplete).not.toHaveBeenCalled();
});

test('reports service errors and ignores completion', async () => {
  const sink = observer();
  inspectArchive('https://inspect.example.com', archive, sink);
  const task = mockTasks[0];
  task.emitState(429);
  task.resolveResponse(429, '{"error":"Server is busy"}');
  await nextTick();
  expect(sink.onError).toHaveBeenCalledWith('Server is busy');
  expect(sink.onComplete).not.toHaveBeenCalled();
});

test('cancellation stops callbacks and cancels the native task', async () => {
  const sink = observer();
  const request = inspectArchive('https://inspect.example.com', archive, sink);
  const task = mockTasks[0];
  request.cancel();
  task.rejectResponse(new Error('cancelled'));
  await nextTick();
  expect(task.cancel).toHaveBeenCalledTimes(1);
  expect(sink.onError).not.toHaveBeenCalled();
});
