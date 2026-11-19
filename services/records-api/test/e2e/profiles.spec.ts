import { expect, test } from '@playwright/test';

const provider = { 'x-actor-id': 'p1', 'x-actor-role': 'provider' };
const admin = { 'x-actor-id': 'a1', 'x-actor-role': 'admin' };

test('provider submits, customer keeps old bio until admin approves', async ({ request }) => {
  const doc = await request.post('/me/documents', {
    headers: provider,
    multipart: { type: 'licence', file: { name: 'licence.pdf', mimeType: 'application/pdf', buffer: Buffer.from('pdf') } },
  });
  expect(doc.status()).toBe(201);

  const sub = await request.post('/me/profile/submissions', { headers: provider, multipart: { bio: 'New bio' } });
  expect(sub.status()).toBe(202);

  const before = await (await request.get('/providers/p1')).json();
  expect(before.bio).toBeUndefined();

  const review = await (await request.get('/admin/providers/p1/review', { headers: admin })).json();
  expect(review.documents).toEqual([expect.objectContaining({ type: 'licence', status: 'awaiting-review' })]);

  const approve = await request.post('/admin/providers/p1/submission/approve', { headers: admin });
  expect(approve.status()).toBe(200);

  const after = await (await request.get('/providers/p1')).json();
  expect(after.bio).toBe('New bio');
  expect(JSON.stringify(after)).not.toMatch(/licence|document/i);
});
