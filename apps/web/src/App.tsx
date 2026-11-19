import { useEffect, useState } from 'react'
import { EditProfilePage } from './pages/EditProfilePage'
import { ProviderProfilePage } from './pages/ProviderProfilePage'
import { ReviewProfilePage } from './pages/ReviewProfilePage'

const PROFILE = /^#\/providers\/([^/]+)$/
const REVIEW = /^#\/admin\/providers\/([^/]+)\/review$/

// Target of the Settings entry until the Admin Console epic provides a review list.
const DEFAULT_REVIEW_PROVIDER = 'p1'

const NAV = [
  { id: 'records', label: 'Records', href: '#/' },
  { id: 'reports', label: 'Reports', href: '#/' },
  { id: 'settings', label: 'Settings', href: `#/admin/providers/${DEFAULT_REVIEW_PROVIDER}/review` },
  { id: 'account', label: 'Account', href: '#/account/profile' },
]

function navKeyFor(hash: string): string {
  if (REVIEW.test(hash)) return 'settings'
  if (hash === '#/account/profile') return 'account'
  return 'records'
}

function Screen({ hash }: { hash: string }) {
  const profile = PROFILE.exec(hash)
  if (profile) return <ProviderProfilePage providerId={profile[1]} />
  const review = REVIEW.exec(hash)
  if (review) return <ReviewProfilePage providerId={review[1]} />
  if (hash === '#/account/profile') return <EditProfilePage />
  return null
}

export default function App() {
  const [hash, setHash] = useState(window.location.hash)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onChange = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  const current = navKeyFor(hash)
  return (
    <>
      <header className="shell-header">
        <a className="shell-brand" href="#/">
          Records
        </a>
        <button
          type="button"
          className="btn btn-secondary btn-sm shell-toggle"
          aria-controls="main-nav"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          Menu
        </button>
        <nav className="shell-nav" id="main-nav" aria-label="Main" data-open={open}>
          {NAV.map((n) => (
            <a
              key={n.id}
              className="shell-link"
              data-nav-key={n.id}
              href={n.href}
              aria-current={n.id === current ? 'page' : undefined}
              onClick={() => setOpen(false)}
            >
              {n.label}
            </a>
          ))}
        </nav>
      </header>
      <main className="shell-main">
        <Screen hash={hash} />
      </main>
    </>
  )
}
