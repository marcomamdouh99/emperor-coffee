'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, User, MapPin, Phone, UserPlus, X, Star, Gift } from 'lucide-react';

interface Address {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  building?: string;
  streetAddress: string;
  floor?: string;
  apartment?: string;
  deliveryAreaId?: string;
  orderCount?: number;
  isDefault?: boolean;
  loyaltyPoints?: number;
}

interface CustomerSearchProps {
  onAddressSelect: (address: Address | null) => void;
  selectedAddress: Address | null;
  deliveryAreas: any[];
  branchId?: string;
  onCustomerSelect?: (customer: any) => void;
  selectedCustomer?: any;
}

export default function CustomerSearch({ onAddressSelect, selectedAddress, deliveryAreas, branchId, onCustomerSelect, selectedCustomer }: CustomerSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showNewCustomerDialog, setShowNewCustomerDialog] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  
  // Loyalty redemption state
  const [redeemingPoints, setRedeemingPoints] = useState(false);
  const [redeemablePoints, setRedeemablePoints] = useState(0);

  // New customer form state
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    phone: '',
    email: '',
    building: '',
    streetAddress: '',
    floor: '',
    apartment: '',
    deliveryAreaId: '',
  });
  const [creatingCustomer, setCreatingCustomer] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setHasSearched(false);
      return;
    }

    setLoading(true);
    setHasSearched(true);
    
    // Check if offline first
    const isOffline = !navigator.onLine;

    if (isOffline) {
      // Offline mode - search IndexedDB directly
      try {
        console.log('[CustomerSearch] Offline mode, searching IndexedDB...');
        const { getLocalStorageService } = await import('@/lib/storage/local-storage');
        const localStorageService = getLocalStorageService();
        await localStorageService.init();

        const allCustomers = await localStorageService.getAllCustomers();
        const allAddresses = await localStorageService.getAllCustomerAddresses();

        console.log('[CustomerSearch] Found customers in IndexedDB:', allCustomers.length);
        console.log('[CustomerSearch] Found addresses in IndexedDB:', allAddresses.length);

        // Create a map of customer IDs to their addresses
        const customerAddressMap = new Map<string, any[]>();
        allAddresses.forEach((addr: any) => {
          if (!customerAddressMap.has(addr.customerId)) {
            customerAddressMap.set(addr.customerId, []);
          }
          customerAddressMap.get(addr.customerId)!.push(addr);
        });

        // Search by name or phone
        const query = searchQuery.toLowerCase();
        const matchedCustomers = allCustomers
          .filter((customer: any) => {
            return (
              customer.name?.toLowerCase().includes(query) ||
              customer.phone?.toLowerCase().includes(query)
            );
          })
          .map((customer: any) => ({
            ...customer,
            addresses: customerAddressMap.get(customer.id) || [],
            totalOrders: 0, // Would need to track this separately
          }));

        setSearchResults(matchedCustomers);
        console.log('[CustomerSearch] Offline search found:', matchedCustomers.length, 'customers');
      } catch (offlineError) {
        console.error('[CustomerSearch] Offline search failed:', offlineError);
        setSearchResults([]);
      } finally {
        setLoading(false);
      }
      return;
    }

    // Online mode - try API first, then fallback to IndexedDB
    try {
      console.log('[CustomerSearch] Online mode, trying API...');
      const response = await fetch(`/api/customers?search=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();

      if (response.ok && data.customers && data.customers.length > 0) {
        // API returned customers, use them
        setSearchResults(data.customers);
        console.log('[CustomerSearch] API search found:', data.customers.length, 'customers');
      } else {
        // API returned no results or failed, fallback to IndexedDB
        console.log('[CustomerSearch] API returned no results, falling back to IndexedDB...');
        const { getLocalStorageService } = await import('@/lib/storage/local-storage');
        const localStorageService = getLocalStorageService();
        await localStorageService.init();

        const allCustomers = await localStorageService.getAllCustomers();
        const allAddresses = await localStorageService.getAllCustomerAddresses();

        console.log('[CustomerSearch] Found customers in IndexedDB:', allCustomers.length);
        console.log('[CustomerSearch] Found addresses in IndexedDB:', allAddresses.length);

        // Create a map of customer IDs to their addresses
        const customerAddressMap = new Map<string, any[]>();
        allAddresses.forEach((addr: any) => {
          if (!customerAddressMap.has(addr.customerId)) {
            customerAddressMap.set(addr.customerId, []);
          }
          customerAddressMap.get(addr.customerId)!.push(addr);
        });

        // Search by name or phone
        const query = searchQuery.toLowerCase();
        const matchedCustomers = allCustomers
          .filter((customer: any) => {
            return (
              customer.name?.toLowerCase().includes(query) ||
              customer.phone?.toLowerCase().includes(query)
            );
          })
          .map((customer: any) => ({
            ...customer,
            addresses: customerAddressMap.get(customer.id) || [],
            totalOrders: 0, // Would need to track this separately
          }));

        setSearchResults(matchedCustomers);
        console.log('[CustomerSearch] IndexedDB fallback found:', matchedCustomers.length, 'customers');
      }
    } catch (error) {
      console.error('[CustomerSearch] API error, falling back to IndexedDB:', error);

      // API error, fallback to IndexedDB
      try {
        const { getLocalStorageService } = await import('@/lib/storage/local-storage');
        const localStorageService = getLocalStorageService();
        await localStorageService.init();

        const allCustomers = await localStorageService.getAllCustomers();
        const allAddresses = await localStorageService.getAllCustomerAddresses();

        console.log('[CustomerSearch] Found customers in IndexedDB:', allCustomers.length);
        console.log('[CustomerSearch] Found addresses in IndexedDB:', allAddresses.length);

        // Create a map of customer IDs to their addresses
        const customerAddressMap = new Map<string, any[]>();
        allAddresses.forEach((addr: any) => {
          if (!customerAddressMap.has(addr.customerId)) {
            customerAddressMap.set(addr.customerId, []);
          }
          customerAddressMap.get(addr.customerId)!.push(addr);
        });

        // Search by name or phone
        const query = searchQuery.toLowerCase();
        const matchedCustomers = allCustomers
          .filter((customer: any) => {
            return (
              customer.name?.toLowerCase().includes(query) ||
              customer.phone?.toLowerCase().includes(query)
            );
          })
          .map((customer: any) => ({
            ...customer,
            addresses: customerAddressMap.get(customer.id) || [],
            totalOrders: 0, // Would need to track this separately
          }));

        setSearchResults(matchedCustomers);
        console.log('[CustomerSearch] IndexedDB fallback found:', matchedCustomers.length, 'customers');
      } catch (offlineError) {
        console.error('[CustomerSearch] IndexedDB fallback failed:', offlineError);
        setSearchResults([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddressClick = (address: Address, customer: any) => {
    onAddressSelect(address);
    onCustomerSelect?.(customer);
    // Calculate redeemable points (multiples of 15)
    const customerPoints = customer.loyaltyPoints || 0;
    setRedeemablePoints(Math.floor(customerPoints / 15) * 15);
    setSearchResults([]);
    setSearchQuery('');
    setHasSearched(false);
  };

  const handleClear = () => {
    onAddressSelect(null);
    onCustomerSelect?.(null);
    setSearchQuery('');
    setSearchResults([]);
    setHasSearched(false);
    setRedeemablePoints(0);
  };

  const handleRedeemPoints = () => {
    if (redeemablePoints < 15) {
      alert('Minimum 15 points required for redemption');
      return;
    }
    if (!confirm(`Redeem ${redeemablePoints} points for ${redeemablePoints} EGP discount?`)) {
      return;
    }
    setRedeemingPoints(true);
    // TODO: This should communicate with the POS component to apply the discount
    // The actual discount application will happen in the parent POS component
    setTimeout(() => {
      setRedeemingPoints(false);
      alert(`${redeemablePoints} points redeemed successfully!`);
    }, 500);
  };

  const handleCreateCustomer = async () => {
    if (!newCustomer.name || !newCustomer.phone || !newCustomer.streetAddress) {
      alert('Please fill in name, phone, and street address');
      return;
    }

    setCreatingCustomer(true);
    try {
      // Check if online
      const isOnline = navigator.onLine;

      if (isOnline) {
        // Try API first
        const response = await fetch('/api/customers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: newCustomer.name,
            phone: newCustomer.phone,
            email: newCustomer.email || null,
            branchId: branchId || null,
            addresses: [{
              building: newCustomer.building || null,
              streetAddress: newCustomer.streetAddress,
              floor: newCustomer.floor || null,
              apartment: newCustomer.apartment || null,
              deliveryAreaId: newCustomer.deliveryAreaId || null,
              isDefault: true,
            }],
          }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          // API failed - try offline mode
          throw new Error(data.error || 'API failed');
        }

        // Get the created address
        if (data.customer && data.customer.addresses && data.customer.addresses.length > 0) {
          const newAddress: Address = {
            id: data.customer.addresses[0].id,
            customerId: data.customer.id,
            customerName: data.customer.name,
            customerPhone: data.customer.phone,
            building: data.customer.addresses[0].building,
            streetAddress: data.customer.addresses[0].streetAddress,
            floor: data.customer.addresses[0].floor,
            apartment: data.customer.addresses[0].apartment,
            deliveryAreaId: data.customer.addresses[0].deliveryAreaId,
            orderCount: 0,
            isDefault: data.customer.addresses[0].isDefault,
          };

          // Auto-select the new address
          onAddressSelect(newAddress);
        }
      } else {
        // Offline mode - create customer locally
        throw new Error('Offline');
      }
    } catch (error: any) {
      console.error('Create customer error:', error);

      // If offline or API failed, create customer in IndexedDB
      try {
        const { getLocalStorageService } = await import('@/lib/storage/local-storage');
        const localStorageService = getLocalStorageService();
        await localStorageService.init();

        // Create a temporary ID
        const tempCustomerId = `temp-customer-${Date.now()}`;

        // Create customer object
        const customer = {
          id: tempCustomerId,
          name: newCustomer.name,
          phone: newCustomer.phone,
          email: newCustomer.email || null,
          branchId: branchId || null,
          loyaltyPoints: 0,
          tier: 'BRONZE',
          totalSpent: 0,
          orderCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        // Create address object
        const tempAddressId = `temp-address-${Date.now()}`;
        const address = {
          id: tempAddressId,
          customerId: tempCustomerId,
          building: newCustomer.building || null,
          streetAddress: newCustomer.streetAddress,
          floor: newCustomer.floor || null,
          apartment: newCustomer.apartment || null,
          deliveryAreaId: newCustomer.deliveryAreaId || null,
          isDefault: true,
          orderCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        // Save customer and address to IndexedDB
        await localStorageService.saveCustomer(customer);
        await localStorageService.saveCustomerAddress(address);

        // Queue operation for sync
        await localStorageService.addOperation({
          type: 'CREATE_CUSTOMER',
          data: {
            ...customer,
            addresses: [address],
          },
          branchId: branchId || 'unknown',
          retryCount: 0,
        });

        // Create address object for selection
        const newAddress: Address = {
          id: tempAddressId,
          customerId: tempCustomerId,
          customerName: customer.name,
          customerPhone: customer.phone,
          building: address.building,
          streetAddress: address.streetAddress,
          floor: address.floor,
          apartment: address.apartment,
          deliveryAreaId: address.deliveryAreaId,
          orderCount: 0,
          isDefault: address.isDefault,
        };

        // Auto-select the new address
        onAddressSelect(newAddress);

        alert('Customer created (offline mode - will sync when online)');
      } catch (offlineError) {
        console.error('Offline customer creation failed:', offlineError);
        alert('Failed to create customer. Please try again.');
      }
    } finally {
      setCreatingCustomer(false);
    }

    // Reset form
    setNewCustomer({
      name: '',
      phone: '',
      email: '',
      building: '',
      streetAddress: '',
      floor: '',
      apartment: '',
      deliveryAreaId: '',
    });

    // Close dialogs
    setShowNewCustomerDialog(false);
    setSearchQuery('');
    setSearchResults([]);
    setHasSearched(false);
  };

  const openNewCustomerDialog = () => {
    // Check if search query is a phone number or name
    const isPhone = searchQuery && searchQuery.match(/^[0-9+\-\s()]+$/);

    // Set form with pre-filled data
    setNewCustomer({
      name: isPhone ? '' : (searchQuery || ''),
      phone: isPhone ? searchQuery : '',
      email: '',
      building: '',
      streetAddress: '',
      floor: '',
      apartment: '',
      deliveryAreaId: '',
    });
    setShowNewCustomerDialog(true);
  };

  // Search automatically when query changes and user stops typing
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchQuery.trim()) {
        handleSearch();
      } else {
        setSearchResults([]);
        setHasSearched(false);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            type="text"
            placeholder="Search by phone or name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        {selectedAddress && (
          <Button onClick={handleClear} size="icon" variant="outline" className="shrink-0">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {selectedAddress && (
        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/50 rounded-full flex items-center justify-center flex-shrink-0">
              <User className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-emerald-900 dark:text-emerald-100">{selectedAddress.customerName}</p>
              <div className="flex items-center gap-2 mt-1">
                {selectedAddress.loyaltyPoints !== undefined && (
                  <span className="text-xs bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Star className="h-3 w-3" />
                    {(selectedAddress.loyaltyPoints || 0).toFixed(0)} pts
                  </span>
                )}
                {redeemablePoints > 0 && (
                  <span className="text-xs bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Gift className="h-3 w-3" />
                    {redeemablePoints} EGP
                  </span>
                )}
              </div>
              <div className="flex items-start gap-2 mt-1 text-xs text-slate-600 dark:text-slate-400">
                <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <p className="line-clamp-2">
                  {[selectedAddress.building, selectedAddress.streetAddress, selectedAddress.floor && `${selectedAddress.floor} Floor`, selectedAddress.apartment && `Apt ${selectedAddress.apartment}`].filter(Boolean).join(', ')}
                </p>
              </div>
              {selectedAddress.orderCount !== undefined && selectedAddress.orderCount > 0 && (
                <p className="text-xs text-slate-500 mt-1">
                  {selectedAddress.orderCount} {selectedAddress.orderCount === 1 ? 'order' : 'orders'} to this address
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-4 text-sm text-slate-500">
          <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full mr-2" />
          Searching customers...
        </div>
      )}

      {hasSearched && searchResults.length === 0 && !loading && (
        <div className="text-center py-6 bg-slate-50 dark:bg-slate-800/50 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-700">
          <User className="h-12 w-12 mx-auto mb-3 text-slate-400" />
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">No customers found</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            "{searchQuery}" doesn't match any existing customers
          </p>
          <Dialog open={showNewCustomerDialog} onOpenChange={setShowNewCustomerDialog}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                <UserPlus className="h-4 w-4 mr-2" />
                Register New Customer
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto z-[200]">
              <DialogHeader>
                <DialogTitle>Register New Customer</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="customerName">Name *</Label>
                  <Input
                    id="customerName"
                    value={newCustomer.name}
                    onChange={(e) => setNewCustomer(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter customer name"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="customerPhone">Phone *</Label>
                  <Input
                    id="customerPhone"
                    value={newCustomer.phone}
                    onChange={(e) => setNewCustomer(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="Enter phone number"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="customerEmail">Email (Optional)</Label>
                  <Input
                    id="customerEmail"
                    type="email"
                    value={newCustomer.email}
                    onChange={(e) => setNewCustomer(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="Enter email address"
                    className="mt-1"
                  />
                </div>
                <div className="border-t pt-4">
                  <p className="text-sm font-medium mb-3">Delivery Address *</p>
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="building">Building (Optional)</Label>
                      <Input
                        id="building"
                        value={newCustomer.building}
                        onChange={(e) => setNewCustomer(prev => ({ ...prev, building: e.target.value }))}
                        placeholder="Building name/number"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="streetAddress">Street Address *</Label>
                      <Input
                        id="streetAddress"
                        value={newCustomer.streetAddress}
                        onChange={(e) => setNewCustomer(prev => ({ ...prev, streetAddress: e.target.value }))}
                        placeholder="Street address"
                        className="mt-1"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="floor">Floor (Optional)</Label>
                        <Input
                          id="floor"
                          value={newCustomer.floor}
                          onChange={(e) => setNewCustomer(prev => ({ ...prev, floor: e.target.value }))}
                          placeholder="Floor"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="apartment">Apartment (Optional)</Label>
                        <Input
                          id="apartment"
                          value={newCustomer.apartment}
                          onChange={(e) => setNewCustomer(prev => ({ ...prev, apartment: e.target.value }))}
                          placeholder="Apt #"
                          className="mt-1"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="deliveryArea">Delivery Area</Label>
                      <Select value={newCustomer.deliveryAreaId} onValueChange={(value) => setNewCustomer(prev => ({ ...prev, deliveryAreaId: value }))}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select delivery area" />
                        </SelectTrigger>
                        <SelectContent>
                          {deliveryAreas.map((area) => (
                            <SelectItem key={area.id} value={area.id}>
                              {area.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <Button variant="outline" onClick={() => setShowNewCustomerDialog(false)} className="flex-1">
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateCustomer}
                    disabled={creatingCustomer}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                  >
                    {creatingCustomer ? 'Creating...' : 'Create Customer'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {searchResults.length > 0 && !loading && (
        <div className="max-h-60 overflow-y-auto border rounded-lg bg-white dark:bg-slate-900 shadow-lg">
          {searchResults.map((customer: any) => (
            <div key={customer.id} className="border-b last:border-b-0">
              <div className="p-3 font-medium text-sm bg-slate-50 dark:bg-slate-800 flex items-center gap-2">
                <User className="h-4 w-4 text-slate-500" />
                {customer.name}
                <span className="text-slate-400">|</span>
                <span className="text-slate-500 flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {customer.phone}
                </span>
                {customer.totalOrders > 0 && (
                  <span className="ml-auto text-xs bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full">
                    {customer.totalOrders} {customer.totalOrders === 1 ? 'order' : 'orders'}
                  </span>
                )}
                {customer.loyaltyPoints !== undefined && (
                  <span className="ml-2 text-xs bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Star className="h-3 w-3" />
                    {(customer.loyaltyPoints || 0).toFixed(0)} pts
                  </span>
                )}
              </div>
              {customer.addresses && customer.addresses.length > 0 ? (
                <div className="divide-y">
                  {customer.addresses.map((address: any) => (
                    <button
                      key={address.id}
                      onClick={() => handleAddressClick(address, customer)}
                      className="w-full p-3 text-left hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors group"
                    >
                      <div className="flex items-start gap-2">
                        <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0 text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs line-clamp-2 group-hover:text-emerald-700 dark:group-hover:text-emerald-300">
                            {[address.building, address.streetAddress, address.floor && `${address.floor} Floor`, address.apartment && `Apt ${address.apartment}`].filter(Boolean).join(', ')}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            {address.orderCount !== undefined && address.orderCount > 0 && (
                              <span className="text-xs text-slate-500">
                                {address.orderCount} {address.orderCount === 1 ? 'order' : 'orders'}
                              </span>
                            )}
                            {address.isDefault && (
                              <span className="text-xs bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full">
                                Default
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-3 text-xs text-slate-500 italic">
                  No addresses saved for this customer
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
