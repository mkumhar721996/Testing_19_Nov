import { DuplicateNameError, type ServiceTypeRepository } from '../service-types/repository.js';
import { STARTER_SERVICE_TYPES } from '../service-types/seed-data.js';

// Idempotent: a starter type that already exists (by normalised name) is left alone.
export async function seed(repo: ServiceTypeRepository) {
  for (const name of STARTER_SERVICE_TYPES) {
    try {
      await repo.create(name);
    } catch (err) {
      if (!(err instanceof DuplicateNameError)) throw err;
    }
  }
}
