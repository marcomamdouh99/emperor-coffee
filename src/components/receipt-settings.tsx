'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Save, RefreshCw, Printer, Image, Type, FileText, Settings, Upload, X } from 'lucide-react';
import { showSuccessToast, showErrorToast } from '@/hooks/use-toast';

interface ReceiptSettings {
  storeName: string;
  branchName: string;
  headerText?: string;
  footerText?: string;
  thankYouMessage: string;
  fontSize: 'small' | 'medium' | 'large';
  showLogo: boolean;
  logoData?: string; // Base64 encoded logo image
  showCashier: boolean;
  showDateTime: boolean;
  showOrderType: boolean;
  showCustomerInfo: boolean;
  openCashDrawer: boolean;
  cutPaper: boolean;
  cutType: 'full' | 'partial';
  paperWidth: number; // in mm (58 or 80 typical)
}

const defaultSettings: ReceiptSettings = {
  storeName: 'Emperor Coffee',
  branchName: 'Coffee Shop',
  headerText: 'Quality Coffee Since 2024',
  footerText: 'Visit us again soon!',
  thankYouMessage: 'Thank you for your purchase!',
  fontSize: 'medium',
  showLogo: true,
  showCashier: true,
  showDateTime: true,
  showOrderType: true,
  showCustomerInfo: true,
  openCashDrawer: true,
  cutPaper: true,
  cutType: 'full',
  paperWidth: 80,
};

