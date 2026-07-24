import http from 'node:http';

const listenPort = Number(process.env.RUNTIME_PROXY_PORT);
const targetPort = Number(process.env.RUNTIME_PROXY_TARGET_PORT);
if (!Number.isInteger(listenPort) || !Number.isInteger(targetPort)) {
  throw new Error('RUNTIME_PROXY_PORT and RUNTIME_PROXY_TARGET_PORT are required');
}

const server = http.createServer((request, response) => {
  const upstream = http.request({
    hostname: '127.0.0.1',
    port: targetPort,
    path: request.url,
    method: request.method,
    headers: { ...request.headers, host: `127.0.0.1:${targetPort}` },
  }, (upstreamResponse) => {
    response.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers);
    upstreamResponse.pipe(response);
  });
  upstream.on('error', () => {
    if (!response.headersSent) response.writeHead(502, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ error: 'Application listener is unavailable' }));
  });
  request.pipe(upstream);
});

server.listen(listenPort, '127.0.0.1', () => {
  console.log(`UI proxy listening on http://127.0.0.1:${listenPort}`);
});

