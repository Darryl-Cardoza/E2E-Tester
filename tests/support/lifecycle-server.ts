import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { randomUUID } from 'node:crypto';
import type { EnvironmentConfig } from '../../config/environments.js';

export async function startLifecycleServer() {
  const records = new Map<string, { id: string; testOwner: string; email?: string }>();
  const credentials = {
    email: 'qa@example.test',
    password: randomUUID(),
    userToken: randomUUID(),
    adminToken: randomUUID(),
  };
  let logins = 0;
  let deletes = 0;
  let failDelete = false;
  const server = createServer((req, res) => {
    void (async () => {
      const json = (status: number, value: unknown) => {
        res.writeHead(status, { 'content-type': 'application/json' });
        res.end(JSON.stringify(value));
      };
      if (req.url === '/login' && req.method === 'POST') {
        let raw = '';
        for await (const chunk of req) raw += String(chunk);
        const body = JSON.parse(raw) as Record<string, unknown>;
        if (body.email !== credentials.email || body.password !== credentials.password) {
          json(401, {});
          return;
        }
        logins++;
        res.setHeader(
          'set-cookie',
          `session=${credentials.userToken}; HttpOnly; SameSite=Lax; Path=/`,
        );
        json(200, { authenticated: true });
        return;
      }
      if (req.url === '/me') {
        const admin = req.headers.authorization === `Bearer ${credentials.adminToken}`;
        const user =
          req.headers.authorization === `Bearer ${credentials.userToken}` ||
          req.headers.cookie === `session=${credentials.userToken}`;
        json(admin || user ? 200 : 401, { role: admin ? 'admin' : user ? 'user' : 'anonymous' });
        return;
      }
      if (req.url === '/page') {
        res.writeHead(200, { 'content-type': 'text/html' });
        res.end('<h1>Lifecycle</h1>');
        return;
      }
      if (req.url === '/api/test-users' && req.method === 'POST') {
        let raw = '';
        for await (const chunk of req) raw += String(chunk);
        const body = JSON.parse(raw) as { testOwner: string; email?: string };
        const record = { ...body, id: randomUUID() };
        records.set(record.id, record);
        json(201, record);
        return;
      }
      const id = req.url?.split('/api/test-users/')[1];
      const record = id ? records.get(id) : undefined;
      if (!record) {
        json(404, {});
        return;
      }
      if (req.method === 'DELETE') {
        if (failDelete) {
          json(503, {});
          return;
        }
        if (req.headers['x-test-owner'] !== record.testOwner) {
          json(403, {});
          return;
        }
        deletes++;
        records.delete(record.id);
        res.writeHead(204);
        res.end();
        return;
      }
      json(200, record);
    })().catch(() => {
      res.writeHead(500);
      res.end();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const host = `127.0.0.1:${(server.address() as AddressInfo).port}`;
  const environment: EnvironmentConfig = {
    name: 'local-demo',
    frontendBaseURL: `http://${host}`,
    apiBaseURL: `http://${host}`,
    allowedHosts: [host],
  };
  return {
    environment,
    credentials,
    records,
    logins: () => logins,
    deletes: () => deletes,
    failDeletion: (value: boolean) => {
      failDelete = value;
    },
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeAllConnections();
      }),
  };
}
