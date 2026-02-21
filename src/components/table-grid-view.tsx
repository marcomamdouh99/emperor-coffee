'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Users, Clock, Utensils, CheckCircle, AlertCircle, Plus, X, Info } from 'lucide-react';

interface TableData {
  id: string;
  tableNumber: number;
  status: 'AVAILABLE' | 'OCCUPIED' | 'READY_TO_PAY' | 'RESERVED' | 'CLEANING';
  capacity: number | null;
  totalAmount: number;
  customer?: {
    id: string;
    name: string;
    phone: string;
  } | null;
  openedAt: string | null;
}

interface TableGridViewProps {
  branchId: string;
  onTableSelect: (table: TableData) => void;
  selectedTableId: string | null;
}

export default function TableGridView({ branchId, onTableSelect, selectedTableId }: TableGridViewProps) {
  const [tables, setTables] = useState<TableData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'available' | 'occupied'>('all');
  const [tableWithOpenButton, setTableWithOpenButton] = useState<string | null>(null);

  useEffect(() => {
    fetchTables();
  }, [branchId]);

  const fetchTables = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/tables?branchId=${branchId}`);
      if (response.ok) {
        const data = await response.json();
        setTables(data.tables || []);
      }
    } catch (error) {
      console.error('Failed to fetch tables:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { color: string; bgColor: string; borderColor: string; icon: any }> = {
      AVAILABLE: {
        color: 'text-emerald-700',
        bgColor: 'bg-emerald-50 hover:bg-emerald-100',
        borderColor: 'border-emerald-200 hover:border-emerald-400',
        icon: CheckCircle,
      },
      OCCUPIED: {
        color: 'text-blue-700',
        bgColor: 'bg-blue-50 hover:bg-blue-100',
        borderColor: 'border-blue-200 hover:border-blue-400',
        icon: Users,
      },
      READY_TO_PAY: {
        color: 'text-orange-700',
        bgColor: 'bg-orange-50 hover:bg-orange-100',
        borderColor: 'border-orange-200 hover:border-orange-400',
        icon: Clock,
      },
      RESERVED: {
        color: 'text-purple-700',
        bgColor: 'bg-purple-50 hover:bg-purple-100',
        borderColor: 'border-purple-200 hover:border-purple-400',
        icon: Utensils,
      },
      CLEANING: {
        color: 'text-slate-700',
        bgColor: 'bg-slate-50 hover:bg-slate-100',
        borderColor: 'border-slate-200 hover:border-slate-400',
        icon: AlertCircle,
      },
    };
    return configs[status] || configs.AVAILABLE;
  };

  const filteredTables = tables.filter(table => {
    if (filter === 'all') return true;
    if (filter === 'available') return table.status === 'AVAILABLE';
    if (filter === 'occupied') return table.status === 'OCCUPIED' || table.status === 'READY_TO_PAY';
    return true;
  });

  const handleTableClick = (table: TableData) => {
    if (table.status === 'AVAILABLE') {
      // Show "Open" button for available tables
      setTableWithOpenButton(table.id);
    } else {
      // Select occupied tables directly
      onTableSelect(table);
    }
  };

  const handleOpenTable = async (table: TableData) => {
    try {
      const userStr = localStorage.getItem('user');
      if (!userStr) {
        alert('User not logged in');
        return;
      }

      const user = JSON.parse(userStr);

      const response = await fetch(`/api/tables/${table.id}/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cashierId: user.id,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // Select the table and notify parent
        onTableSelect({ ...data.table, totalAmount: 0 });
        await fetchTables();
        setTableWithOpenButton(null);
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to open table');
      }
    } catch (error) {
      console.error('Failed to open table:', error);
      alert('Failed to open table');
    }
  };

  const handleCancelOpen = () => {
    setTableWithOpenButton(null);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Tables</h3>
          <p className="text-sm text-slate-500">Select a table to start ordering</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
            className={filter === 'all' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
          >
            All
          </Button>
          <Button
            variant={filter === 'available' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('available')}
            className={filter === 'available' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
          >
            Available
          </Button>
          <Button
            variant={filter === 'occupied' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('occupied')}
            className={filter === 'occupied' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
          >
            Occupied
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchTables}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Tables Grid - Small Boxes */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full"></div>
        </div>
      ) : (
        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2">
          {filteredTables.map((table) => {
            const config = getStatusConfig(table.status);
            const isSelected = selectedTableId === table.id;
            const showOpenButton = tableWithOpenButton === table.id;

            return (
              <div
                key={table.id}
                className="relative"
              >
                {/* Table Card - Small Box */}
                <button
                  className={`
                    w-full aspect-square rounded-lg border-2 flex flex-col items-center justify-center
                    transition-all duration-200 relative
                    ${config.bgColor} ${config.borderColor}
                    ${isSelected ? 'ring-2 ring-emerald-500 ring-offset-2' : ''}
                    ${showOpenButton ? 'opacity-50' : 'hover:scale-105'}
                  `}
                  onClick={() => !showOpenButton && handleTableClick(table)}
                  title={`Table ${table.tableNumber} - ${table.status}${table.customer ? ` (${table.customer.name})` : ''}`}
                >
                  {/* Table Number */}
                  <span className={`text-2xl font-bold ${config.color}`}>
                    {table.tableNumber}
                  </span>

                  {/* Status Dot */}
                  <div className={`mt-1 w-2 h-2 rounded-full ${config.color.replace('text', 'bg')}`} />

                  {/* Selected indicator */}
                  {isSelected && (
                    <div className="absolute top-1 right-1">
                      <div className="w-5 h-5 bg-emerald-600 rounded-full flex items-center justify-center">
                        <CheckCircle className="h-3 w-3 text-white" />
                      </div>
                    </div>
                  )}

                  {/* Info indicator for tables with extra data */}
                  {(table.customer || table.totalAmount > 0) && (
                    <div className="absolute top-1 left-1">
                      <Info className="h-3 w-3 text-slate-400" />
                    </div>
                  )}
                </button>

                {/* Open Button - Appears on click for available tables */}
                {showOpenButton && (
                  <div className="absolute inset-0 flex items-center justify-center z-10">
                    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl border-2 border-emerald-500 p-3 flex flex-col gap-2 animate-in fade-in zoom-in duration-200">
                      <div className="text-center">
                        <p className="font-bold text-slate-900 dark:text-white text-lg">Table {table.tableNumber}</p>
                        <p className="text-xs text-slate-500">Open this table?</p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleOpenTable(table)}
                          className="bg-emerald-600 hover:bg-emerald-700 flex-1"
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Open
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleCancelOpen}
                          className="flex-1"
                        >
                          <X className="h-3 w-3 mr-1" />
                          Cancel
                        </Button>
                      </div>
                      {table.capacity && (
                        <p className="text-xs text-center text-slate-500">
                          {table.capacity} seats available
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Tooltip for occupied tables */}
                {table.status !== 'AVAILABLE' && !showOpenButton && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-20">
                    <div className="bg-slate-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap">
                      <div className="font-semibold">Table {table.tableNumber}</div>
                      <div className="text-slate-300 capitalize">{table.status.toLowerCase()}</div>
                      {table.customer && <div>{table.customer.name}</div>}
                      {table.totalAmount > 0 && <div>EGP {table.totalAmount.toFixed(2)}</div>}
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 rotate-45" />
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Add New Table Button */}
          {filter === 'all' && (
            <button
              className="w-full aspect-square rounded-lg border-2 border-dashed border-slate-300 hover:border-emerald-500 hover:bg-emerald-50 transition-all duration-200 flex flex-col items-center justify-center text-slate-400 hover:text-emerald-600"
              onClick={() => alert('Please use Table Management in Settings to add new tables')}
            >
              <Plus className="h-6 w-6" />
              <span className="text-xs font-medium mt-1">Add</span>
            </button>
          )}
        </div>
      )}

      {tables.length === 0 && !loading && (
        <div className="text-center py-12">
          <Utensils className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <h4 className="text-lg font-semibold text-slate-600 mb-2">No Tables Yet</h4>
          <p className="text-sm text-slate-500">
            Create tables in Settings to use the dine-in feature
          </p>
        </div>
      )}
    </div>
  );
}
