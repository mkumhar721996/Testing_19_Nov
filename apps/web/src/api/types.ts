export interface ServiceType {
  id: string
  name: string
}

export interface AdminServiceType extends ServiceType {
  status: 'offered' | 'retired'
  providersStillOffering: number
}

export interface ProviderOffering {
  serviceType: string
  price: { amount: string; unit: 'per hour' | 'fixed' }
  typeStatus: 'offered' | 'retired'
}
