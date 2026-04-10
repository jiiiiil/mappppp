import { PlotStatus } from '@/types';

export const STATUS_COLORS: Record<PlotStatus, { bg: string; border: string; label: string }> = {
  available: {
    bg: 'rgba(34, 197, 94, 0.4)',
    border: 'rgba(34, 197, 94, 0.8)',
    label: 'Available',
  },
  booked: {
    bg: 'rgba(250, 204, 21, 0.4)',
    border: 'rgba(250, 204, 21, 0.8)',
    label: 'Booked',
  },
  sold: {
    bg: 'rgba(239, 68, 68, 0.4)',
    border: 'rgba(239, 68, 68, 0.8)',
    label: 'Sold',
  },
  mortgaged: {
    bg: 'rgba(148, 163, 184, 0.4)',
    border: 'rgba(148, 163, 184, 0.8)',
    label: 'Mortgaged',
  },
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
};

export const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};
