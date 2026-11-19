export interface VerifiedIdentity {
  subject: string;
  email: string;
}

/** Resolves to the verified identity, or null for any invalid credential (never a reason). */
export interface IdentityProvider {
  verifyCredentials(email: string, password: string): Promise<VerifiedIdentity | null>;
}
