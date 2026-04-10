import { useState } from 'react';
import type { ComponentType } from 'react';
import { Plot, PlotStatus, Project } from '@/types';
import { STATUS_COLORS, formatCurrency, formatDate } from '@/lib/plotUtils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Edit2, Save, MapPin, Ruler, Compass, IndianRupee, User, Calendar, FileText, Building2, Phone, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface PlotModalProps {
  plot: Plot;
  project: Project;
  isAdmin: boolean;
  onClose: () => void;
  onUpdate: (updates: Partial<Plot>) => void;
  onDelete: () => void;
}

export default function PlotModal({ plot, project, isAdmin, onClose, onUpdate, onDelete }: PlotModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [formData, setFormData] = useState({
    plotNumber: plot.plotNumber,
    area: plot.area,
    dimensions: plot.dimensions,
    facing: plot.facing,
    price: plot.price,
    status: plot.status,
    ownerName: plot.ownerName || '',
    saleDate: plot.saleDate || '',
    notes: plot.notes || '',
  });

  const colors = STATUS_COLORS[plot.status];

  const handleSave = () => {
    onUpdate(formData);
    setIsEditing(false);
    toast.success('Plot updated successfully');
  };

  const handleDelete = () => {
    onDelete();
    toast.success('Plot deleted successfully');
  };

  const DetailRow = ({
    icon: Icon,
    label,
    value,
  }: {
    icon: ComponentType<{ className?: string }>;
    label: string;
    value: string | number;
  }) => (
    <div className="flex items-center gap-3 py-2">
      <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      <span className="text-muted-foreground text-sm w-24">{label}</span>
      <span className="text-foreground font-medium">{value}</span>
    </div>
  );

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-foreground/20 animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-card border-t sm:border border-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[85vh] sm:max-h-[90vh] overflow-hidden shadow-xl animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-foreground">
              Unit {plot.plotNumber}
            </h2>
            <span
              className="px-3 py-1 rounded-full text-sm font-medium"
              style={{
                backgroundColor: colors.bg,
                border: `1px solid ${colors.border}`,
                color: colors.border,
              }}
            >
              {colors.label}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && !isEditing && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsEditing(true)}
                className="text-muted-foreground hover:text-foreground"
              >
                <Edit2 className="w-4 h-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          {isEditing ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="plotNumber">Plot Number</Label>
                  <Input
                    id="plotNumber"
                    value={formData.plotNumber}
                    onChange={(e) => setFormData({ ...formData, plotNumber: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="area">Area (sq.yd)</Label>
                  <Input
                    id="area"
                    type="number"
                    value={formData.area}
                    onChange={(e) => setFormData({ ...formData, area: parseFloat(e.target.value) })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="dimensions">Dimensions</Label>
                  <Input
                    id="dimensions"
                    value={formData.dimensions}
                    onChange={(e) => setFormData({ ...formData, dimensions: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="facing">Facing</Label>
                  <Input
                    id="facing"
                    value={formData.facing}
                    onChange={(e) => setFormData({ ...formData, facing: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="price">Price (₹)</Label>
                  <Input
                    id="price"
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                  />
                </div>
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value: PlotStatus) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger>
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
                  <Label htmlFor="ownerName">Owner Name</Label>
                  <Input
                    id="ownerName"
                    value={formData.ownerName}
                    onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                    placeholder="Enter owner name"
                  />
                </div>
                <div>
                  <Label htmlFor="saleDate">Sale Date</Label>
                  <Input
                    id="saleDate"
                    type="date"
                    value={formData.saleDate}
                    onChange={(e) => setFormData({ ...formData, saleDate: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Additional notes..."
                  rows={3}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button onClick={handleSave} className="flex-1">
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </Button>
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : showDeleteConfirm ? (
            <div className="space-y-4 text-center py-4">
              <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                <Trash2 className="w-6 h-6 text-destructive" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Delete Plot {plot.plotNumber}?</h3>
                <p className="text-sm text-muted-foreground mt-1">This action cannot be undone.</p>
              </div>
              <div className="flex gap-3 justify-center pt-2">
                <Button variant="destructive" onClick={handleDelete}>
                  Delete Plot
                </Button>
                <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Project Info Section */}
              <div className="p-3 rounded-xl bg-secondary border border-border">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Project Details</h4>
                <DetailRow icon={Building2} label="Project" value={project.name} />
                <DetailRow icon={MapPin} label="Location" value={project.location} />
                {project.description && (
                  <DetailRow icon={FileText} label="Description" value={project.description} />
                )}
                {project.contactDetails && (
                  <DetailRow icon={Phone} label="Contact" value={project.contactDetails} />
                )}
              </div>

              {/* Plot Details */}
              <div className="p-3 rounded-xl bg-muted/30 border border-border">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Plot Information</h4>
                <DetailRow icon={MapPin} label="Plot No." value={plot.plotNumber} />
                <DetailRow icon={Ruler} label="Area" value={`${plot.area} sq.yd`} />
                <DetailRow icon={Ruler} label="Dimensions" value={plot.dimensions || 'N/A'} />
                <DetailRow icon={Compass} label="Facing" value={plot.facing || 'N/A'} />
                <DetailRow icon={IndianRupee} label="Price" value={formatCurrency(plot.price)} />
              </div>
              
              {/* Owner & Sale Info (if applicable) */}
              {(plot.ownerName || plot.saleDate) && (
                <div className="p-3 rounded-xl bg-muted/30 border border-border">
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Ownership Details</h4>
                  {plot.ownerName && (
                    <DetailRow icon={User} label="Owner" value={plot.ownerName} />
                  )}
                  {plot.saleDate && (
                    <DetailRow icon={Calendar} label="Sale Date" value={formatDate(plot.saleDate)} />
                  )}
                </div>
              )}
              
              {/* Notes */}
              {plot.notes && (
                <div className="p-3 rounded-xl bg-muted/30 border border-border">
                  <div className="flex items-start gap-3">
                    <FileText className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div>
                      <span className="text-muted-foreground text-sm block mb-1">Notes</span>
                      <p className="text-foreground text-sm">{plot.notes}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Admin Actions */}
              {isAdmin && (
                <div className="pt-4 border-t border-border space-y-2">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setIsEditing(true)}
                  >
                    <Edit2 className="w-4 h-4 mr-2" />
                    Edit Plot Details
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Plot
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
