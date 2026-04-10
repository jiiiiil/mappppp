import { useState, useRef } from 'react';
import { Project } from '@/types';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Settings, Edit2, Trash2, Upload, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';

interface AdminProjectActionsProps {
  project: Project;
}

export default function AdminProjectActions({ project }: AdminProjectActionsProps) {
  const { updateProject, deleteProject, isAdmin, user } = useApp();
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showImageDialog, setShowImageDialog] = useState(false);
  
  const [editForm, setEditForm] = useState({
    name: project.name,
    location: project.location,
    description: project.description || '',
    contactDetails: project.contactDetails || '',
  });
  
  const [newLayoutImage, setNewLayoutImage] = useState<string>('');
  const [newLayoutFile, setNewLayoutFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const apiUrl = (path: string) => {
    const base = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
    if (!base) return path;
    const baseNoSlash = base.endsWith('/') ? base.slice(0, -1) : base;
    const pathWithSlash = path.startsWith('/') ? path : `/${path}`;
    return `${baseNoSlash}${pathWithSlash}`;
  };

  const uploadImageToStorage = async (file: File, prefix: string) => {
    const extRaw = file.name.split('.').pop() || '';
    const ext = extRaw.toLowerCase().replace(/[^a-z0-9]/g, '');

    const token = user?.token;
    const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

    const presign = await fetch(apiUrl('/api/storage/presign-upload'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ contentType: file.type, prefix, ext }),
    });
    if (!presign.ok) throw new Error('Could not prepare upload');
    const presignJson = (await presign.json()) as { key?: string; url?: string };
    if (!presignJson?.key || !presignJson?.url) throw new Error('Could not prepare upload');

    const put = await fetch(presignJson.url, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    });
    if (!put.ok) throw new Error('Upload failed');
    return `s3:${presignJson.key}`;
  };

  if (!isAdmin) return null;

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('Please upload an image file');
        return;
      }
      setFileName(file.name);
      setNewLayoutFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setNewLayoutImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageSave = async () => {
    if (!newLayoutImage || !newLayoutFile) {
      toast.error('Please select an image');
      return;
    }

    let ref = newLayoutImage;
    try {
      ref = await uploadImageToStorage(newLayoutFile, 'project-layouts');
    } catch {
      // S3 upload failed, use base64 data URL instead
    }
    updateProject(project.id, { layoutImage: ref });

    toast.success('Layout image updated successfully');
    setShowImageDialog(false);
    setNewLayoutImage('');
    setNewLayoutFile(null);
    setFileName('');
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Settings className="w-4 h-4" />
            Manage Project
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => setShowEditDialog(true)}>
            <Edit2 className="w-4 h-4 mr-2" />
            Edit Project
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setShowImageDialog(true)}>
            <ImageIcon className="w-4 h-4 mr-2" />
            Replace Layout Image
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem 
            onClick={() => setShowDeleteDialog(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Project
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Edit Project Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="editName">Project Name</Label>
              <Input
                id="editName"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="editLocation">Location</Label>
              <Input
                id="editLocation"
                value={editForm.location}
                onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="editDescription">Description</Label>
              <Input
                id="editDescription"
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="editContact">Contact Details</Label>
              <Input
                id="editContact"
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
        <DialogContent className="sm:max-w-sm">
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-destructive" />
            </div>
            <h3 className="font-semibold text-foreground text-lg">Delete Project?</h3>
            <p className="text-sm text-muted-foreground mt-2">
              This will permanently delete "{project.name}" and all its plots. This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-center pt-6">
              <Button variant="destructive" onClick={handleDelete}>
                Delete Project
              </Button>
              <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Replace Layout Image Dialog */}
      <Dialog open={showImageDialog} onOpenChange={setShowImageDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Replace Layout Image</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border rounded-xl p-6 cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-all text-center"
            >
              {newLayoutImage ? (
                <div className="space-y-3">
                  <img
                    src={newLayoutImage}
                    alt="Preview"
                    className="w-full h-40 object-contain rounded-lg"
                  />
                  <p className="text-sm text-muted-foreground">{fileName}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mx-auto">
                    <Upload className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    Click to upload new layout image
                  </p>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <Button onClick={handleImageSave} className="flex-1" disabled={!newLayoutImage}>
                <Upload className="w-4 h-4 mr-2" />
                Update Image
              </Button>
              <Button variant="outline" onClick={() => {
                setShowImageDialog(false);
                setNewLayoutImage('');
                setFileName('');
              }}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
