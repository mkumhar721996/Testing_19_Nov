export type DocType = 'licence' | 'insurance';
export type Role = 'provider' | 'admin';

export interface Actor {
  id: string;
  role: Role;
}

export interface StoredFile {
  fileName: string;
  contentType: string;
  size: number;
  data: Buffer;
}

export interface Submission {
  bio?: string;
  photo?: StoredFile;
  submittedAt: string;
}

export type StoredDocument = StoredFile & { uploadedAt: string };

export interface ProviderProfile {
  id: string;
  displayName: string;
  approvedBio?: string;
  approvedPhoto?: StoredFile;
  pending?: Submission;
  documents: Partial<Record<DocType, StoredDocument>>;
}

export interface AuditRecord {
  actorId: string;
  action: string;
  providerId: string;
  at: string;
}

export interface ProfileStore {
  getProfile(id: string): ProviderProfile | undefined;
  setDisplayName(id: string, name: string, actor: Actor): void;
  /** Replaces any pending submission. */
  submitChange(id: string, s: { bio?: string; photo?: StoredFile }, actor: Actor): void;
  resolvePending(id: string, decision: 'approve' | 'reject', actor: Actor): void;
  /** Replaces the document of the same type. */
  putDocument(id: string, type: DocType, file: StoredFile, actor: Actor): void;
  audit(): AuditRecord[];
}
