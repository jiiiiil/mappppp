import { useState } from 'react';
import { Plot, PlotStatus } from '@/types';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

interface AddPlotDialogProps {
  projectId: string;
}

export default function AddPlotDialog({ projectId }: AddPlotDialogProps) {
  const { addPlot, isAdmin } = useApp();
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    plotNumber: '',
    area: '',
    dimensions: '',
    facing: '',
    price: '',
    status: 'available' as PlotStatus,
    // Default position - admin can drag to adjust
    x: '10',
    y: '10',
    width: '5',
    height: '5',
  });

  if (!isAdmin) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.plotNumber.trim()) {
      toast.error('Please enter a plot number');
      return;
    }

    const newPlot: Plot = {
      id: Date.now().toString(),
      plotNumber: formData.plotNumber.trim(),
      area: parseFloat(formData.area) || 0,
      dimensions: formData.dimensions.trim(),
      facing: formData.facing.trim(),
      price: parseFloat(formData.price) || 0,
      status: formData.status,
      bounds: {
        x: parseFloat(formData.x) || 10,
        y: parseFloat(formData.y) || 10,
        width: parseFloat(formData.width) || 5,
        height: parseFloat(formData.height) || 5,
      },
      isLocked: false,
    };

    addPlot(projectId, newPlot);
    toast.success('Plot added successfully! Drag to position it on the layout.');
    setOpen(false);
    setFormData({
      plotNumber: '',
      area: '',
      dimensions: '',
      facing: '',
      price: '',
      status: 'available',
      x: '10',
      y: '10',
      width: '5',
      height: '5',
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Plus className="w-4 h-4" />
          Add Plot
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Plot</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="plotNumber">Plot Number *</Label>
              <Input
                id="plotNumber"
                value={formData.plotNumber}
                onChange={(e) => setFormData({ ...formData, plotNumber: e.target.value })}
                placeholder="e.g., 25 or 1+2+3"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value: PlotStatus) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="booked">Booked</SelectItem>
                  <SelectItem value="sold">Sold</SelectItem>
                  <SelectItem value="mortgaged">Mortgaged</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="area">Area (sq.yd)</Label>
              <Input
                id="area"
                type="number"
                value={formData.area}
                onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                placeholder="e.g., 150"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="dimensions">Dimensions</Label>
              <Input
                id="dimensions"
                value={formData.dimensions}
                onChange={(e) => setFormData({ ...formData, dimensions: e.target.value })}
                placeholder="e.g., 15' x 10'"
                className="mt-1.5"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="facing">Facing</Label>
              <Input
                id="facing"
                value={formData.facing}
                onChange={(e) => setFormData({ ...formData, facing: e.target.value })}
                placeholder="e.g., North"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="price">Price (₹)</Label>
              <Input
                id="price"
                type="number"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                placeholder="e.g., 500000"
                className="mt-1.5"
              />
            </div>
          </div>

          <div className="p-3 rounded-lg bg-muted/50 border border-border">
            <p className="text-xs text-muted-foreground mb-3">
              Initial overlay position (you can drag/resize after adding):
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <Label htmlFor="x" className="text-xs">X (%)</Label>
                <Input
                  id="x"
                  type="number"
                  value={formData.x}
                  onChange={(e) => setFormData({ ...formData, x: e.target.value })}
                  className="mt-1 h-8 text-sm"
                />
              </div>
              <div>
                <Label htmlFor="y" className="text-xs">Y (%)</Label>
                <Input
                  id="y"
                  type="number"
                  value={formData.y}
                  onChange={(e) => setFormData({ ...formData, y: e.target.value })}
                  className="mt-1 h-8 text-sm"
                />
              </div>
              <div>
                <Label htmlFor="width" className="text-xs">W (%)</Label>
                <Input
                  id="width"
                  type="number"
                  value={formData.width}
                  onChange={(e) => setFormData({ ...formData, width: e.target.value })}
                  className="mt-1 h-8 text-sm"
                />
              </div>
              <div>
                <Label htmlFor="height" className="text-xs">H (%)</Label>
                <Input
                  id="height"
                  type="number"
                  value={formData.height}
                  onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                  className="mt-1 h-8 text-sm"
                />
              </div>
            </div>
          </div>

          <Button type="submit" className="w-full">
            <Plus className="w-4 h-4 mr-2" />
            Add Plot
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
