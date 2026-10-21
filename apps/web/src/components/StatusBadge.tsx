import type { CheckOutcome } from '@deploylens/contracts';
import { resultLabels } from './presentation.js';
export function StatusBadge({ outcome }: { outcome: CheckOutcome }) {
  return <span className={`status-badge ${outcome}`}><span/>{resultLabels[outcome]}</span>;
}
