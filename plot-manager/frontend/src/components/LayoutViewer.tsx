import { useState, useRef, MouseEvent as ReactMouseEvent } from 'react';
import { Plot, Project } from '@/types';
import { STATUS_COLORS } from '@/lib/plotUtils';
import { useApp } from '@/context/AppContext';
import PlotTooltip from './PlotTooltip';
import PlotModal from './PlotModal';

interface LayoutViewerProps {
  layoutImage: string;
  plots: Plot[];
  projectId: string;
  project: Project;
}

export default function LayoutViewer({
  layoutImage,
  plots,
  projectId,
  project,
}: LayoutViewerProps) {
  const { isAdmin, updatePlot, deletePlot } = useApp();

  const [hoveredPlot, setHoveredPlot] = useState<Plot | null>(null);
  const [selectedPlot, setSelectedPlot] = useState<Plot | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: ReactMouseEvent, plot: Plot) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setTooltipPosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    setHoveredPlot(plot);
  };

  return (
    /* 🔥 NO CARD WIDTH / NO SIDE MARGIN */
    <div className="relative w-full overflow-x-auto">
      {/* 🔒 IMAGE + OVERLAY AREA */}
      <div
        ref={containerRef}
        className="relative w-full mx-auto"
      >
        {/* IMAGE — FULL WIDTH, HEIGHT AUTO */}
        <img
          src={layoutImage}
          alt="Layout Plan"
          draggable={false}
          className="block w-full h-auto select-none"
        />

        {/* OVERLAYS — PERFECTLY LOCKED */}
        <div className="absolute inset-0">
          {plots.map((plot) => {
            const colors = STATUS_COLORS[plot.status];
            const isHovered = hoveredPlot?.id === plot.id;

            return (
              <div
                key={plot.id}
                className="absolute cursor-pointer transition-transform duration-200"
                style={{
                  left: `${plot.bounds.x}%`,
                  top: `${plot.bounds.y}%`,
                  width: `${plot.bounds.width}%`,
                  height: `${plot.bounds.height}%`,
                  backgroundColor: colors.bg,
                  border: `2px solid ${colors.border}`,
                  borderRadius: '4px',
                  transform: isHovered ? 'scale(1.03)' : 'scale(1)',
                  zIndex: isHovered ? 10 : 1,
                }}
                onMouseMove={(e) => handleMouseMove(e, plot)}
                onMouseLeave={() => setHoveredPlot(null)}
                onClick={() => setSelectedPlot(plot)}
              >
                <span
                  className="absolute inset-0 flex items-center justify-center font-bold pointer-events-none"
                  style={{
                    fontSize: 'clamp(8px, 1.2vw, 12px)',
                    color: '#111',
                    textShadow:
                      '0 1px 2px rgba(255,255,255,0.9), 0 0 4px rgba(255,255,255,0.8)',
                  }}
                >
                  {plot.plotNumber}
                </span>
              </div>
            );
          })}
        </div>

        {hoveredPlot && (
          <PlotTooltip plot={hoveredPlot} position={tooltipPosition} />
        )}
      </div>

      {selectedPlot && (
        <PlotModal
          plot={selectedPlot}
          project={project}
          isAdmin={isAdmin}
          onClose={() => setSelectedPlot(null)}
          onUpdate={(u) =>
            selectedPlot &&
            updatePlot(projectId, selectedPlot.id, u)
          }
          onDelete={() =>
            selectedPlot &&
            deletePlot(projectId, selectedPlot.id)
          }
        />
      )}
    </div>
  );
}
