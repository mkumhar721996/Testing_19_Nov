export interface FundraisingConsultant {
  name: string
  email?: string | null
  phone?: string | null
}

export interface OrganizationConsultant {
  consultant?: FundraisingConsultant | null
}
