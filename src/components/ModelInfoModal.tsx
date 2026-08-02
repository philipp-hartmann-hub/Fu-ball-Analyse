/**
 * @deprecated Nutze ExplainModal mit topic="forecast".
 * Bleibt als dünner Wrapper, falls alte Imports existieren.
 */
import { ExplainModal } from './ExplainModal'

interface Props {
  open: boolean
  onClose: () => void
}

export function ModelInfoModal({ open, onClose }: Props) {
  return <ExplainModal topic={open ? 'forecast' : null} onClose={onClose} />
}
