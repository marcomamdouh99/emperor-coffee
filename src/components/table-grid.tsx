'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Plus, RefreshCw, Table as TableIcon, Check, Clock, Users, Settings, Utensils, Package, MapPin, AlertCircle } from 'lucide-react';

interface Table {
  id: string;
  tableNumber: number;
  status: 'AVAILABLE' | 'OCCUPIED' | 'READY_TO_PAY' | 'RESERVED' | 'CLEANING';
  branchId: string;
  customerId?: string | null;
  capacity?: number | null;
  openedAt?: string | null;
  openedBy?: string | null;
  closedAt?: string | null;
  notes?: string | null;
  currentOrder?: {
    id: string;
    orderNumber: number;
    totalAmount: number;
    items: Array<{
      id: string;
      menuItemName: string;
      quantity: number;
      unitPrice: number;
      subtotal: number;
    }>;
    customer?: {
      id: string;
      name?: string;
    };
    cashier?: {
      name?: string;
      username?: string;
    };
  };
}

interface TableGridProps {
  branchId: string;
  onTableSelect: (table: Table) => void;
  showAvailableOnly?: boolean;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'AVAILABLE':
      return 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-400';
    case 'OCCUPIED':
      return 'bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-950 dark:text-orange-400';
    case 'READY_TO_PAY':
      return 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-950 dark:text-blue-400';
    case 'RESERVED':
      return 'bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-950 dark:text-purple-400';
    case 'CLEANING':
      return 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400';
    default:
      return 'bg-slate-100 text-slate-700';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'AVAILABLE':
      return <Check className="h-4 w-4" />;
    case 'OCCUPIED':
      return <Users className="h-4 w-4" />;
    case 'READY_TO_PAY':
      return <Clock className="h-4 w-4" />;
    case 'RESERVED':
      return <MapPin className="h-4 w-4" />;
    case 'CLEANING':
      return <AlertCircle className="h-4 w-4" />;
    default:
      return <TableIcon className="h-4 w-4" />;
  }
};

