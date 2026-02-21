# Emperor Coffee POS System - Analysis Report

## Executive Summary

This document provides a comprehensive analysis of the Emperor Coffee POS system, focusing on the Reports Dashboard, Shift/Day closing logic, and receipt generation mechanisms.

---

## 1. SYSTEM ARCHITECTURE

### 1.1 Data Models (Prisma Schema)

**Key Models:**
- **Order**: Main transaction record with items, payment method, order type (dine-in/take-away/delivery)
- **Shift**: Tracks cashier work periods with opening/closing cash and revenue
- **BusinessDay**: Represents a full business day containing multiple shifts
- **MenuItem**: Product catalog with categories and variants
- **OrderItem**: Individual items in an order with quantities and prices
- **Branch**: Multi-branch support for franchise operations

### 1.2 Important Relationships

```
BusinessDay (1) ----< (N) Shift (1) ----< (N) Order (1) ----< (N) OrderItem
      |                      |                      |
      |                      |                      +--> MenuItem
      +--> Branch            +--> User (Cashier)
```

---

## 2. CURRENT REPORTS DASHBOARD ISSUES

### 2.1 Problems Identified

1. **Overview Tab**: Not displaying data - KPI API exists but may not be returning data properly
2. **Sales & Refunds Tab**: Orders not showing - API exists but filtering/logic issues
3. **Customers Tab**: Not displaying customer analytics properly

### 2.2 Root Causes

1. The KPI API (`/api/reports/kpi`) is well-structured and returns:
   - Revenue metrics (total, net, product cost, delivery fees)
   - Order metrics (count, items, avg value, growth)
   - Order type breakdown (dine-in, take-away, delivery)
   - Payment methods breakdown
   - Hourly sales data
   - Refund rate
   - Top categories

2. The Reports Dashboard component correctly fetches from this API, but may have:
   - Date range calculation issues
   - Filter application problems
   - Empty data states not handled properly

---

## 3. RECEIPT GENERATION SYSTEM

### 3.1 Current Implementation

**ReceiptViewer Component** (`receipt-viewer.tsx`):
- Fetches order data and receipt settings
- Generates HTML preview
- Supports thermal printer via ESC/POS
- Uses `escpos-encoder.ts` for ESC/POS command generation

**ESC/POS Encoder** (`escpos-encoder.ts`):
- Generates raw printer commands
- Supports: text formatting, alignment, bold, double width/height
- Handles: cash drawer open, paper cut, images
- Function: `generateReceiptESCPOS(data: ReceiptData): Uint8Array`

### 3.2 Receipt Data Structure

```typescript
interface ReceiptData {
  storeName: string;
  branchName: string;
  orderNumber: number;
  date: Date;
  cashier: string;
  orderType?: string;
  customerPhone?: string;
  customerName?: string;
  deliveryAddress?: string;
  items: ReceiptItem[];
  subtotal: number;
  deliveryFee?: number;
  loyaltyDiscount?: number;
  loyaltyPointsRedeemed?: number;
  promoDiscount?: number;
  promoCode?: string;
  total: number;
  paymentMethod: 'cash' | 'card';
  isRefunded: boolean;
  refundReason?: string;
  // ... receipt settings
}
```

---

## 4. SHIFT & BUSINESS DAY CLOSING

### 4.1 Shift Closing Logic

**Location**: `shift-management.tsx` (lines 1045-1200+)

**Process:**
1. User enters closing cash amount
2. System calculates actual revenue from orders (subtotal only, excluding delivery fees)
3. Updates shift record with:
   - `endTime`: Current timestamp
   - `closingCash`: User-provided amount
   - `closingOrders`: Count of orders
   - `closingRevenue`: Calculated from orders
   - `isClosed`: true

**Key Calculation:**
```javascript
const subtotal = shiftOrders.reduce((sum, order) => sum + (order.subtotal || 0), 0);
const deliveryFees = shiftOrders.reduce((sum, order) => sum + (order.deliveryFee || 0), 0);
const cashierRevenue = subtotal; // Subtotal excludes delivery fees
```

### 4.2 Business Day Closing Logic

**Location**: `shift-management.tsx` (lines 697-754)

**Process:**
1. Validates all shifts are closed
2. Calls `/api/business-days/close` endpoint
3. Fetches closing report from `/api/business-days/closing-report`
4. Displays report to user

**Current Report API** (`/api/business-days/closing-report/route.ts`):
- Returns business day summary
- Category breakdown with items
- Shift summaries
- Payment breakdown (cash vs card)
- Refund information

---

## 5. REQUIRED IMPROVEMENTS

### 5.1 Reports Dashboard Fixes

**Action Items:**
1. Verify KPI API is returning correct data for current date range
2. Fix date range calculations (ensure proper timezone handling)
3. Add better loading and empty states
4. Ensure filters (branch, date range) are properly applied

### 5.2 Closing Shift Receipt (2 Papers)

**Paper 1 - Payment Summary:**
```
-----------------
|Shift Number |
------------------
date and time

[TOTAL Visa     TOTAL Cash     User]
[0.00           3915           marco]
----------------------------------------------------
```

**Required Data:**
- Shift number
- Date & time
- Total Visa/Card sales
- Total Cash sales
- Cashier name

**Paper 2 - Item Breakdown:**
```
Shift Number:
date&time

[Item                    Qty      Value]
-----------------------------------------
[Category 1 Name               480]
[Item1-name        1            480]
---------------------------------------
[Category 2 Name               890]
[Item1-name       1            480]
[Item2-name       1            410]
--------------------------------------
```

