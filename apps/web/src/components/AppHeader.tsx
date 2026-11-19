import type { AuthUser } from '../auth/types'

interface AppHeaderProps {
  user: AuthUser
  onSignOut: () => void
}

export default function AppHeader({ user, onSignOut }: AppHeaderProps) {
  return (
    <header className="shell-header">
      <span className="shell-brand">Records</span>
      <div className="cluster">
        <span className="text-bold">{user.displayName}</span>
        <span className="badge badge-neutral">{user.roleLabel}</span>
        {user.organization && <span className="text-muted">{user.organization.name}</span>}
        <button type="button" className="btn btn-secondary btn-sm" onClick={onSignOut}>
          Sign out
        </button>
      </div>
    </header>
  )
}
