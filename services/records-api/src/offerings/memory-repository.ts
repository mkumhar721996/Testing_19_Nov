import type { ServiceTypeRepository } from '../service-types/repository.js';
import type { OfferingRepository, ProviderOffering } from './repository.js';

interface OfferingRow {
  providerId: string;
  serviceTypeId: string;
  amount: string;
  unit: 'per hour' | 'fixed';
}

export class MemoryOfferingRepository implements OfferingRepository {
  private rows: OfferingRow[] = [];
  constructor(private serviceTypes: ServiceTypeRepository) {}

  add(row: OfferingRow) {
    this.rows.push(row);
  }
  async listForProvider(providerId: string): Promise<ProviderOffering[]> {
    const types = await this.serviceTypes.listAll();
    return this.rows
      .filter((o) => o.providerId === providerId)
      .map((o) => {
        const type = types.find((t) => t.id === o.serviceTypeId)!;
        return {
          serviceType: type.name,
          price: { amount: o.amount, unit: o.unit },
          typeStatus: type.retiredAt ? 'retired' : 'offered',
        };
      });
  }
  async providerCounts() {
    const counts: Record<string, Set<string>> = {};
    for (const o of this.rows) (counts[o.serviceTypeId] ??= new Set()).add(o.providerId);
    return Object.fromEntries(Object.entries(counts).map(([id, s]) => [id, s.size]));
  }
}
