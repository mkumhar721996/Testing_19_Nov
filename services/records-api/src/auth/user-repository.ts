export interface UserRecord {
  id: string;
  email: string;
  displayName: string;
  roles: string[];
  organization: { id: string; name: string } | null;
}

export interface UserRepository {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
}
