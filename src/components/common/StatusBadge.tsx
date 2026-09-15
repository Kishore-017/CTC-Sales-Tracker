import React from 'react';
import { PaymentStatus } from '../../types/database';
import { getPaymentStatusDetails } from '../../lib/formatters';

interface StatusBadgeProps {
  status: PaymentStatus;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const details = getPaymentStatusDetails(status);

  const sizeStyles = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-semibold rounded-full border ${details.bg} ${sizeStyles[size]}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${details.dot}`} />
      <span>{details.label}</span>
    </span>
  );
};