export default function ReceiptSettings() {
  const [settings, setSettings] = useState<ReceiptSettings>(defaultSettings);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Fetch settings from database (centralized storage for all devices)
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      // Try to fetch from API first
      const response = await fetch('/api/receipt-settings');
      const data = await response.json();
      if (response.ok && data.settings) {
        // Use centralized settings from database
        setSettings(data.settings);
        if (data.settings.logoData) {
          setLogoPreview(data.settings.logoData);
        }
        console.log('Receipt settings loaded from database:', {
          storeName: data.settings.storeName,
          hasLogo: !!data.settings.logoData,
        });
        return; // Successfully loaded from database, no need for fallback
      }
      throw new Error('API returned no settings');
    } catch (error) {
      console.error('Failed to fetch from API, trying IndexedDB cache:', error);

      // Fallback to IndexedDB (offline cache)
      try {
        if (typeof window !== 'undefined' && window.indexedDB) {
          const request = indexedDB.open('EmperorCoffeePOS', 4);
          request.onsuccess = async (event) => {
            try {
              const db = (event.target as IDBOpenDBRequest).result;
              const transaction = db.transaction('receipt_settings', 'readonly');
              const store = transaction.objectStore('receipt_settings');
              const getRequest = store.get('default');

              getRequest.onsuccess = () => {
                const settings = getRequest.result;
                if (settings) {
                  setSettings(settings);
                  if (settings.logoData) {
                    setLogoPreview(settings.logoData);
                  }
                  console.log('Receipt settings loaded from IndexedDB cache:', {
                    storeName: settings.storeName,
                    hasLogo: !!settings.logoData,
                  });
                  showWarningToast(
                    'Offline Mode',
                    'Using cached receipt settings'
                  );
                } else {
                  showErrorToast('Error', 'No receipt settings found');
                }
              };
              getRequest.onerror = () => {
                showErrorToast('Error', 'Failed to load cached settings');
              };
            } catch (err) {
              console.error('[Receipt Settings] Failed to load from IndexedDB:', err);
              showErrorToast('Error', 'Failed to load receipt settings');
            }
          };
          request.onerror = () => {
            showErrorToast('Error', 'Failed to open IndexedDB');
          };
        } else {
          showErrorToast('Error', 'IndexedDB not supported');
        }
      } catch (err) {
        console.error('[Receipt Settings] Fallback also failed:', err);
        showErrorToast('Error', 'Failed to load receipt settings from cache');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    console.log('File selected:', {
      name: file.name,
      type: file.type,
      size: file.size,
    });

    // Validate file type
    if (!file.type.match(/image\/(jpeg|png|gif|bmp|webp)/)) {
      showErrorToast('Invalid File', 'Please upload an image file (JPEG, PNG, GIF, BMP, or WebP)');
      return;
    }

    // Validate file size (max 500KB)
    if (file.size > 500 * 1024) {
      showErrorToast('File Too Large', 'Please upload an image smaller than 500KB');
      return;
    }

    console.log('File validation passed, reading...');

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      console.log('File read successfully, data length:', result?.length);
      setLogoPreview(result);
      setSettings({ ...settings, logoData: result });
      showSuccessToast('Logo Uploaded', 'Your logo has been uploaded successfully!');
    };
    reader.onerror = (error) => {
      console.error('FileReader error:', error);
      showErrorToast('Upload Failed', 'Failed to read the image file');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setLogoPreview(null);
    setSettings({ ...settings, logoData: undefined });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/receipt-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        // Settings are saved to database - now also cache in IndexedDB for offline use
        console.log('Settings saved to database:', {
          storeName: settings.storeName,
          branchName: settings.branchName,
          hasLogo: !!settings.logoData,
        });

        // Also save to IndexedDB for offline use
        try {
          if (typeof window !== 'undefined' && window.indexedDB) {
            const request = indexedDB.open('EmperorCoffeePOS', 4);
            request.onsuccess = (event) => {
              const db = (event.target as IDBOpenDBRequest).result;
              const transaction = db.transaction('receipt_settings', 'readwrite');
              const store = transaction.objectStore('receipt_settings');
              store.put({ ...data.settings, id: 'default' });

              console.log('[Receipt Settings] Also cached to IndexedDB for offline use');
            };
          }
        } catch (err) {
          console.warn('[Receipt Settings] Failed to cache to IndexedDB (non-critical):', err);
        }

        showSuccessToast('Settings Saved', 'Receipt settings saved to database and cached locally');
      } else {
        throw new Error(data.error || 'Failed to save settings');
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      showErrorToast('Error', 'Failed to save receipt settings to database');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (confirm('Reset to default settings? This will reset to database defaults.')) {
      setSettings(defaultSettings);
      setLogoPreview(null);
      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      // Re-fetch from database to get current defaults
      fetchSettings();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <Printer className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <CardTitle>Receipt Settings</CardTitle>
                <CardDescription>
                  Customize your receipt design and printing behavior
                </CardDescription>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleReset}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Reset
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Settings
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Store Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Image className="h-5 w-5" />
              Store Information
            </CardTitle>
            <CardDescription>
              Customize how your store name and details appear
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Store Name</Label>
              <Input
                value={settings.storeName}
                onChange={(e) => setSettings({ ...settings, storeName: e.target.value })}
                placeholder="Emperor Coffee"
              />
            </div>
            <div className="space-y-2">
              <Label>Branch Name (Default)</Label>
              <Input
                value={settings.branchName}
                onChange={(e) => setSettings({ ...settings, branchName: e.target.value })}
                placeholder="Downtown Branch"
              />
              <p className="text-xs text-slate-500">
                Used as fallback - actual branch is auto-detected from order
              </p>
            </div>
            <div className="space-y-2">
              <Label>Header Text (Optional)</Label>
              <Input
                value={settings.headerText || ''}
                onChange={(e) => setSettings({ ...settings, headerText: e.target.value })}
                placeholder="Quality Coffee Since 2024"
              />
              <p className="text-xs text-slate-500">
                Appears below store name
              </p>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label>Store Logo</Label>
              <div className="space-y-3">
                {logoPreview ? (
                  <div className="relative inline-block">
                    <img
                      src={logoPreview}
                      alt="Store Logo Preview"
                      className="max-w-[200px] max-h-[100px] object-contain border rounded-lg"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="absolute -top-2 -right-2 h-6 w-6 p-0 rounded-full"
                      onClick={handleRemoveLogo}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center">
                    <Image className="h-8 w-8 mx-auto mb-2 text-slate-400" />
                    <p className="text-sm text-slate-500 mb-2">No logo uploaded</p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                      id="logo-upload-input"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        console.log('Upload button clicked, triggering file input');
                        fileInputRef.current?.click();
                      }}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Logo
                    </Button>
                  </div>
                )}
                <p className="text-xs text-slate-500">
                  Supported formats: JPEG, PNG, GIF, BMP, WebP (Max 500KB)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Messages */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Messages
            </CardTitle>
            <CardDescription>
              Customize the messages on your receipts
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Thank You Message</Label>
              <Textarea
                value={settings.thankYouMessage}
                onChange={(e) => setSettings({ ...settings, thankYouMessage: e.target.value })}
                placeholder="Thank you for your purchase!"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Footer Text (Optional)</Label>
              <Textarea
                value={settings.footerText || ''}
                onChange={(e) => setSettings({ ...settings, footerText: e.target.value })}
                placeholder="Visit us again soon!"
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* Typography */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Type className="h-5 w-5" />
              Typography & Layout
            </CardTitle>
            <CardDescription>
              Adjust font sizes and paper settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Font Size</Label>
              <Select
                value={settings.fontSize}
                onValueChange={(value: 'small' | 'medium' | 'large') =>
                  setSettings({ ...settings, fontSize: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="small">Small</SelectItem>
                  <SelectItem value="medium">Medium (Recommended)</SelectItem>
                  <SelectItem value="large">Large</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Paper Width</Label>
              <Select
                value={settings.paperWidth.toString()}
                onValueChange={(value) =>
                  setSettings({ ...settings, paperWidth: parseInt(value) })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="58">58mm (Small Printers)</SelectItem>
                  <SelectItem value="80">80mm (Standard)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Display Options */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Display Options
            </CardTitle>
            <CardDescription>
              Choose what information to show on receipts
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Show Logo</Label>
                <p className="text-xs text-slate-500">Display logo at top of receipt</p>
              </div>
              <Switch
                checked={settings.showLogo}
                onCheckedChange={(checked) => setSettings({ ...settings, showLogo: checked })}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Show Cashier Name</Label>
                <p className="text-xs text-slate-500">Display who processed the order</p>
              </div>
              <Switch
                checked={settings.showCashier}
                onCheckedChange={(checked) => setSettings({ ...settings, showCashier: checked })}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Show Date & Time</Label>
                <p className="text-xs text-slate-500">Display when order was placed</p>
              </div>
              <Switch
                checked={settings.showDateTime}
                onCheckedChange={(checked) => setSettings({ ...settings, showDateTime: checked })}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Show Order Type</Label>
                <p className="text-xs text-slate-500">Dine-in, Take-away, Delivery</p>
              </div>
              <Switch
                checked={settings.showOrderType}
                onCheckedChange={(checked) => setSettings({ ...settings, showOrderType: checked })}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Show Customer Info</Label>
                <p className="text-xs text-slate-500">Customer name and phone</p>
              </div>
              <Switch
                checked={settings.showCustomerInfo}
                onCheckedChange={(checked) => setSettings({ ...settings, showCustomerInfo: checked })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Printer Actions */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Printer Actions</CardTitle>
            <CardDescription>
              Automatic printer behaviors after printing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-0.5">
                  <Label className="text-base">Open Cash Drawer</Label>
                  <p className="text-xs text-slate-500">
                    Automatically open cash drawer after printing
                  </p>
                </div>
                <Switch
                  checked={settings.openCashDrawer}
                  onCheckedChange={(checked) => setSettings({ ...settings, openCashDrawer: checked })}
                />
              </div>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-0.5">
                  <Label className="text-base">Cut Paper</Label>
                  <p className="text-xs text-slate-500">
                    Automatically cut paper after printing
                  </p>
                </div>
                <Switch
                  checked={settings.cutPaper}
                  onCheckedChange={(checked) => setSettings({ ...settings, cutPaper: checked })}
                />
              </div>
              {settings.cutPaper && (
                <div className="flex items-center justify-between p-4 border rounded-lg md:col-span-2">
                  <div className="space-y-0.5">
                    <Label className="text-base">Cut Type</Label>
                    <p className="text-xs text-slate-500">
                      Full cut completely separates the paper, partial cut leaves a small connection
                    </p>
                  </div>
                  <Select
                    value={settings.cutType}
                    onValueChange={(value: 'full' | 'partial') =>
                      setSettings({ ...settings, cutType: value })
                    }
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full">Full Cut</SelectItem>
                      <SelectItem value="partial">Partial Cut</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Preview Card */}
      <Card>
        <CardHeader>
          <CardTitle>Live Preview</CardTitle>
          <CardDescription>
            This is how your receipt will look
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-white p-8 border-2 border-slate-200 rounded-lg max-w-sm mx-auto">
            <div className="text-center space-y-2">
              {settings.showLogo && (
                <div className="flex justify-center">
                  {logoPreview ? (
                    <img
                      src={logoPreview}
                      alt="Store Logo"
                      className="max-w-[120px] max-h-[60px] object-contain"
                    />
                  ) : (
                    <div className="text-4xl">☕</div>
                  )}
                </div>
              )}
              <div className="font-bold text-lg">{settings.storeName}</div>
              <div className="text-sm">{settings.branchName} <span className="text-xs text-slate-500">(default)</span></div>
              {settings.headerText && (
                <div className="text-xs text-slate-600">{settings.headerText}</div>
              )}
              <div className="border-t border-dashed border-slate-300 pt-2 mt-2 text-left">
                <div className="text-xs">
                  {settings.showDateTime && (
                    <div>Date: {new Date().toLocaleDateString()}</div>
                  )}
                  {settings.showCashier && (
                    <div>Cashier: John Doe</div>
                  )}
                  {settings.showOrderType && (
                    <div>Type: Dine In</div>
                  )}
                  {settings.showCustomerInfo && (
                    <div>Customer: +1 234 567 8900</div>
                  )}
                </div>
              </div>
              <div className="border-t border-dashed border-slate-300 pt-2 text-left">
                <div className="flex justify-between text-xs">
                  <span>2x Cappuccino</span>
                  <span>$9.00</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span>1x Latte</span>
                  <span>$4.60</span>
                </div>
              </div>
              <div className="border-t border-dashed border-slate-300 pt-2 text-left">
                <div className="flex justify-between font-bold text-sm">
                  <span>TOTAL:</span>
                  <span>$13.60</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span>Payment:</span>
                  <span>Cash</span>
                </div>
              </div>
              <div className="border-t border-dashed border-slate-300 pt-2 text-center space-y-1">
                <div className="text-sm">{settings.thankYouMessage}</div>
                {settings.footerText && (
                  <div className="text-xs text-slate-600">{settings.footerText}</div>
                )}
                <div className="text-xs text-slate-500">{settings.storeName} Franchise</div>
              </div>
            </div>
            {settings.cutPaper && (
              <div className="mt-4 text-center">
                <div className="h-0.5 bg-slate-300 mx-4" style={
                  settings.cutType === 'full' 
                    ? { background: 'repeating-linear-gradient(to right, transparent, transparent 3px, #94a3b8 3px, #94a3b8 6px)' }
                    : { background: 'repeating-linear-gradient(to right, #94a3b8, #94a3b8 3px, transparent 3px, transparent 6px)' }
                }></div>
                <div className="text-xs text-slate-500 mt-1">
                  {settings.cutType === 'full' ? '✂️ Full Cut' : '✂️ Partial Cut'}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
