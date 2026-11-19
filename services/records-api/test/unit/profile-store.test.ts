import { beforeEach, describe, expect, it } from 'vitest';
import { createProfileStore } from '../../src/profiles/store.js';
import type { Actor, StoredFile } from '../../src/profiles/types.js';

const provider: Actor = { id: 'u1', role: 'provider' };
const admin: Actor = { id: 'a1', role: 'admin' };
const file = (fileName: string): StoredFile => ({
  fileName,
  contentType: 'application/pdf',
  size: 3,
  data: Buffer.from('abc'),
});

describe('profile store', () => {
  let store: ReturnType<typeof createProfileStore>;
  beforeEach(() => {
    store = createProfileStore();
    store.seed({ id: 'p1', displayName: 'Whitfield', approvedBio: 'Approved bio', approvedPhoto: file('a.png') });
  });

  it('keeps previous bio while a submission is pending (AC5)', () => {
    store.submitChange('p1', { bio: 'New bio' }, provider);
    const p = store.getProfile('p1')!;
    expect(p.approvedBio).toBe('Approved bio');
    expect(p.pending?.bio).toBe('New bio');
  });

  it('approve swaps in the pending version (AC6)', () => {
    store.submitChange('p1', { bio: 'New bio', photo: file('b.png') }, provider);
    store.resolvePending('p1', 'approve', admin);
    const p = store.getProfile('p1')!;
    expect(p.approvedBio).toBe('New bio');
    expect(p.approvedPhoto?.fileName).toBe('b.png');
    expect(p.pending).toBeUndefined();
  });

  it('approve of a bio-only submission keeps the approved photo', () => {
    store.submitChange('p1', { bio: 'New bio' }, provider);
    store.resolvePending('p1', 'approve', admin);
    expect(store.getProfile('p1')!.approvedPhoto?.fileName).toBe('a.png');
  });

  it('reject discards the pending version (AC7)', () => {
    store.submitChange('p1', { bio: 'New bio' }, provider);
    store.resolvePending('p1', 'reject', admin);
    const p = store.getProfile('p1')!;
    expect(p.approvedBio).toBe('Approved bio');
    expect(p.pending).toBeUndefined();
  });

  it('throws when nothing is pending', () => {
    expect(() => store.resolvePending('p1', 'approve', admin)).toThrow();
  });

  it('display name is live (AC8)', () => {
    store.setDisplayName('p1', 'New Name', provider);
    expect(store.getProfile('p1')!.displayName).toBe('New Name');
  });

  it('newer document of the same type replaces the older (AC11)', () => {
    store.putDocument('p1', 'insurance', file('ins.pdf'), provider);
    store.putDocument('p1', 'licence', file('old.pdf'), provider);
    store.putDocument('p1', 'licence', file('new.pdf'), provider);
    const docs = store.getProfile('p1')!.documents;
    expect(docs.licence?.fileName).toBe('new.pdf');
    expect(docs.insurance?.fileName).toBe('ins.pdf');
    expect(Object.keys(docs)).toHaveLength(2);
  });

  it('second submission replaces the first (AC12)', () => {
    store.submitChange('p1', { bio: 'first' }, provider);
    store.submitChange('p1', { bio: 'second' }, provider);
    expect(store.getProfile('p1')!.pending?.bio).toBe('second');
  });

  it('writes an audit record for every mutation (ADR-0011)', () => {
    store.setDisplayName('p1', 'X', provider);
    expect(store.audit().at(-1)).toMatchObject({ actorId: 'u1', action: 'display-name.updated', providerId: 'p1' });
    store.submitChange('p1', { bio: 'b' }, provider);
    expect(store.audit().at(-1)?.action).toBe('submission.created');
    store.putDocument('p1', 'licence', file('l.pdf'), provider);
    expect(store.audit().at(-1)?.action).toBe('document.uploaded');
    store.resolvePending('p1', 'approve', admin);
    expect(store.audit().at(-1)).toMatchObject({ actorId: 'a1', action: 'submission.approved' });
    store.submitChange('p1', { bio: 'c' }, provider);
    store.resolvePending('p1', 'reject', admin);
    expect(store.audit().at(-1)?.action).toBe('submission.rejected');
    expect(store.audit().at(-1)?.at).toMatch(/^\d{4}-/);
  });
});
