'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, Clock, XCircle, Package, RefreshCw, Bell, CheckCircle } from 'lucide-react';

interface Alert {
  id: string;
  type: 'LOW_STOCK' | 'EXPIRY_WARNING' | 'EXPIRED';
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  title: string;
  message: string;
  entityId: string;
  entityType: string;
  data: {
    ingredientId: string;
    ingredientName: string;
    currentStock: number;
    threshold?: number;
    expiryDate?: Date;
    unit: string;
  };
}

interface AlertsSummary {
  lowStock: number;
  expiringSoon: number;
  expired: number;
  total: number;
}

export default function InventoryAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [summary, setSummary] = useState<AlertsSummary>({ lowStock: 0, expiringSoon: 0, expired: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [branchId, setBranchId] = useState<string | null>(null);

  useEffect(() => {
    // Get branch ID from user session (stored in localStorage)
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      setBranchId(user.branchId || null);
      // If user is ADMIN and has no branch, get the first branch
      if (!user.branchId && user.role === 'ADMIN') {
        fetch('/api/branches')
          .then(res => res.json())
          .then(data => {
            if (data.branches && data.branches.length > 0) {
              setBranchId(data.branches[0].id);
            } else {
              setLoading(false); // No branches available
            }
          })
          .catch(err => {
            console.error('Failed to fetch branches:', err);
            setLoading(false);
          });
      } else {
        setLoading(false); // User has no branch and is not admin
      }
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (branchId) {
      fetchAlerts();
    }
  }, [branchId]);

  const fetchAlerts = async () => {
    if (!branchId) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/inventory/alerts?branchId=${branchId}`);
      if (response.ok) {
        const data = await response.json();
        setAlerts(data.alerts);
        setSummary(data.summary);
      }
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'LOW_STOCK':
        return <Package className="h-5 w-5" />;
      case 'EXPIRY_WARNING':
        return <Clock className="h-5 w-5" />;
      case 'EXPIRED':
        return <XCircle className="h-5 w-5" />;
      default:
        return <AlertTriangle className="h-5 w-5" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'HIGH':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'NORMAL':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'LOW':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'LOW_STOCK':
        return 'bg-blue-500';
      case 'EXPIRY_WARNING':
        return 'bg-yellow-500';
      case 'EXPIRED':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white/80 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Alerts</p>
                <p className="text-2xl font-bold text-slate-900">{summary.total}</p>
              </div>
              <div className="p-3 bg-slate-100 rounded-full">
                <Bell className="h-6 w-6 text-slate-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Low Stock</p>
                <p className="text-2xl font-bold text-blue-600">{summary.lowStock}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <Package className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Expiring Soon</p>
                <p className="text-2xl font-bold text-yellow-600">{summary.expiringSoon}</p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-full">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Expired</p>
                <p className="text-2xl font-bold text-red-600">{summary.expired}</p>
              </div>
              <div className="p-3 bg-red-100 rounded-full">
                <XCircle className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts List */}
      <Card className="bg-white/80 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-emerald-600" />
                Inventory Alerts
              </CardTitle>
              <CardDescription>Real-time alerts for low stock and expiring items</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchAlerts}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full"></div>
            </div>
          ) : alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <CheckCircle className="h-12 w-12 text-emerald-500 mb-4" />
              <p className="text-lg font-medium">All Clear!</p>
              <p className="text-sm">No inventory alerts at this time</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-3">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`flex items-start gap-4 p-4 rounded-lg border ${getPriorityColor(alert.priority)}`}
                  >
                    <div className={`p-2 rounded-full ${getTypeColor(alert.type)} text-white`}>
                      {getAlertIcon(alert.type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold">{alert.title}</h4>
                        <Badge variant="outline" className="text-xs">
                          {alert.priority}
                        </Badge>
                      </div>
                      <p className="text-sm mb-2">{alert.message}</p>
                      <div className="flex items-center gap-4 text-xs text-slate-600">
                        <span>
                          Current: {alert.data.currentStock.toFixed(2)} {alert.data.unit}
                        </span>
                        {alert.data.threshold && (
                          <span>
                            Threshold: {alert.data.threshold.toFixed(2)} {alert.data.unit}
                          </span>
                        )}
                        {alert.data.expiryDate && (
                          <span>
                            Expires: {new Date(alert.data.expiryDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
