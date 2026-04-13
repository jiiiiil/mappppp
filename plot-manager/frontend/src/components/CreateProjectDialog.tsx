import { useState, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Upload, Image as ImageIcon, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import sampleLayout from '@/assets/sample-layout.png';
import { uploadImageToMongo } from '@/lib/idbImageStore';

interface CreateProjectDialogProps {
  onProjectCreated?: () => void;
}

export default function CreateProjectDialog({ onProjectCreated }: CreateProjectDialogProps) {
  const { addProject, user } = useApp();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [contactDetails, setContactDetails] = useState('');
  const [layoutImage, setLayoutImage] = useState<string>('');
  const [layoutFile, setLayoutFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const apiUrl = (path: string) => {
    const base = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
    if (!base) return path;
    const baseNoSlash = base.endsWith('/') ? base.slice(0, -1) : base;
    const pathWithSlash = path.startsWith('/') ? path : `/${path}`;
    return `${baseNoSlash}${pathWithSlash}`;
  };

  const uploadImageToStorage = async (file: File) => {
    console.log('[uploadImageToStorage] Starting with file:', file.name, file.type, file.size);
    // Convert file to base64 data URL
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => resolve(event.target?.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    console.log('[uploadImageToStorage] File converted to base64, length:', dataUrl.length);

    try {
      // Upload to MongoDB
      const result = await uploadImageToMongo(dataUrl, file.type);
      console.log('[uploadImageToStorage] Upload success:', result);
      return `mongo:${result.id}`;
    } catch (error) {
      console.error('[uploadImageToStorage] Upload failed:', error);
      throw error;
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('Please upload an image file');
        return;
      }

      setFileName(file.name);
      setLayoutFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setLayoutImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Please enter a project name');
      return;
    }

    if (!location.trim()) {
      toast.error('Please enter a location');
      return;
    }

    let storedLayoutImage = sampleLayout;
    if (layoutFile) {
      try {
        console.log('[handleSubmit] Uploading layout file...');
        storedLayoutImage = await uploadImageToStorage(layoutFile);
        console.log('[handleSubmit] Upload complete, storedLayoutImage:', storedLayoutImage);
      } catch (error) {
        console.error('[handleSubmit] Upload failed, using fallback:', error);
        toast.error('Image upload failed. Using fallback layout.');
        storedLayoutImage = layoutImage || sampleLayout;
      }
    } else if (layoutImage) {
      storedLayoutImage = layoutImage;
    }

    addProject({
      name: name.trim(),
      location: location.trim(),
      description: description.trim() || undefined,
      contactDetails: contactDetails.trim() || undefined,
      layoutImage: storedLayoutImage,
    });

    toast.success('Project created successfully!');
    setOpen(false);
    setName('');
    setLocation('');
    setDescription('');
    setContactDetails('');
    setLayoutImage('');
    setLayoutFile(null);
    setFileName('');
    onProjectCreated?.();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          New Project
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <Label htmlFor="projectName">Project Name</Label>
            <Input
              id="projectName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Green Valley Residency"
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g., Sector 45, Gurgaon"
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="description">Description (Optional)</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Premium residential plots"
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="contactDetails">Contact Details (Optional)</Label>
            <Input
              id="contactDetails"
              value={contactDetails}
              onChange={(e) => setContactDetails(e.target.value)}
              placeholder="e.g., +91 98765 43210"
              className="mt-1.5"
            />
          </div>

          <div className="space-y-2">
            <Label>Layout Image (Optional)</Label>
            <div className="relative">
              <Input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                ref={fileInputRef}
                className="hidden"
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                className="mt-1.5 border-2 border-dashed border-border rounded-xl p-6 cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-all text-center"
              >
                {layoutImage ? (
                  <div className="space-y-3">
                    <img
                      src={layoutImage}
                      alt="Preview"
                      className="w-full h-32 object-contain rounded-lg"
                    />
                    <p className="text-sm text-muted-foreground">{fileName}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mx-auto">
                      <ImageIcon className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Click to upload layout image</p>
                      <p className="text-xs text-muted-foreground mt-1">PNG, JPG or WEBP (max 10MB)</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div>
            <Label>Map (Optional)</Label>
            <Button
              type="button"
              variant="outline"
              className="w-full mt-1.5 gap-2"
              onClick={() => window.open('/aradhana-map', '_blank', 'noopener,noreferrer')}
            >
              <MapPin className="w-4 h-4" />
              Open Map Tool
            </Button>
          </div>

          <Button type="submit" className="w-full">
            <Upload className="w-4 h-4 mr-2" />
            Create Project
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
