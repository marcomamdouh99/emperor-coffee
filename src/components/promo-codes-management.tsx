'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
  Plus, Edit, Trash2, Download, RefreshCw, CheckCircle, XCircle,
  Calendar, MapPin, Percent, DollarSign, Tag, BarChart3, Gift,
  Package, Users, TrendingUp, AlertCircle, Copy, Check, Ticket
} from 'lucide-react';

interface Promotion {
  id: string;
  name: string;
  description: string | null;
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'CATEGORY_PERCENTAGE' | 'CATEGORY_FIXED';
  discountValue: number;
  categoryId: string | null;
  maxUses: number | null;
  usesPerCustomer: number | null;
  startDate: string;
  endDate: string;
  isActive: boolean;
  allowStacking: boolean;
  minOrderAmount: number | null;
  maxDiscountAmount: number | null;
  codes: PromoCode[];
  branchRestrictions: any[];
  categoryRestrictions: any[];
  _count?: { usageLogs: number };
}

interface PromoCode {
  id: string;
  code: string;
  isActive: boolean;
  usageCount: number;
  maxUses: number | null;
  isSingleUse: boolean;
  campaignName: string | null;
  createdAt: string;
}

interface Category {
  id: string;
  name: string;
}

interface Branch {
  id: string;
  branchName: string;
}

