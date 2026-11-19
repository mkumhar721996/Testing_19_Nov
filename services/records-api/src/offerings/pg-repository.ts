import type { Pool } from 'pg';
import type { OfferingRepository, ProviderOffering } from './repository.js';

export class PgOfferingRepository implements OfferingRepository {
  constructor(private pool: Pool) {}

  async listForProvider(providerId: string): Promise<ProviderOffering[]> {
    const r = await this.pool.query<{ name: string; price_amount: string; price_unit: 'per hour' | 'fixed'; retired_at: Date | null }>(
      `select t.name, o.price_amount, o.price_unit, t.retired_at
         from offerings o join service_types t on t.id = o.service_type_id
        where o.provider_id = $1 order by t.name`,
      [providerId],
    );
    return r.rows.map((row) => ({
      serviceType: row.name,
      price: { amount: row.price_amount, unit: row.price_unit },
      typeStatus: row.retired_at ? 'retired' : 'offered',
    }));
  }
  async providerCounts() {
    const r = await this.pool.query<{ service_type_id: string; n: string }>(
      'select service_type_id, count(distinct provider_id) as n from offerings group by service_type_id',
    );
    return Object.fromEntries(r.rows.map((row) => [row.service_type_id, Number(row.n)]));
  }
}
