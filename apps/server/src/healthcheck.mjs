import * as http2 from 'node:http2';

const port = Number(process.env.PORT ?? 3000);
const fail = () => process.exit(1);

if (process.env.DEPLOYLENS_HTTP2 === '1') {
  const client = http2.connect(`http://127.0.0.1:${port}`);
  const timer = setTimeout(() => { client.destroy(); fail(); }, 4000);
  const request = client.request({ ':path': '/api/health' });
  request.once('response', headers => {
    clearTimeout(timer);
    const ok = headers[':status'] === 200;
    request.close();
    client.close();
    process.exit(ok ? 0 : 1);
  });
  request.once('error', fail);
  client.once('error', fail);
  request.end();
} else {
  fetch(`http://127.0.0.1:${port}/api/health`).then(response => process.exit(response.ok ? 0 : 1)).catch(fail);
}