export default function PromoCodesManagement() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);
  const [activeTab, setActiveTab] = useState('promotions');
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    discountType: 'PERCENTAGE' as const,
    discountValue: 10,
    categoryId: '',
    maxUses: null as number | null,
    usesPerCustomer: null as number | null,
    startDate: '',
    endDate: '',
    isActive: true,
    allowStacking: false,
    minOrderAmount: null as number | null,
    maxDiscountAmount: null as number | null,
    branchIds: [] as string[],
    categoryIds: [] as string[],
    codes: [] as { code: string; isSingleUse: boolean; maxUses: number | null }[],
  });

  // Voucher generation state
  const [voucherForm, setVoucherForm] = useState({
    promotionId: '',
    count: 100,
    prefix: '',
    codeLength: 12,
    campaignName: '',
  });
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([]);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch promotions with codes and usage
      const promosRes = await fetch('/api/promotions?includeCodes=true&includeUsage=true');
      const promosData = await promosRes.json();
      if (promosData.success) {
        setPromotions(promosData.promotions);
      }

      // Fetch categories
      const catsRes = await fetch('/api/categories');
      const catsData = await catsRes.json();
      if (catsData.categories) {
        setCategories(catsData.categories);
      }

      // Fetch branches
      const branchRes = await fetch('/api/branches');
      const branchData = await branchRes.json();
      if (branchData.branches) {
        setBranches(branchData.branches);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      showToast('error', 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const showToast = (type: 'success' | 'error', message: string) => {
    setToastMessage({ type, message });
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSavePromotion = async () => {
    try {
      const url = editingPromotion
        ? `/api/promotions/${editingPromotion.id}`
        : '/api/promotions';
      const method = editingPromotion ? 'PUT' : 'POST';

      // Convert dates to ISO datetime format
      const submissionData = {
        ...formData,
        startDate: formData.startDate ? new Date(formData.startDate).toISOString() : '',
        endDate: formData.endDate ? new Date(formData.endDate).toISOString() : '',
      };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submissionData),
      });

      const data = await response.json();

      if (data.success) {
        showToast('success', editingPromotion ? 'Promotion updated successfully' : 'Promotion created successfully');
        setDialogOpen(false);
        resetForm();
        fetchData();
      } else {
        showToast('error', data.error || 'Failed to save promotion');
      }
    } catch (error) {
      console.error('Error saving promotion:', error);
      showToast('error', 'Failed to save promotion');
    }
  };

  const handleDeletePromotion = async (id: string) => {
    if (!confirm('Are you sure you want to delete this promotion?')) return;

    try {
      const response = await fetch(`/api/promotions/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        showToast('success', 'Promotion deleted successfully');
        fetchData();
      } else {
        showToast('error', data.error || 'Failed to delete promotion');
      }
    } catch (error) {
      console.error('Error deleting promotion:', error);
      showToast('error', 'Failed to delete promotion');
    }
  };

  const handleGenerateVouchers = async () => {
    try {
      const response = await fetch('/api/promo-codes/generate-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(voucherForm),
      });

      const data = await response.json();

      if (data.success) {
        setGeneratedCodes(data.codes);
        showToast('success', `Generated ${data.codes.length} promo codes`);
        fetchData();
      } else {
        showToast('error', data.error || 'Failed to generate vouchers');
      }
    } catch (error) {
      console.error('Error generating vouchers:', error);
      showToast('error', 'Failed to generate vouchers');
    }
  };

  const handleExportCSV = async (promotionId?: string, campaignName?: string) => {
    try {
      let url = '/api/promo-codes/export';
      const params = new URLSearchParams();
      if (promotionId) params.append('promotionId', promotionId);
      if (campaignName) params.append('campaignName', campaignName);
      if (params.toString()) url += `?${params.toString()}`;

      const response = await fetch(url);
      if (response.ok) {
        const blob = await response.blob();
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `promo-codes-${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(downloadUrl);
        showToast('success', 'CSV exported successfully');
      } else {
        showToast('error', 'Failed to export CSV');
      }
    } catch (error) {
      console.error('Error exporting CSV:', error);
      showToast('error', 'Failed to export CSV');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      categoryId: '',
      maxUses: null,
      usesPerCustomer: null,
      startDate: '',
      endDate: '',
      isActive: true,
      allowStacking: false,
      minOrderAmount: null,
      maxDiscountAmount: null,
      branchIds: [],
      categoryIds: [],
      codes: [],
    });
    setEditingPromotion(null);
  };

  const openEditDialog = (promotion: Promotion) => {
    setEditingPromotion(promotion);
    setFormData({
      name: promotion.name,
      description: promotion.description || '',
      discountType: promotion.discountType,
      discountValue: promotion.discountValue,
      categoryId: promotion.categoryId || '',
      maxUses: promotion.maxUses,
      usesPerCustomer: promotion.usesPerCustomer,
      startDate: new Date(promotion.startDate).toISOString().split('T')[0],
      endDate: new Date(promotion.endDate).toISOString().split('T')[0],
      isActive: promotion.isActive,
      allowStacking: promotion.allowStacking,
      minOrderAmount: promotion.minOrderAmount,
      maxDiscountAmount: promotion.maxDiscountAmount,
      branchIds: promotion.branchRestrictions.map((b) => b.branchId),
      categoryIds: promotion.categoryRestrictions.map((c) => c.categoryId),
      codes: promotion.codes.map((c) => ({
        code: c.code,
        isSingleUse: c.isSingleUse,
        maxUses: c.maxUses,
      })),
    });
    setDialogOpen(true);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast('success', 'Copied to clipboard');
  };

  const getDiscountTypeIcon = (type: string) => {
    switch (type) {
      case 'PERCENTAGE':
        return <Percent className="h-4 w-4" />;
      case 'FIXED_AMOUNT':
        return <DollarSign className="h-4 w-4" />;
      case 'CATEGORY_PERCENTAGE':
        return <Package className="h-4 w-4" />;
      case 'CATEGORY_FIXED':
        return <Tag className="h-4 w-4" />;
      default:
        return <Gift className="h-4 w-4" />;
    }
  };

  const getDiscountTypeLabel = (type: string) => {
    switch (type) {
      case 'PERCENTAGE':
        return 'Percentage Discount';
      case 'FIXED_AMOUNT':
        return 'Fixed Amount';
      case 'CATEGORY_PERCENTAGE':
        return 'Category Percentage';
      case 'CATEGORY_FIXED':
        return 'Category Fixed';
      default:
        return type;
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 ${
          toastMessage.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toastMessage.message}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Promo Codes</h2>
          <p className="text-slate-600 dark:text-slate-400">Manage promotions, vouchers, and track usage</p>
        </div>
        <Button onClick={() => { resetForm(); setDialogOpen(true); }} className="gap-2">
          <Plus className="h-4 w-4" />
          New Promotion
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="promotions" className="gap-2">
            <Gift className="h-4 w-4" />
            Promotions
          </TabsTrigger>
          <TabsTrigger value="vouchers" className="gap-2">
            <Ticket className="h-4 w-4" />
            Vouchers
          </TabsTrigger>
          <TabsTrigger value="reports" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Reports
          </TabsTrigger>
          <TabsTrigger value="codes" className="gap-2">
            <Tag className="h-4 w-4" />
            All Codes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="promotions" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {promotions.map((promo) => (
              <Card key={promo.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {getDiscountTypeIcon(promo.discountType)}
                      <CardTitle className="text-lg">{promo.name}</CardTitle>
                    </div>
                    <Badge variant={promo.isActive ? 'default' : 'secondary'}>
                      {promo.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <CardDescription className="line-clamp-2">
                    {promo.description || 'No description'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-400">Discount</span>
                    <span className="font-semibold">
                      {promo.discountType.includes('PERCENTAGE') ? `${promo.discountValue}%` : `${promo.discountValue} EGP`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-400">Type</span>
                    <span className="text-sm font-medium">{getDiscountTypeLabel(promo.discountType)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-400">Usage</span>
                    <span className="text-sm font-medium">
                      {promo._count?.usageLogs || 0} / {promo.maxUses || '∞'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-400">Codes</span>
                    <span className="text-sm font-medium">{promo.codes.length}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Calendar className="h-3 w-3" />
                    {new Date(promo.startDate).toLocaleDateString()} - {new Date(promo.endDate).toLocaleDateString()}
                  </div>
                  <Separator />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => openEditDialog(promo)}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeletePromotion(promo.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="vouchers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Generate Voucher Batch</CardTitle>
              <CardDescription>Create multiple unique promo codes for scratch card campaigns</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Select Promotion</Label>
                  <Select
                    value={voucherForm.promotionId}
                    onValueChange={(value) => setVoucherForm({ ...voucherForm, promotionId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose promotion" />
                    </SelectTrigger>
                    <SelectContent>
                      {promotions.map((promo) => (
                        <SelectItem key={promo.id} value={promo.id}>
                          {promo.name} - {getDiscountTypeLabel(promo.discountType)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Number of Codes</Label>
                  <Input
                    type="number"
                    min="1"
                    max="1000"
                    value={voucherForm.count}
                    onChange={(e) => setVoucherForm({ ...voucherForm, count: parseInt(e.target.value) || 1 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Code Prefix (Optional)</Label>
                  <Input
                    placeholder="e.g., RAMADAN"
                    value={voucherForm.prefix}
                    onChange={(e) => setVoucherForm({ ...voucherForm, prefix: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Campaign Name (Optional)</Label>
                  <Input
                    placeholder="e.g., Ramadan Campaign 2025"
                    value={voucherForm.campaignName}
                    onChange={(e) => setVoucherForm({ ...voucherForm, campaignName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Code Length</Label>
                  <Select
                    value={voucherForm.codeLength.toString()}
                    onValueChange={(value) => setVoucherForm({ ...voucherForm, codeLength: parseInt(value) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="8">8 characters</SelectItem>
                      <SelectItem value="10">10 characters</SelectItem>
                      <SelectItem value="12">12 characters</SelectItem>
                      <SelectItem value="14">14 characters</SelectItem>
                      <SelectItem value="16">16 characters</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={handleGenerateVouchers} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Generate {voucherForm.count} Codes
              </Button>
            </CardContent>
          </Card>

          {generatedCodes.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Generated Codes</CardTitle>
                    <CardDescription>{generatedCodes.length} codes generated</CardDescription>
                  </div>
                  <Button onClick={() => handleExportCSV(voucherForm.promotionId, voucherForm.campaignName)}>
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  <div className="grid gap-2">
                    {generatedCodes.map((code, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800 rounded">
                        <code className="font-mono">{code}</code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(code)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Promo Usage Reports</CardTitle>
              <CardDescription>Track performance and analytics of your promotions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-slate-500">
                <BarChart3 className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p>Reports functionality coming soon</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="codes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>All Promo Codes</CardTitle>
              <CardDescription>View and manage all generated promo codes</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-2">
                  {promotions.flatMap((promo) =>
                    promo.codes.map((code) => (
                      <div key={code.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          {code.isActive ? (
                            <CheckCircle className="h-5 w-5 text-emerald-600" />
                          ) : (
                            <XCircle className="h-5 w-5 text-slate-400" />
                          )}
                          <div>
                            <code className="font-semibold">{code.code}</code>
                            <div className="text-xs text-slate-500">
                              {code.campaignName && <span className="mr-2">{code.campaignName}</span>}
                              Used: {code.usageCount}{code.maxUses && ` / ${code.maxUses}`}
                            </div>
                          </div>
                        </div>
                        <Badge variant={code.isActive ? 'default' : 'secondary'}>
                          {code.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPromotion ? 'Edit Promotion' : 'Create New Promotion'}</DialogTitle>
            <DialogDescription>
              Configure your promotion settings and generate codes
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Promotion Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Summer Sale 2025"
                />
              </div>
              <div className="space-y-2">
                <Label>Discount Type *</Label>
                <Select
                  value={formData.discountType}
                  onValueChange={(value: any) => setFormData({ ...formData, discountType: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERCENTAGE">Percentage Discount</SelectItem>
                    <SelectItem value="FIXED_AMOUNT">Fixed Amount</SelectItem>
                    <SelectItem value="CATEGORY_PERCENTAGE">Category Percentage</SelectItem>
                    <SelectItem value="CATEGORY_FIXED">Category Fixed Amount</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe your promotion..."
                rows={2}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Discount Value *</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.discountValue}
                  onChange={(e) => setFormData({ ...formData, discountValue: parseFloat(e.target.value) || 0 })}
                  placeholder={formData.discountType.includes('PERCENTAGE') ? 'e.g., 10' : 'e.g., 50'}
                />
              </div>
              <div className="space-y-2">
                <Label>Start Date *</Label>
                <Input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>End Date *</Label>
                <Input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                />
              </div>
              {(formData.discountType.includes('CATEGORY') || formData.categoryIds.length > 0) && (
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select
                    value={formData.categoryId}
                    onValueChange={(value) => setFormData({ ...formData, categoryId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Max Uses (Optional)</Label>
                <Input
                  type="number"
                  min="1"
                  placeholder="Unlimited"
                  value={formData.maxUses || ''}
                  onChange={(e) => setFormData({ ...formData, maxUses: e.target.value ? parseInt(e.target.value) : null })}
                />
              </div>
              <div className="space-y-2">
                <Label>Uses Per Customer (Optional)</Label>
                <Input
                  type="number"
                  min="1"
                  placeholder="Unlimited"
                  value={formData.usesPerCustomer || ''}
                  onChange={(e) => setFormData({ ...formData, usesPerCustomer: e.target.value ? parseInt(e.target.value) : null })}
                />
              </div>
              <div className="space-y-2">
                <Label>Min Order Amount (Optional)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="No minimum"
                  value={formData.minOrderAmount || ''}
                  onChange={(e) => setFormData({ ...formData, minOrderAmount: e.target.value ? parseFloat(e.target.value) : null })}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Max Discount Amount (Optional)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="No cap"
                  value={formData.maxDiscountAmount || ''}
                  onChange={(e) => setFormData({ ...formData, maxDiscountAmount: e.target.value ? parseFloat(e.target.value) : null })}
                />
              </div>
              <div className="space-y-2">
                <Label>Branches (Leave empty for all)</Label>
                <div className="max-h-32 overflow-y-auto border rounded p-2 space-y-1">
                  {branches.map((branch) => (
                    <label key={branch.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={formData.branchIds.includes(branch.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({ ...formData, branchIds: [...formData.branchIds, branch.id] });
                          } else {
                            setFormData({ ...formData, branchIds: formData.branchIds.filter((id) => id !== branch.id) });
                          }
                        }}
                      />
                      {branch.branchName}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
                <Label>Active</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.allowStacking}
                  onCheckedChange={(checked) => setFormData({ ...formData, allowStacking: checked })}
                />
                <Label>Allow Stacking</Label>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Promo Codes</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setFormData({
                      ...formData,
                      codes: [...formData.codes, { code: '', isSingleUse: false, maxUses: null }],
                    });
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Code
                </Button>
              </div>
              <div className="space-y-2">
                {formData.codes.map((code, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <Input
                      placeholder="Enter code"
                      value={code.code}
                      onChange={(e) => {
                        const newCodes = [...formData.codes];
                        newCodes[index].code = e.target.value;
                        setFormData({ ...formData, codes: newCodes });
                      }}
                    />
                    <Input
                      type="number"
                      placeholder="Max uses"
                      className="w-24"
                      value={code.maxUses || ''}
                      onChange={(e) => {
                        const newCodes = [...formData.codes];
                        newCodes[index].maxUses = e.target.value ? parseInt(e.target.value) : null;
                        setFormData({ ...formData, codes: newCodes });
                      }}
                    />
                    <label className="flex items-center gap-1 text-sm">
                      <input
                        type="checkbox"
                        checked={code.isSingleUse}
                        onChange={(e) => {
                          const newCodes = [...formData.codes];
                          newCodes[index].isSingleUse = e.target.checked;
                          setFormData({ ...formData, codes: newCodes });
                        }}
                      />
                      Single
                    </label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setFormData({
                          ...formData,
                          codes: formData.codes.filter((_, i) => i !== index),
                        });
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSavePromotion}>
              {editingPromotion ? 'Update' : 'Create'} Promotion
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
