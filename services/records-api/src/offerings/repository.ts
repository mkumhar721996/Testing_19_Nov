export interface ProviderOffering {
  serviceType: string;
  price: { amount: string; unit: 'per hour' | 'fixed' };
  typeStatus: 'offered' | 'retired';
}

export interface OfferingRepository {
  listForProvider(providerId: string): Promise<ProviderOffering[]>;
  // Number of providers with an offering, keyed by service type id.
  providerCounts(): Promise<Record<string, number>>;
}
