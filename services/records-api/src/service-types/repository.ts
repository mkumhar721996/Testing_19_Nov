export interface ServiceTypeRow {
  id: string;
  name: string;
  retiredAt: Date | null;
}

export class DuplicateNameError extends Error {
  constructor() {
    super('A service type with this name already exists');
  }
}

export const normaliseName = (name: string) => name.trim().toLowerCase();

export interface ServiceTypeRepository {
  listAll(): Promise<ServiceTypeRow[]>;
  listOffered(): Promise<ServiceTypeRow[]>;
  create(name: string): Promise<ServiceTypeRow>;
  rename(id: string, name: string): Promise<ServiceTypeRow | null>;
  retire(id: string): Promise<ServiceTypeRow | null>;
}

export interface ServiceTypeRequestRepository {
  add(providerId: string, requestedName: string): Promise<{ id: string }>;
}
