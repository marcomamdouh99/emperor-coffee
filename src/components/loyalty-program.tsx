'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Star, Plus, RefreshCw, Search, Gift, Trophy, TrendingUp, Users } from 'lucide-react';

interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  loyaltyPoints: number;
  tier: string;
  totalSpent: number;
  orderCount: number;
}

interface LoyaltyTransaction {
  id: string;
  points: number;
  type: 'EARNED' | 'REDEEMED' | 'ADJUSTMENT' | 'BONUS';
  orderId?: string;
  amount?: number;
  notes?: string;
  createdAt: string;
}

const TIER_COLORS: Record<string, string> = {
  BRONZE: 'bg-amber-100 text-amber-700 border-amber-200',
  SILVER: 'bg-slate-100 text-slate-700 border-slate-300',
  GOLD: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  PLATINUM: 'bg-purple-100 text-purple-700 border-purple-300',
};

const TYPE_COLORS: Record<string, string> = {
  EARNED: 'bg-emerald-100 text-emerald-700',
  REDEEMED: 'bg-red-100 text-red-700',
  ADJUSTMENT: 'bg-blue-100 text-blue-700',
  BONUS: 'bg-purple-100 text-purple-700',
};

export default function LoyaltyProgram() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [loyaltyInfo, setLoyaltyInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAdjustDialogOpen, setIsAdjustDialogOpen] = useState(false);
  const [points, setPoints] = useState(0);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetchCustomers();
  }, [search]);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('phone', search);

      const response = await fetch(`/api/customers?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setCustomers(data.customers);
      }
    } catch (error) {
      console.error('Failed to fetch customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLoyaltyInfo = async (customerId: string) => {
    try {
      const response = await fetch(`/api/loyalty?customerId=${customerId}`);
      if (response.ok) {
        const data = await response.json();
        setLoyaltyInfo(data);
      }
    } catch (error) {
      console.error('Failed to fetch loyalty info:', error);
    }
  };

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    fetchLoyaltyInfo(customer.id);
    setIsDialogOpen(true);
  };

  const adjustPoints = async () => {
    if (!selectedCustomer) return;

    try {
      const response = await fetch('/api/loyalty', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'adjust',
          customerId: selectedCustomer.id,
          points,
          notes,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // Update selected customer with new data
        if (data.customer) {
          setSelectedCustomer(data.customer);
        } else if (selectedCustomer && data.totalPoints !== undefined) {
          // Fallback: update just the points if customer not in response
          setSelectedCustomer({
            ...selectedCustomer,
            loyaltyPoints: data.totalPoints,
            tier: data.tier || selectedCustomer.tier,
          });
        }
        fetchLoyaltyInfo(selectedCustomer.id);
        fetchCustomers(); // Refresh the customers list
        setIsAdjustDialogOpen(false);
        setPoints(0);
        setNotes('');
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to adjust points');
      }
    } catch (error) {
      console.error('Failed to adjust points:', error);
      alert('Failed to adjust points');
    }
  };

  // Calculate stats
  const totalPoints = customers.reduce((sum, c) => sum + (c.loyaltyPoints || 0), 0);
  const tierCounts = customers.reduce((acc, c) => {
    acc[c.tier || 'BRONZE'] = (acc[c.tier || 'BRONZE'] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-white/80 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Customers</p>
                <p className="text-2xl font-bold text-slate-900">{customers.length}</p>
              </div>
              <div className="p-3 bg-emerald-100 rounded-full">
                <Users className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Points Issued</p>
                <p className="text-2xl font-bold text-emerald-600">{totalPoints.toFixed(2)}</p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-full">
                <Star className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Gold/Platinum</p>
                <p className="text-2xl font-bold text-purple-600">
                  {(tierCounts['GOLD'] || 0) + (tierCounts['PLATINUM'] || 0)}
                </p>
              </div>
              <div className="p-3 bg-purple-100 rounded-full">
                <Trophy className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Spent</p>
                <p className="text-2xl font-bold text-slate-900">
                  ${customers.reduce((sum, c) => sum + (c.totalSpent || 0), 0).toFixed(2)}
                </p>
              </div>
              <div className="p-3 bg-emerald-100 rounded-full">
                <TrendingUp className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Customers List */}
      <Card className="bg-white/80 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Gift className="h-5 w-5 text-emerald-600" />
                Customer Loyalty Program
              </CardTitle>
              <CardDescription>Manage customer loyalty points and tiers</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search by phone..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 w-[200px]"
                />
              </div>
              <Button variant="outline" size="sm" onClick={fetchCustomers}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full"></div>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
              <div className="min-w-[800px] md:min-w-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Points</TableHead>
                    <TableHead>Total Spent</TableHead>
                    <TableHead>Orders</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell className="font-medium">{customer.name}</TableCell>
                      <TableCell>{customer.phone}</TableCell>
                      <TableCell>
                        <Badge className={TIER_COLORS[customer.tier || 'BRONZE'] || 'bg-slate-100 text-slate-700 border-slate-300'}>
                          {customer.tier || 'BRONZE'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1">
                          <Star className="h-3 w-3 text-yellow-500" />
                          {(customer.loyaltyPoints || 0).toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell>${(customer.totalSpent || 0).toFixed(2)}</TableCell>
                      <TableCell>{customer.orderCount || 0}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => handleSelectCustomer(customer)}>
                          View Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Customer Detail Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Customer Loyalty Details</DialogTitle>
          </DialogHeader>
          {selectedCustomer && loyaltyInfo && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">{selectedCustomer.name}</h3>
                  <p className="text-sm text-slate-500">{selectedCustomer.phone}</p>
                </div>
                <Badge className={TIER_COLORS[selectedCustomer.tier || 'BRONZE'] || 'bg-slate-100 text-slate-700 border-slate-300'}>
                  <Trophy className="h-3 w-3 mr-1" />
                  {selectedCustomer.tier || 'BRONZE'}
                </Badge>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="p-3 bg-slate-50 rounded-lg text-center">
                  <p className="text-sm text-slate-600">Current Points</p>
                  <p className="text-xl font-bold text-emerald-600">{(selectedCustomer.loyaltyPoints || 0).toFixed(2)}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg text-center">
                  <p className="text-sm text-slate-600">Points Value</p>
                  <p className="text-xl font-bold text-slate-900">${(loyaltyInfo?.pointsValue || 0).toFixed(2)}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg text-center">
                  <p className="text-sm text-slate-600">Total Spent</p>
                  <p className="text-xl font-bold text-slate-900">${(selectedCustomer.totalSpent || 0).toFixed(2)}</p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <h4 className="font-semibold">Recent Transactions</h4>
                <Button size="sm" onClick={() => setIsAdjustDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Adjust Points
                </Button>
              </div>

              <ScrollArea className="h-[200px]">
                {loyaltyInfo.transactions?.length > 0 ? (
                  <div className="space-y-2">
                    {loyaltyInfo.transactions.map((tx: LoyaltyTransaction) => (
                      <div key={tx.id} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                        <div>
                          <Badge className={TYPE_COLORS[tx.type] || 'bg-slate-100 text-slate-700'}>{tx.type}</Badge>
                          {tx.notes && <span className="ml-2 text-sm text-slate-500">{tx.notes}</span>}
                        </div>
                        <div className="text-right">
                          <p className={`font-medium ${(tx.points || 0) > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {(tx.points || 0) > 0 ? '+' : ''}{(tx.points || 0).toFixed(2)}
                          </p>
                          <p className="text-xs text-slate-400">{tx.createdAt ? new Date(tx.createdAt).toLocaleDateString() : 'N/A'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-slate-500 py-4">No transactions yet</p>
                )}
              </ScrollArea>
            </div>
          )}
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="w-full sm:w-auto h-11 min-h-[44px]">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjust Points Dialog */}
      <Dialog open={isAdjustDialogOpen} onOpenChange={setIsAdjustDialogOpen}>
        <DialogContent className="w-[95vw] max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Adjust Customer Points</DialogTitle>
            <DialogDescription>
              Add or remove points from {selectedCustomer?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Points to Add/Remove</Label>
              <Input
                type="number"
                step="0.1"
                value={points}
                onChange={(e) => setPoints(parseFloat(e.target.value) || 0)}
                placeholder="Positive to add, negative to remove"
              />
            </div>
            <div className="grid gap-2">
              <Label>Reason</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Reason for adjustment..."
              />
            </div>
          </div>
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setIsAdjustDialogOpen(false)} className="w-full sm:w-auto h-11 min-h-[44px]">Cancel</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 w-full sm:w-auto h-11 min-h-[44px]" onClick={adjustPoints}>
              Confirm Adjustment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
