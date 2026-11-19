import type { ReactNode } from 'react'

export type BannerTone = 'info' | 'success' | 'warning' | 'danger'

export function Banner({ tone, children }: { tone: BannerTone; children: ReactNode }) {
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={`alert alert-${tone} flash`}>
      {children}
    </div>
  )
}
