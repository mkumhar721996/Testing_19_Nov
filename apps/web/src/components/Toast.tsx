import { useEffect } from 'react'

const VISIBLE_MS = 5000

export default function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, VISIBLE_MS)
    return () => clearTimeout(timer)
  }, [message, onDone])

  return (
    <div className="toast" role="status">
      <span>{message}</span>
    </div>
  )
}
