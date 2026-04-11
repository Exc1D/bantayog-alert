import React from 'react';

type Status = 'pending' | 'verified' | 'resolved' | 'false_alarm';

interface StatusBadgeProps {
  status: Status;
  text?: string;
}

const statusConfig = {
  pending: { text: 'Pending', bg: 'bg-status-pending' },
  verified: { text: 'Verified', bg: 'bg-status-verified' },
  resolved: { text: 'Resolved', bg: 'bg-status-resolved' },
  false_alarm: { text: 'False Alarm', bg: 'bg-gray-400' },
};

export function StatusBadge({ status, text }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium text-white ${config.bg}`}>
      {text || config.text}
    </span>
  );
}
