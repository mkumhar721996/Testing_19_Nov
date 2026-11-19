import type { Actor, AuditRecord, ProfileStore, ProviderProfile } from './types.js';

export class NotFoundError extends Error {}
export class NothingPendingError extends Error {}

export type SeedProfile = Omit<ProviderProfile, 'documents'> & Partial<Pick<ProviderProfile, 'documents'>>;

export function createProfileStore(): ProfileStore & { seed(p: SeedProfile): void } {
  const profiles = new Map<string, ProviderProfile>();
  const records: AuditRecord[] = [];

  const record = (actor: Actor, action: string, providerId: string) =>
    records.push({ actorId: actor.id, action, providerId, at: new Date().toISOString() });
  const need = (id: string): ProviderProfile => {
    const p = profiles.get(id);
    if (!p) throw new NotFoundError(`Provider ${id} not found`);
    return p;
  };

  return {
    seed(p) {
      profiles.set(p.id, { documents: {}, ...p });
    },
    getProfile: (id) => profiles.get(id),
    setDisplayName(id, name, actor) {
      need(id).displayName = name;
      record(actor, 'display-name.updated', id);
    },
    submitChange(id, s, actor) {
      need(id).pending = { ...s, submittedAt: new Date().toISOString() };
      record(actor, 'submission.created', id);
    },
    resolvePending(id, decision, actor) {
      const p = need(id);
      if (!p.pending) throw new NothingPendingError('Nothing is awaiting review');
      if (decision === 'approve') {
        if (p.pending.bio !== undefined) p.approvedBio = p.pending.bio;
        if (p.pending.photo) p.approvedPhoto = p.pending.photo;
      }
      p.pending = undefined;
      record(actor, decision === 'approve' ? 'submission.approved' : 'submission.rejected', id);
    },
    putDocument(id, type, file, actor) {
      need(id).documents[type] = { ...file, uploadedAt: new Date().toISOString() };
      record(actor, 'document.uploaded', id);
    },
    audit: () => [...records],
  };
}