export function TableGrid({ branchId, onTableSelect, showAvailableOnly = false }: TableGridProps) {
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'AVAILABLE' | 'OCCUPIED' | 'READY_TO_PAY'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchTables();
  }, [branchId, filter]);

  const fetchTables = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('branchId', branchId);
      if (filter !== 'all') {
        params.append('status', filter);
      }
      if (searchQuery) {
        params.append('search', searchQuery);
      }

      const response = await fetch(`/api/tables?${params.toString()}`);
      const data = await response.json();

      if (response.ok) {
        let filteredTables = data.tables || [];

        // Apply filters
        if (filter !== 'all' && searchQuery) {
          filteredTables = filteredTables.filter((table: Table) => {
            const search = searchQuery.toLowerCase();
            return (
              table.tableNumber.toString().includes(search) ||
              table.branch?.branchName.toLowerCase().includes(search) ||
              table.customer?.name?.toLowerCase().includes(search)
            );
          });
        } else if (filter !== 'all') {
          filteredTables = filteredTables.filter((table: Table) => table.status === filter);
        }

        setTables(filteredTables);
      } else {
        console.error('Failed to fetch tables:', await response.text());
      }
    } catch (error) {
      console.error('Failed to fetch tables:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchTables();
  };

  const handleTableClick = (table: Table) => {
    if (table.status === 'AVAILABLE' || table.status === 'READY_TO_PAY') {
      onTableSelect(table);
    } else if (table.status === 'OCCUPIED') {
      // View the table with its current order
      onTableSelect(table);
    } else {
      alert(`Table ${table.tableNumber} is ${table.status}. You need to close it first.`);
    }
  };

  const handleCreateTables = async () => {
    const count = prompt('How many tables do you want to create? (1-20)');
    const numTables = parseInt(count || '0');

    if (isNaN(numTables) || numTables < 1 || numTables > 20) {
      alert('Please enter a number between 1 and 20');
      return;
    }

    const capacity = prompt('What is the capacity for each table? (e.g., 2, 4, 6, 8) (leave empty for default 4)');
    const tableCapacity = capacity ? parseInt(capacity) : 4;

    try {
      const response = await fetch('/api/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId,
          startNumber: tables.length > 0 ? Math.max(...tables.map(t => t.tableNumber)) + 1 : 1,
          count: numTables,
          capacity: tableCapacity,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        await fetchTables();
        alert(`Successfully created ${data.tables.length} tables!`);
      } else {
        alert(data.error || 'Failed to create tables');
      }
    } catch (error) {
      console.error('Failed to create tables:', error);
      alert('Failed to create tables');
    }
  };

  const handleClearFilter = () => {
    setFilter('all');
    setSearchQuery('');
    fetchTables();
  };

  return (
    <div className="space-y-6">
      <Card className="bg-white/80 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TableIcon className="h-5 w-5 text-emerald-600" />
                Table Management
              </CardTitle>
              <CardDescription>Manage dine-in tables</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Search tables..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64"
              />
              <Button variant="outline" size="sm" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Dialog>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Tables
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[400px]">
                  <DialogHeader>
                    <DialogTitle>Create New Tables</DialogTitle>
                    <DialogDescription>
                      Create multiple tables for the branch
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    handleCreateTables();
                  }}>
                    <div className="space-y-4 py-4">
                      <div>
                        <Label>Number of tables</Label>
                        <Input
                          type="number"
                          min="1"
                          max="20"
                          defaultValue="5"
                          required
                        />
                      </div>
                      <div>
                        <Label>Capacity (seats per table)</Label>
                        <Input
                          type="number"
                          min="1"
                          max="8"
                          defaultValue="4"
                          placeholder="Default: 4"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => {
                        document.getElementById('create-tables-form').reset();
                      }}>
                        Cancel
                      </Button>
                      <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                        Create Tables
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full"></div>
            </div>
          ) : tables.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <TableIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No tables found. Create tables to manage dine-in customers.</p>
              {searchQuery && (
                <p className="text-sm text-slate-400">
                  No tables matching "{searchQuery}"
                </p>
              )}
              {!searchQuery && (
                <Button
                  onClick={handleCreateTables}
                  variant="outline"
                  size="sm"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Tables
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Filter Tabs */}
              <div className="flex gap-2 mb-4">
                <Button
                  variant={filter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={handleClearFilter}
                >
                  All Tables
                </Button>
                <Button
                  variant={filter === 'AVAILABLE' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setFilter('AVAILABLE');
                    setSearchQuery('');
                  }}
                >
                  Available
                </Button>
                <Button
                  variant={filter === 'OCCUPIED' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setFilter('OCCUPIED');
                    setSearchQuery('');
                  }}
                >
                  Occupied
                </Button>
                <Button
                  variant={filter === 'READY_TO_PAY' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setFilter('READY_TO_PAY');
                    setSearchQuery('');
                  }}
                >
                  Ready to Pay
                </Button>
                <Button
                  variant={filter === 'RESERVED' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setFilter('RESERVED');
                    setSearchQuery('');
                  }}
                >
                  Reserved
                </Button>
                <Button
                  variant={filter === 'CLEANING' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setFilter('CLEANING');
                    setSearchQuery('');
                  }}
                >
                  Cleaning
                </Button>
              </div>

              {/* Table Search */}
              {tables.length > 0 && (
                <Input
                  placeholder="Search by table number, customer name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full max-w-md mb-4"
                />
              )}

              {/* Tables Grid */}
              <ScrollArea className="h-[600px]">
                <div className="grid grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {tables.map((table) => {
                    const isClickable = table.status === 'AVAILABLE' || table.status === 'READY_TO_PAY';
                    return (
                      <Card
                        key={table.id}
                        className={`
                          cursor-pointer transition-all hover:scale-105 hover:shadow-lg
                          ${!isClickable ? 'opacity-50 hover:opacity-80' : ''}
                        `}
                        onClick={() => handleTableClick(table)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{
                                backgroundColor: getStatusColor(table.status).split(' ')[0],
                              color: getStatusColor(table.status).split(' ')[2],
                              color: '#fff'
                              }}>
                                {getStatusIcon(table.status)}
                              </div>
                              <div className="font-bold text-lg">{table.tableNumber}</div>
                            </div>
                            <Badge className={`${getStatusColor(table.status)} text-xs font-semibold`}>
                              {table.status}
                            </Badge>
                          </div>

                          {table.currentOrder && (
                            <div className="mt-2 text-sm border-l-2 border-slate-200 rounded p-2 bg-slate-50">
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-xs text-slate-600">Order:</span>
                                <span className="font-semibold text-sm">#{table.currentOrder.orderNumber}</span>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className="text-slate-600">Items:</span>
                                <span className="font-semibold">{table.currentOrder.items.length}</span>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className="text-slate-600">Total:</span>
                                <span className="font-semibold">${formatCurrency(table.currentOrder.totalAmount)}</span>
                              </div>
                            </div>
                          )}

                          <div className="flex items-center gap-2 text-xs text-slate-600">
                            {table.customer && (
                              <div className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                <span>{table.customer.name}</span>
                              </div>
                            )}
                            {table.openedAt && (
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                <span>{new Date(table.openedAt).toLocaleDateString()}</span>
                              </div>
                            )}
                            {table.capacity && (
                              <div className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                <span>{table.capacity} seats</span>
                              </div>
                            )}
                          </div>

                          {(table.notes || table.customer) && (
                            <div className="mt-2 text-xs text-slate-500">
                              {table.notes && (
                                <div className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  <span>{table.notes}</span>
                                </div>
                              )}
                              {table.customer && !table.customer.name && (
                                <div className="flex items-center gap-1">
                                  <Users className="h-3 w-3" />
                                  <span>Walk-in Customer</span>
                                </div>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </ScrollArea>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Format currency helper
function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}
