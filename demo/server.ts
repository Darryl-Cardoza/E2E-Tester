import { createServer } from 'node:http';
import type { IncomingMessage } from 'node:http';
import { randomUUID } from 'node:crypto';
import { initializeDemoEnvironment } from '../config/demo.js';

initializeDemoEnvironment();
interface User {
  id: string;
  email: string;
  password: string;
  testOwner?: string;
}
const primary: User = {
  id: 'qa-user',
  email: process.env.LOCAL_DEMO_TEST_EMAIL!,
  password: process.env.LOCAL_DEMO_TEST_PASSWORD!,
};
const users = new Map<string, User>([[primary.id, primary]]);
const sessions = new Map<string, string>();
const publicUser = (user: User) => ({
  id: user.id,
  email: user.email,
  ...(user.testOwner ? { testOwner: user.testOwner } : {}),
});
async function body(request: IncomingMessage): Promise<Record<string, unknown>> {
  let raw = '';
  for await (const chunk of request) {
    raw += String(chunk);
    if (raw.length > 65536) throw new Error('body too large');
  }
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid body');
  return value as Record<string, unknown>;
}
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><title>Local QA demo</title><body>
<main><h1>Local QA demo</h1><p>Synthetic local testing only</p><form id="login" novalidate>
<label>Email<input data-testid="email-input" type="email" id="email"></label>
<label>Password<input data-testid="password-input" type="password" id="password"></label>
<button data-testid="login-button">Log in</button></form><p id="loading" role="status" data-testid="loading" hidden>Loading</p>
<p id="error" role="alert" data-testid="error" hidden></p><section id="dashboard" hidden><h2>Dashboard</h2>
<p data-testid="profile-email"></p><button data-testid="items-button">Load items</button><p data-testid="items"></p></section></main>
<script>
const form=document.querySelector('#login'), error=document.querySelector('#error'), loading=document.querySelector('#loading');
function fail(message){error.textContent=message;error.hidden=false;}
async function dashboard(){
  const response=await fetch('/api/users/me');
  if(!response.ok){fail('Please log in');return;}
  const profile=await response.json();form.hidden=true;document.querySelector('#dashboard').hidden=false;
  document.querySelector('[data-testid="profile-email"]').textContent=profile.email;
}
form.addEventListener('submit',async event=>{
 event.preventDefault();error.hidden=true;
 const email=document.querySelector('#email').value,password=document.querySelector('#password').value;
 if(!email.includes('@')||!password){fail('Enter a valid email and password');return;}
 loading.hidden=false;
 try{const response=await fetch('/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password})});
 if(!response.ok){fail(response.status===403?'Permission denied':response.status>=500?'Service unavailable':'Invalid credentials');return;}
 history.pushState({},'', '/dashboard');await dashboard();
 }catch{fail('Network unavailable');}finally{loading.hidden=true;}
});
document.querySelector('[data-testid="items-button"]').onclick=async()=>{const response=await fetch('/api/items');const items=await response.json();document.querySelector('[data-testid="items"]').textContent=items.length?items.join(', '):'No items';};
if(location.pathname==='/dashboard')dashboard().catch(()=>fail('Network unavailable'));
</script></body></html>`;

const server = createServer((request, response) => {
  void (async () => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1:4173');
    const json = (status: number, value: unknown) => {
      response.writeHead(status, {
        'content-type': 'application/json',
        'cache-control': 'no-store',
      });
      response.end(JSON.stringify(value));
    };
    const admin =
      request.headers.authorization === `Bearer ${process.env.LOCAL_DEMO_TEST_ADMIN_TOKEN}`;
    const cookie = request.headers.cookie
      ?.split(';')
      .map((value) => value.trim())
      .find((value) => value.startsWith('demo-session='))
      ?.slice('demo-session='.length);
    const userId =
      request.headers.authorization === `Bearer ${process.env.LOCAL_DEMO_TEST_USER_TOKEN}`
        ? primary.id
        : sessions.get(cookie ?? '');
    if (url.pathname === '/health') {
      json(200, { status: 'ok' });
      return;
    }
    if (['/', '/login', '/dashboard'].includes(url.pathname)) {
      response.writeHead(200, { 'content-type': 'text/html' });
      response.end(html);
      return;
    }
    if (url.pathname === '/api/login' && request.method === 'POST') {
      const credentials = await body(request);
      const user = [...users.values()].find(
        (user) => user.email === credentials.email && user.password === credentials.password,
      );
      if (!user) {
        json(401, { error: 'invalid credentials' });
        return;
      }
      const session = randomUUID();
      sessions.set(session, user.id);
      response.setHeader(
        'set-cookie',
        `demo-session=${session}; HttpOnly; SameSite=Strict; Path=/`,
      );
      json(200, publicUser(user));
      return;
    }
    if (url.pathname === '/api/users/me') {
      const user = userId ? users.get(userId) : undefined;
      json(user ? 200 : 401, user ? publicUser(user) : { error: 'unauthorized' });
      return;
    }
    if (url.pathname === '/api/items') {
      json(200, []);
      return;
    }
    if (url.pathname === '/api/error') {
      json(500, { error: 'controlled demo error' });
      return;
    }
    if (url.pathname === '/api/test-users' || url.pathname.startsWith('/api/test-users/')) {
      if (!admin) {
        json(403, { error: 'forbidden' });
        return;
      }
      if (url.pathname === '/api/test-users' && request.method === 'POST') {
        const input = await body(request);
        if (
          typeof input.email !== 'string' ||
          !input.email.endsWith('@example.test') ||
          typeof input.password !== 'string' ||
          typeof input.testOwner !== 'string' ||
          !/^e2e-[a-f0-9-]+$/.test(input.testOwner)
        ) {
          json(400, { error: 'synthetic user fields required' });
          return;
        }
        if ([...users.values()].some((user) => user.email === input.email)) {
          json(409, { error: 'duplicate email' });
          return;
        }
        const user: User = {
          id: randomUUID(),
          email: input.email,
          password: input.password,
          testOwner: input.testOwner,
        };
        users.set(user.id, user);
        json(201, publicUser(user));
        return;
      }
      const id = url.pathname.slice('/api/test-users/'.length);
      const user = users.get(id);
      if (!user) {
        json(404, {});
        return;
      }
      if (request.method === 'DELETE') {
        if (!user.testOwner || request.headers['x-test-owner'] !== user.testOwner) {
          json(403, { error: 'ownership mismatch' });
          return;
        }
        users.delete(id);
        for (const [token, owner] of sessions) if (owner === id) sessions.delete(token);
        response.writeHead(204);
        response.end();
        return;
      }
      if (request.method === 'GET') {
        json(200, publicUser(user));
        return;
      }
      json(405, {});
      return;
    }
    json(404, { error: 'not found' });
  })().catch(() => {
    if (!response.headersSent) response.writeHead(400, { 'content-type': 'application/json' });
    response.end('{"error":"invalid request"}');
  });
});
server.listen(4173, '127.0.0.1');
for (const signal of ['SIGTERM', 'SIGINT'] as const)
  process.on(signal, () => {
    server.close();
    server.closeAllConnections();
  });
