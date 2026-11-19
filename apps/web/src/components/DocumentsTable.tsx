import type { ReactNode } from 'react'
import type { DocumentMeta } from '../api/profiles'

const LABEL = { licence: 'Licence', insurance: 'Insurance' } as const

export const documentLabel = (t: DocumentMeta['type']) => LABEL[t]

export function DocumentsTable({
  documents,
  showStatus = false,
  action,
}: {
  documents: DocumentMeta[]
  showStatus?: boolean
  action?: (d: DocumentMeta) => ReactNode
}) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th scope="col">Type</th>
            <th scope="col">File</th>
            <th scope="col">Uploaded</th>
            {showStatus && <th scope="col">Status</th>}
            {action && <th scope="col">Action</th>}
          </tr>
        </thead>
        <tbody>
          {documents.map((d) => (
            <tr key={d.type}>
              <td>{LABEL[d.type]}</td>
              <td className="doc-name">{d.fileName}</td>
              <td>{new Date(d.uploadedAt).toLocaleDateString()}</td>
              {showStatus && (
                <td>
                  <span className="badge badge-warning">Awaiting review</span>
                </td>
              )}
              {action && <td>{action(d)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
