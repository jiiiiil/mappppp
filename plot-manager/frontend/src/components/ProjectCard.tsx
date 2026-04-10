import { useEffect, useRef, useState } from 'react';
import { Project } from '@/types';
import { useApp } from '@/context/AppContext';
import { MapPin, Calendar, Grid3X3, MoreVertical, Edit2, Trash2, Phone } from 'lucide-react';
import { formatDate } from '@/lib/plotUtils';
import { Button } from '@/components/ui/button';
import sampleLayout from '@/assets/sample-layout.png';
import { makeObjectUrlFromRef } from '@/lib/idbImageStore';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface ProjectCardProps {
  project: Project;
  onClick: () => void;
}

export default function ProjectCard({ project, onClick }: ProjectCardProps) {
  const { isAdmin, updateProject, deleteProject } = useApp();
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [resolvedLayoutImage, setResolvedLayoutImage] = useState<string>(sampleLayout);
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const objectUrlRef = useRef<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: project.name,
    location: project.location,
    description: project.description || '',
    contactDetails: project.contactDetails || '',
  });

  useEffect(() => {
    let cancelled = false;

    const loadImage = async () => {
      setImageLoading(true);
      setImageError(false);
      
      try {
        const raw = project.layoutImage;
        
        // If no custom image, use sample layout immediately
        if (!raw) {
          if (cancelled) return;
          setResolvedLayoutImage(sampleLayout);
          setImageLoading(false);
          return;
        }

        // Try to resolve the custom image
        const next = await makeObjectUrlFromRef(raw);
        if (cancelled) return;

        // If URL resolution failed (e.g., S3 error), use fallback
        if (!next && raw.startsWith('s3:')) {
          console.warn('S3 image failed to load for project card, using fallback');
          if (cancelled) return;
          setResolvedLayoutImage(sampleLayout);
          setImageLoading(false);
          return;
        }

        if (next && next.startsWith('blob:')) {
          if (objectUrlRef.current && objectUrlRef.current !== next) {
            URL.revokeObjectURL(objectUrlRef.current);
          }
          objectUrlRef.current = next;
        } else if (objectUrlRef.current) {
          URL.revokeObjectURL(objectUrlRef.current);
          objectUrlRef.current = null;
        }

        if (cancelled) return;
        setResolvedLayoutImage(next || sampleLayout);
        setImageLoading(false);
      } catch (error) {
        console.warn('Failed to load project image:', error);
        if (cancelled) return;
        setResolvedLayoutImage(sampleLayout);
        setImageError(true);
        setImageLoading(false);
      }
    };

    loadImage();

    return () => {
      cancelled = true;
    };
  }, [project.layoutImage]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

  const plotStats = {
    total: project.plots.length,
    available: project.plots.filter((p) => p.status === 'available').length,
    booked: project.plots.filter((p) => p.status === 'booked').length,
    sold: project.plots.filter((p) => p.status === 'sold').length,
  };

  const handleEditSave = () => {
    updateProject(project.id, {
      name: editForm.name.trim(),
      location: editForm.location.trim(),
      description: editForm.description.trim() || undefined,
      contactDetails: editForm.contactDetails.trim() || undefined,
    });
    toast.success('Project updated successfully');
    setShowEditDialog(false);
  };

  const handleDelete = () => {
    deleteProject(project.id);
    toast.success('Project deleted successfully');
    setShowDeleteDialog(false);
  };

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <>
      <div
        onClick={onClick}
        className="group glass glass-hover rounded-2xl overflow-hidden cursor-pointer transform transition-all duration-300 hover:scale-[1.02] hover:shadow-lg relative"
      >
        {/* Admin Menu */}
        {isAdmin && (
          <div className="absolute top-3 right-3 z-10" onClick={handleMenuClick}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-8 w-8 bg-background/80 backdrop-blur-sm shadow-md"
                >
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={() => setShowEditDialog(true)}>
                  <Edit2 className="w-4 h-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => setShowDeleteDialog(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {/* Image Preview */}
        <div className="relative h-48 overflow-hidden bg-muted/20">
          {imageLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/30">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          <img
            src={resolvedLayoutImage}
            alt={project.name}
            onLoad={() => {
              setImageLoading(false);
            }}
            onError={(e) => {
              setImageError(true);
              setImageLoading(false);
              setResolvedLayoutImage(sampleLayout);
            }}
            className={`w-full h-full object-cover transform transition-all duration-500 group-hover:scale-110 ${
              imageLoading ? 'opacity-0' : 'opacity-100'
            }`}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/20 to-transparent" />
          
          {/* Stats Overlay */}
          <div className="absolute bottom-4 left-4 right-4 flex flex-wrap gap-2">
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-status-available/20 border border-status-available/40">
              <span className="w-2 h-2 rounded-full bg-status-available" />
              <span className="text-xs font-medium text-foreground">{plotStats.available}</span>
            </div>
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-status-booked/20 border border-status-booked/40">
              <span className="w-2 h-2 rounded-full bg-status-booked" />
              <span className="text-xs font-medium text-foreground">{plotStats.booked}</span>
            </div>
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-status-sold/20 border border-status-sold/40">
              <span className="w-2 h-2 rounded-full bg-status-sold" />
              <span className="text-xs font-medium text-foreground">{plotStats.sold}</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-5">
          <h3 className="text-xl font-bold text-foreground mb-2 group-hover:text-primary transition-colors">
            {project.name}
          </h3>
          
          <div className="space-y-2 text-sm min-w-0">
            <div className="flex items-center gap-2 text-muted-foreground min-w-0">
              <MapPin className="w-4 h-4" />
              <span className="truncate">{project.location}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Grid3X3 className="w-4 h-4" />
              <span>{plotStats.total} Plots</span>
            </div>
            {project.contactDetails && (
              <div className="flex items-center gap-2 text-muted-foreground min-w-0">
                <Phone className="w-4 h-4" />
                <span className="truncate">{project.contactDetails}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="w-4 h-4" />
              <span>Created {formatDate(project.createdAt)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Project Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-md" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="editCardName">Project Name</Label>
              <Input
                id="editCardName"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="editCardLocation">Location</Label>
              <Input
                id="editCardLocation"
                value={editForm.location}
                onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="editCardDescription">Description</Label>
              <Input
                id="editCardDescription"
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="editCardContact">Contact Details</Label>
              <Input
                id="editCardContact"
                value={editForm.contactDetails}
                onChange={(e) => setEditForm({ ...editForm, contactDetails: e.target.value })}
                className="mt-1.5"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button onClick={handleEditSave} className="flex-1">
                Save Changes
              </Button>
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-sm" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
          </DialogHeader>
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-destructive" />
            </div>
            <h3 className="font-semibold text-foreground text-lg">Delete Project?</h3>
            <p className="text-sm text-muted-foreground mt-2">
              This will permanently delete "{project.name}" and all its plots.
            </p>
            <div className="flex gap-3 justify-center pt-6">
              <Button variant="destructive" onClick={handleDelete}>
                Delete
              </Button>
              <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
