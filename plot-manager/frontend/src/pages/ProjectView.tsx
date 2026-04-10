import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import Header from '@/components/Header';
import PlotOverlayEditor from '@/components/PlotOverlayEditor';
import StatusLegend from '@/components/StatusLegend';
import AdminProjectActions from '@/components/AdminProjectActions';
import AddPlotDialog from '@/components/AddPlotDialog';
import { Button } from '@/components/ui/button';
import { ArrowLeft, MapPin, Grid3X3, Edit2, Eye } from 'lucide-react';
import { makeObjectUrlFromRef } from '@/lib/idbImageStore';
import sampleLayout from '@/assets/sample-layout.png';

const apiUrl = (path: string) => {
  const base = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  if (!base) return path;
  const baseNoSlash = base.endsWith('/') ? base.slice(0, -1) : base;
  const pathWithSlash = path.startsWith('/') ? path : `/${path}`;
  return `${baseNoSlash}${pathWithSlash}`;
};

export default function ProjectView() {
  const { projectId } = useParams<{ projectId: string }>();
  const { projects, currentProject, setCurrentProject, isAdmin } = useApp();
  const navigate = useNavigate();
  const [editMode, setEditMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [resolvedLayoutImage, setResolvedLayoutImage] = useState<string>(sampleLayout);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (projectId) {
      // First check if currentProject already matches (from navigation)
      if (currentProject && currentProject.id === projectId) {
        setIsLoading(false);
        return;
      }

      // Then look in projects array
      const project = projects.find((p) => p.id === projectId);
      if (project) {
        setCurrentProject(project);
        setIsLoading(false);

        if (!project.layoutImage) {
          fetch(apiUrl(`/api/projects/${projectId}`))
            .then((r) => (r.ok ? r.json() : null))
            .then((full) => {
              if (full && full.id === projectId) {
                setCurrentProject(full);
              }
            })
            .catch(() => {});
        }
      } else {
        // Don't redirect immediately - show loading and try to fetch
        fetch(apiUrl(`/api/projects/${projectId}`))
          .then((r) => (r.ok ? r.json() : null))
          .then((full) => {
            if (full && full.id === projectId) {
              setCurrentProject(full);
              setIsLoading(false);
            } else {
              navigate('/');
            }
          })
          .catch(() => {
            navigate('/');
          });
      }
    }
  }, [projectId, projects, setCurrentProject, navigate, currentProject]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const raw = currentProject?.layoutImage || '';
        if (!raw) {
          if (!cancelled) setResolvedLayoutImage(sampleLayout);
          return;
        }

        const next = await makeObjectUrlFromRef(raw);
        if (cancelled) return;

        if (next && next.startsWith('blob:')) {
          if (objectUrlRef.current && objectUrlRef.current !== next) {
            URL.revokeObjectURL(objectUrlRef.current);
          }
          objectUrlRef.current = next;
        } else if (objectUrlRef.current) {
          URL.revokeObjectURL(objectUrlRef.current);
          objectUrlRef.current = null;
        }

        setResolvedLayoutImage(next || sampleLayout);
      } catch {
        if (cancelled) return;
        setResolvedLayoutImage(sampleLayout);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentProject?.layoutImage]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

  if (isLoading || !currentProject) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-muted animate-pulse mx-auto mb-4" />
          <p className="text-muted-foreground">Loading project...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="flex-1 container px-4 py-6">
        {/* Project Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setCurrentProject(null);
              navigate('/');
            }}
            className="mb-4 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Projects
          </Button>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                {currentProject.name}
              </h1>
              <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-2 text-muted-foreground">
                <div className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  <span className="text-sm">{currentProject.location}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Grid3X3 className="w-4 h-4" />
                  <span className="text-sm">{currentProject.plots.length} Plots</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {/* Admin Controls */}
              {isAdmin && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/project/${currentProject.id}/map`)}
                    className="gap-2"
                  >
                    <MapPin className="w-4 h-4" />
                    Configure Map
                  </Button>
                  <Button
                    variant={editMode ? "default" : "outline"}
                    size="sm"
                    onClick={() => setEditMode(!editMode)}
                    className="gap-2"
                  >
                    {editMode ? (
                      <>
                        <Eye className="w-4 h-4" />
                        View Mode
                      </>
                    ) : (
                      <>
                        <Edit2 className="w-4 h-4" />
                        Edit Overlays
                      </>
                    )}
                  </Button>
                  <AddPlotDialog projectId={currentProject.id} />
                  <AdminProjectActions project={currentProject} />
                </>
              )}

              {!isAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/project/${currentProject.id}/map`)}
                  className="gap-2"
                >
                  <MapPin className="w-4 h-4" />
                  View Map
                </Button>
              )}
              <StatusLegend plots={currentProject.plots} />
            </div>
          </div>
        </div>

        {/* Layout Viewer */}
        <div className="bg-card border border-border rounded-2xl sm:p-4 overflow-hidden shadow-sm -mx-4 px-4 sm:mx-0 sm:px-0">
          <PlotOverlayEditor
            layoutImage={resolvedLayoutImage}
            plots={currentProject.plots}
            projectId={currentProject.id}
            project={currentProject}
            editMode={editMode}
          />
        </div>

        {/* Instructions */}
        <div className="mt-6 p-4 rounded-xl bg-secondary border border-border">
          <p className="text-sm text-muted-foreground text-center">
            {editMode && isAdmin ? (
              <>
                <span className="font-medium text-foreground">Edit Mode:</span> Drag plots to reposition, use corner handle to resize, click lock icon to secure position.
              </>
            ) : (
              <>
                <span className="font-medium text-foreground">Tip:</span> Hover over plots to see quick info, click to view full details.
              </>
            )}
          </p>
        </div>
      </main>
    </div>
  );
}
