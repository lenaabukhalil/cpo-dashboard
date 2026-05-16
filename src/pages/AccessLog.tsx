import { Navigate } from 'react-router-dom'

/** Legacy route — access events are shown on the unified Audit Log page. */
export default function AccessLog() {
  return <Navigate to="/audit-log" replace />
}
