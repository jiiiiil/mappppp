import { STATUS_COLORS } from '@/lib/plotUtils';
import { Plot } from '@/types';

interface StatusLegendProps {
  plots: Plot[];
}

export default function StatusLegend({ plots }: StatusLegendProps) {
  const stats = {
    available: plots.filter((p) => p.status === 'available').length,
    booked: plots.filter((p) => p.status === 'booked').length,
    sold: plots.filter((p) => p.status === 'sold').length,
    mortgaged: plots.filter((p) => p.status === 'mortgaged').length,
  };

  const legendItems = [
    { key: 'available', label: 'Available', count: stats.available },
    { key: 'booked', label: 'Booked', count: stats.booked },
    { key: 'sold', label: 'Sold', count: stats.sold },
    { key: 'mortgaged', label: 'Mortgaged', count: stats.mortgaged },
  ] as const;

  return (
    <div className="flex flex-wrap gap-2 sm:gap-3">
      {legendItems.map(({ key, label, count }) => {
        const colors = STATUS_COLORS[key];
        return (
          <div
            key={key}
            className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-secondary"
          >
            <div
              className="w-4 h-4 rounded"
              style={{
                backgroundColor: colors.bg,
                border: `2px solid ${colors.border}`,
              }}
            />
            <span className="text-xs sm:text-sm text-foreground font-medium">{label}</span>
            <span className="text-xs sm:text-sm text-muted-foreground">({count})</span>
          </div>
        );
      })}
    </div>
  );
}
