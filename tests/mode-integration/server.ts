import { createServer } from 'node:http';

// Framework verification harness, independent of the application demo.
const server = createServer((request, response) => {
  if (request.url === '/health') {
    response.end('ok');
    return;
  }
  if (request.url?.startsWith('/api/value')) {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ value: 'live' }));
    return;
  }
  response.writeHead(200, { 'content-type': 'text/html' });
  response.end(
    `<h1>Harness</h1><button onclick="fetch('/api/value').then(r=>r.json()).then(x=>document.querySelector('output').textContent=x.value).catch(()=>document.querySelector('output').textContent='failed')">Load</button><output>Ready</output>`,
  );
});
server.listen(4187, '127.0.0.1');
for (const signal of ['SIGTERM', 'SIGINT'] as const)
  process.on(signal, () => {
    server.close();
    server.closeAllConnections();
  });
