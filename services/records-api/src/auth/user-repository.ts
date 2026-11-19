export interface UserRecord {
  id: string;
  email: string;
  displayName: string;
  roles: string[];
  organization: { id: string; name: string } | null;
  /** Immutable Entra `oid` this account is bound to; null until the first successful sign-in. */
  identitySubject?: string | null;
}

export interface UserRepository {
  findBySubject(subject: string): Promise<UserRecord | null>;
  /** Binds the subject only if the account has none yet; false when it is already bound. */
  linkSubject(userId: string, subject: string): Promise<boolean>;
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
}