**Required Data:**
- Shift number
- Date & time
- Categories with total value
- Items per category: name, quantity, total value

### 5.3 Closing Day Receipt (2 Papers)

**Paper 1 - Shift Summary (per shift):**
```
user                   Shift Totals
marco               [Shift Number 6]
time                 Date
Starting shift time :
Ending Shift Time :
--------------------------------------------
| Take Away  Value |      222.00       |
--------------------------------------------
| Discounts Value |        0.00          |
--------------------------------------------
| Total Take away Value|   222.00     |
--------------------------------------------
--------------------------------------------
| Dine In  Value |       555.00          |
--------------------------------------------
| Discounts Value |        0.00          |
--------------------------------------------
| Total Dine In Value|    555.00     |
--------------------------------------------
--------------------------------------------
| Delivery Value |       155.00          |
--------------------------------------------
| Discounts Value |        0.00          |
--------------------------------------------
| Total Delivery Value|   155.00     |
--------------------------------------------
--------------------------------------------
--------------------------------------------
| TOTAL SALES |       932              |
| TOTAL DISCOUNT|    0.00              |
|TOTAL DELIVERY FEES|  800              |
|TOTAL REFUND |    0.00                |
| TOTAL CARD   |   500                |
| TOTAL CASH   |    1232               |
| OPENING CASH BALANCE |  100.00 |
| TOTAL             |   1832              |
| CLOSING CASH BALANCE|    1832 |
| OVER/SHORT |      0.00               |
--------------------------------------------
```

**Required Data per Shift:**
- Shift number
- Date & time range
- Take Away: value, discounts, total
- Dine In: value, discounts, total
- Delivery: value, discounts, total
- Totals: sales, discounts, delivery fees, refunds, card, cash
- Cash tracking: opening balance, total, closing balance, over/short

**Paper 2 - Item Summary (similar to Shift Receipt Paper 2):**
Same format as Shift Paper 2 but for entire day (all shifts combined)

---

## 6. IMPLEMENTATION PLAN

### Phase 1: Fix Reports Dashboard
1. Create enhanced KPI API endpoint with better error handling
2. Fix date range calculations
3. Improve data fetching and caching
4. Add proper loading and empty states

### Phase 2: Create Shift Closing Receipts
1. Create new API: `/api/shifts/[id]/closing-report`
2. Create ESC/POS encoder functions for shift receipts
3. Integrate receipt generation into shift closing flow
4. Add print functionality (2 papers)

### Phase 3: Create Day Closing Receipts
1. Enhance existing: `/api/business-days/closing-report` API
2. Create ESC/POS encoder functions for day receipts
3. Integrate receipt generation into day closing flow
4. Add print functionality (2 papers per shift + summary)

### Phase 4: Testing & Deployment
1. Test all report types
2. Verify calculations
3. Test printing
4. Deploy and push to GitHub

---

## 7. KEY CALCULATIONS

### 7.1 Shift Totals
```
Total Sales = Sum of all order.subtotal
Total Discounts = Sum of (order.loyaltyDiscount + order.promoDiscount)
Total Delivery Fees = Sum of order.deliveryFee
Total Card = Sum of order.totalAmount where paymentMethod = 'card'
Total Cash = Sum of order.totalAmount where paymentMethod = 'cash'
Expected Cash = Opening Cash + Total Cash
Over/Short = Closing Cash - Expected Cash
```

### 7.2 Order Type Breakdown (per shift)
```
Take Away = { value, discounts, total }
Dine In = { value, discounts, total }
Delivery = { value, discounts, total }
```

For each order type:
- value = Sum of order.subtotal
- discounts = Sum of (order.loyaltyDiscount + order.promoDiscount)
- total = value - discounts

---

## 8. TECHNICAL CONSIDERATIONS

### 8.1 Data Consistency
- Ensure all calculations use the same data source
- Handle refunds correctly (exclude from totals or track separately)
- Consider timezone for date-based reports

### 8.2 Performance
- Optimize database queries (use includes, selects)
- Cache report data where appropriate
- Implement pagination for large datasets

### 8.3 Printing
- Support both thermal (ESC/POS) and standard printing
- Handle paper cut between 2 papers
- Ensure proper formatting for 80mm paper width

---

## 9. DATABASE QUERIES NEEDED

### 9.1 Shift Closing Report Query
```prisma
const shift = await db.shift.findUnique({
  where: { id: shiftId },
  include: {
    cashier: { select: { name: true, username: true } },
    orders: {
      include: {
        items: {
          include: {
            menuItem: { select: { name: true, category: true } }
          }
        }
      }
    }
  }
});
```

### 9.2 Business Day Enhanced Report Query
```prisma
const businessDay = await db.businessDay.findUnique({
  where: { id: businessDayId },
  include: {
    shifts: {
      include: {
        cashier: { select: { name: true, username: true } },
        orders: {
          include: {
            items: {
              include: {
                menuItem: { select: { name: true, category: true } }
              }
            }
          }
        }
      }
    }
  }
});
```

---

## 10. CONCLUSION

The system has a solid foundation with:
- Well-structured data models
- Existing receipt generation infrastructure
- Shift and business day tracking

Key improvements needed:
1. Fix Reports Dashboard data display issues
2. Create proper closing shift receipts (2-paper format)
3. Create proper closing day receipts (2-paper format per shift)
4. Ensure all calculations are accurate and consistent

All changes will be made without disrupting existing logic.
