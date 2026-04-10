import { Plot } from '@/types';
import { STATUS_COLORS, formatCurrency } from '@/lib/plotUtils';

interface PlotTooltipProps {
  plot: Plot;
  position: { x: number; y: number };
}

export default function PlotTooltip({ plot, position }: PlotTooltipProps) {
  const colors = STATUS_COLORS[plot.status];

  // Position tooltip to avoid edge overflow
  const tooltipStyle = {
    left: position.x + 15,
    top: position.y + 15,
  };

  return (
    <div
      className="absolute z-50 pointer-events-none animate-fade-in hidden sm:block"
      style={tooltipStyle}
    >
      <div className="bg-card border border-border rounded-xl shadow-lg p-4 min-w-[200px]">
        {/* Header */}
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-border">
          <span className="text-lg font-bold text-foreground">
            Unit {plot.plotNumber}
          </span>
          <span
            className="px-2 py-1 rounded-full text-xs font-medium"
            style={{
              backgroundColor: colors.bg,
              border: `1px solid ${colors.border}`,
              color: colors.border,
            }}
          >
            {colors.label}
          </span>
        </div>

        {/* Details */}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Area</span>
            <span className="text-foreground font-medium">{plot.area} sq.yd</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Facing</span>
            <span className="text-foreground font-medium">{plot.facing}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Price</span>
            <span className="text-primary font-bold">{formatCurrency(plot.price)}</span>
          </div>
        </div>

        {/* Click hint */}
        <div className="mt-3 pt-2 border-t border-border text-center">
          <span className="text-xs text-muted-foreground">Click for details</span>
        </div>
      </div>
    </div>
  );
}
