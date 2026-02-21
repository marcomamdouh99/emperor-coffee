'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trash2, Plus, Edit, MapPin, DollarSign, Package } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useI18n } from '@/lib/i18n-context';
import CourierManagement from '@/components/courier-management';

interface DeliveryArea {
  id: string;
  name: string;
  fee: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function DeliveryManagement() {
  const { currency, t } = useI18n();
  const [activeTab, setActiveTab] = useState('areas');
  const [areas, setAreas] = useState<DeliveryArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DeliveryArea | null>(null);
  const [formData, setFormData] = useState({ name: '', fee: '' });

  useEffect(() => {
    fetchAreas();
  }, []);

  const fetchAreas = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/delivery-areas');
      const data = await response.json();
      if (response.ok && data.areas) {
        setAreas(data.areas);
      }
    } catch (error) {
      console.error('Failed to fetch delivery areas:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingItem) {
        // Update existing area
        const response = await fetch(`/api/delivery-areas/${editingItem.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.name,
            fee: parseFloat(formData.fee),
          }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
          alert('Delivery area updated successfully!');
          setDialogOpen(false);
          resetForm();
          await fetchAreas();
        } else {
          alert(data.error || 'Failed to update delivery area');
        }
      } else {
        // Create new area
        const response = await fetch('/api/delivery-areas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.name,
            fee: parseFloat(formData.fee),
          }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
          alert('Delivery area created successfully!');
          setDialogOpen(false);
          resetForm();
          await fetchAreas();
        } else {
          alert(data.error || 'Failed to create delivery area');
        }
      }
    } catch (error) {
      console.error('Failed to save delivery area:', error);
      alert('Failed to save delivery area. Please try again.');
    }
  };

  const handleEdit = (area: DeliveryArea) => {
    setEditingItem(area);
    setFormData({ name: area.name, fee: area.fee.toString() });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this delivery area?')) {
      return;
    }

    try {
      const response = await fetch(`/api/delivery-areas/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (response.ok && data.success) {
        alert('Delivery area deleted successfully!');
        await fetchAreas();
      } else {
        alert(data.error || 'Failed to delete delivery area');
      }
    } catch (error) {
      console.error('Failed to delete delivery area:', error);
      alert('Failed to delete delivery area. Please try again.');
    }
  };

  const resetForm = () => {
    setEditingItem(null);
    setFormData({ name: '', fee: '' });
  };

  const handleOpenDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-white dark:bg-slate-800 w-full md:w-auto">
          <TabsTrigger value="areas" className="data-[state=active]:bg-gradient-to-r from-emerald-600 to-emerald-700">
            <MapPin className="h-4 w-4 mr-2" />
            Delivery Areas
          </TabsTrigger>
          <TabsTrigger value="couriers" className="data-[state=active]:bg-gradient-to-r from-emerald-600 to-emerald-700">
            <Package className="h-4 w-4 mr-2" />
            Couriers
          </TabsTrigger>
        </TabsList>

        {/* Delivery Areas Tab */}
        <TabsContent value="areas" className="mt-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              {t('pos.delivery.area')} Management
            </CardTitle>
            <Button onClick={handleOpenDialog} className="gap-2">
              <Plus className="h-4 w-4" />
              {t('add')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
              <span className="ml-3">Loading...</span>
            </div>
          ) : areas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <MapPin className="h-12 w-12 mb-2" />
              <p className="text-lg">No delivery areas configured</p>
              <p className="text-sm">Click "Add" to create your first delivery area</p>
            </div>
          ) : (
            <div className="space-y-3">
              {areas.map((area) => (
                <div
                  key={area.id}
                  className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                    area.isActive
                      ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                      : 'bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-700 opacity-60'
                  }`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-lg">{area.name}</h3>
                      {!area.isActive && (
                        <span className="text-xs bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 px-2 py-1 rounded-full">
                          Inactive
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-slate-600 dark:text-slate-400 text-sm">
                      <DollarSign className="h-4 w-4" />
                      <span className="font-medium">{formatCurrency(area.fee, currency)}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(area)}
                      className="h-8 w-8 p-0"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(area.id)}
                      className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="w-[95vw] max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? 'Edit Delivery Area' : 'Add Delivery Area'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="name">Area Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Downtown, Airport, etc."
                  required
                />
              </div>
              <div>
                <Label htmlFor="fee">Delivery Fee ({currency}) *</Label>
                <Input
                  id="fee"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.fee}
                  onChange={(e) => setFormData({ ...formData, fee: e.target.value })}
                  placeholder="0.00"
                  required
                />
              </div>
            </div>
            <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="w-full sm:w-auto h-11 min-h-[44px]">
                {t('cancel')}
              </Button>
              <Button type="submit" className="w-full sm:w-auto h-11 min-h-[44px]">
                {editingItem ? t('save') : t('add')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
        </TabsContent>

        {/* Couriers Tab */}
        <TabsContent value="couriers" className="mt-6">
          <CourierManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
}
