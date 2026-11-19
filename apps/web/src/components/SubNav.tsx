// In-page navigation bar; only the current tab is built in this story, the others are placeholders.
export default function SubNav({ title, current, others }: { title: string; current: string; others: string[] }) {
  return (
    <div className="subnav">
      <strong>{title}</strong>
      <nav className="subnav-links tabs" aria-label={title}>
        {others.slice(0, 1).map((label) => (
          <button key={label} type="button" className="tab" disabled>
            {label}
          </button>
        ))}
        <button type="button" className="tab is-active" aria-current="page">
          {current}
        </button>
        {others.slice(1).map((label) => (
          <button key={label} type="button" className="tab" disabled>
            {label}
          </button>
        ))}
      </nav>
    </div>
  )
}
