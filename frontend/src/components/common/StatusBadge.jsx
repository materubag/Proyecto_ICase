import React from 'react';
export default function StatusBadge({ status }) {
  const color = { APPROVED: 'badge-success', PENDING_REVIEW: 'badge-warning', OUTDATED: 'badge-warning', ERROR: 'badge-error', REJECTED: 'badge-error', REMOVED: 'badge-error' }[status] || 'badge-neutral';
  return <span className={`badge ${color}`}>{status}</span>;
}
