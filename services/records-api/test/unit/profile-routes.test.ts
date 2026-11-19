import { beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';
import { createProfileStore } from '../../src/profiles/store.js';
import type { Actor, StoredFile } from '../../src/profiles/types.js';

const provider = { 'x-actor-id': 'p1', 'x-actor-role': 'provider' };
const admin = { 'x-actor-id': 'a1', 'x-actor-role': 'admin' };
const providerActor: Actor = { id: 'p1', role: 'provider' };
const png = (fileName: string): StoredFile => ({ fileName, contentType: 'image/png', size: 3, data: Buffer.from('png') });

function multipart(fields: Record<string, string>, file?: { name: string; field: string; type: string }) {
  const boundary = 'testboundary';
  let body = '';
  for (const [k, v] of Object.entries(fields)) {
    body += `--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`;
  }
  if (file) {
    body += `--${boundary}\r\nContent-Disposition: form-data; name="${file.field}"; filename="${file.name}"\r\nContent-Type: ${file.type}\r\n\r\ncontent\r\n`;
  }
  body += `--${boundary}--\r\n`;
  return { payload: body, headers: { 'content-type': `multipart/form-data; boundary=${boundary}` } };
}

describe('profile routes', () => {
  let store: ReturnType<typeof createProfileStore>;
  let app: ReturnType<typeof buildApp>;
  const get = (url: string, headers = {}) => app.inject({ method: 'GET', url, headers });
  const upload = (url: string, m: ReturnType<typeof multipart>) =>
    app.inject({ method: 'POST', url, headers: { ...provider, ...m.headers }, payload: m.payload });

  beforeEach(() => {
    store = createProfileStore();
    store.seed({ id: 'p1', displayName: 'Whitfield Plumbing and Heating', approvedBio: 'Approved bio', approvedPhoto: png('a.png') });
    store.seed({ id: 'p2', displayName: 'Okafor Electrical' });
    app = buildApp({ store });
  });

  it('AC1 shows name, photo and bio to customers', async () => {
    const res = await get('/providers/p1');
    expect(res.json()).toMatchObject({
      displayName: 'Whitfield Plumbing and Heating',
      bio: 'Approved bio',
      photoUrl: '/providers/p1/photo',
    });
    expect((await get('/providers/p1/photo')).statusCode).toBe(200);
  });

  it('AC2 never leaks documents to customers; admin file routes need admin', async () => {
    store.putDocument('p1', 'licence', { ...png('gas-safe.pdf'), contentType: 'application/pdf' }, providerActor);
    const res = await get('/providers/p1');
    expect(JSON.stringify(res.json())).not.toMatch(/licence|insurance|gas-safe/i);
    expect(Object.keys(res.json()).sort()).toEqual(['bio', 'displayName', 'id', 'photoUrl']);
    expect((await get('/admin/providers/p1/documents/licence')).statusCode).toBe(401);
    expect((await get('/admin/providers/p1/documents/licence', provider)).statusCode).toBe(403);
  });

  it('AC3 admin sees the document marked awaiting review', async () => {
    store.putDocument('p1', 'licence', { ...png('licence.pdf'), contentType: 'application/pdf' }, providerActor);
    const res = await get('/admin/providers/p1/review', admin);
    expect(res.json().documents).toEqual([
      expect.objectContaining({ type: 'licence', fileName: 'licence.pdf', status: 'awaiting-review' }),
    ]);
    expect((await get('/admin/providers/p1/documents/licence', admin)).statusCode).toBe(200);
  });

  it('AC4 accepts a provider document upload and rejects unsupported files', async () => {
    const ok = await upload('/me/documents', multipart({ type: 'licence' }, { name: 'licence.pdf', field: 'file', type: 'application/pdf' }));
    expect(ok.statusCode).toBe(201);
    const bad = await upload('/me/documents', multipart({ type: 'licence' }, { name: 'scan.tiff', field: 'file', type: 'image/tiff' }));
    expect(bad.statusCode).toBe(400);
    expect(bad.json().message).toContain('is not a supported file');
  });

  it('AC5 customers keep the previous bio while a submission is pending', async () => {
    const res = await upload('/me/profile/submissions', multipart({ bio: 'New bio' }));
    expect(res.statusCode).toBe(202);
    expect((await get('/providers/p1')).json().bio).toBe('Approved bio');
  });

  it('AC6 approve swaps the live version; 409 when nothing pending', async () => {
    await upload('/me/profile/submissions', multipart({ bio: 'New bio' }));
    const res = await app.inject({ method: 'POST', url: '/admin/providers/p1/submission/approve', headers: admin });
    expect(res.statusCode).toBe(200);
    expect((await get('/providers/p1')).json().bio).toBe('New bio');
    expect(store.getProfile('p1')!.pending).toBeUndefined();
    const again = await app.inject({ method: 'POST', url: '/admin/providers/p1/submission/approve', headers: admin });
    expect(again.statusCode).toBe(409);
  });

  it('AC7 reject keeps the previous version', async () => {
    await upload('/me/profile/submissions', multipart({ bio: 'New bio' }));
    await app.inject({ method: 'POST', url: '/admin/providers/p1/submission/reject', headers: admin });
    expect((await get('/providers/p1')).json().bio).toBe('Approved bio');
    expect(store.getProfile('p1')!.pending).toBeUndefined();
  });

  it('AC8 display name is live; empty name is 400', async () => {
    const res = await app.inject({ method: 'PUT', url: '/me/profile/display-name', headers: provider, payload: { displayName: 'New Name' } });
    expect(res.statusCode).toBe(200);
    expect((await get('/providers/p1')).json().displayName).toBe('New Name');
    const bad = await app.inject({ method: 'PUT', url: '/me/profile/display-name', headers: provider, payload: { displayName: ' ' } });
    expect(bad.statusCode).toBe(400);
  });

  it('AC9/AC10 name only provider shows no photo and no bio', async () => {
    const body = (await get('/providers/p2')).json();
    expect(body.displayName).toBe('Okafor Electrical');
    expect(body).not.toHaveProperty('photoUrl');
    expect(body).not.toHaveProperty('bio');
    expect((await get('/providers/p2/photo')).statusCode).toBe(404);
  });

  it('AC11 admin review shows one document per type, the newest', async () => {
    store.putDocument('p1', 'insurance', png('ins.png'), providerActor);
    store.putDocument('p1', 'licence', png('old.png'), providerActor);
    store.putDocument('p1', 'licence', png('new.png'), providerActor);
    const docs = (await get('/admin/providers/p1/review', admin)).json().documents;
    expect(docs.map((d: { fileName: string }) => d.fileName).sort()).toEqual(['ins.png', 'new.png']);
    expect(docs.every((d: { status: string }) => d.status === 'awaiting-review')).toBe(true);
  });

  it('AC12 admin sees only the newer submission', async () => {
    await upload('/me/profile/submissions', multipart({ bio: 'first' }));
    await upload('/me/profile/submissions', multipart({ bio: 'second' }));
    expect((await get('/admin/providers/p1/review', admin)).json().pending.bio).toBe('second');
  });

  it('requires a submission to carry a bio or photo', async () => {
    expect((await upload('/me/profile/submissions', multipart({}))).statusCode).toBe(400);
  });

  it('rejects a wrong role on provider routes', async () => {
    expect((await get('/me/profile', admin)).statusCode).toBe(403);
    expect((await get('/me/profile')).statusCode).toBe(401);
  });
});
