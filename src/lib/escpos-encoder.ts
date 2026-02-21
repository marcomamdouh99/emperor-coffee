/**
 * ESC/POS Receipt Encoder
 * Generates raw ESC/POS commands for thermal printers
 * Supports: Text formatting, barcode, cut, cash drawer
 */

export interface ReceiptItem {
  itemName: string;
  quantity: number;
  subtotal: number;
  price?: number;
  note?: string;
}

export interface ReceiptData {
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
  cardReferenceNumber?: string;
  isRefunded: boolean;
  refundReason?: string;
  // Receipt settings
  headerText?: string;
  footerText?: string;
  thankYouMessage?: string;
  fontSize?: 'small' | 'medium' | 'large';
  showLogo?: boolean;
  showCashier?: boolean;
  showDateTime?: boolean;
  showOrderType?: boolean;
  showCustomerInfo?: boolean;
  openCashDrawer?: boolean;
  cutPaper?: boolean;
  cutType?: 'full' | 'partial';
}

export class ESCPOSEncoder {
  private buffer: number[] = [];

  /**
   * Initialize printer
   */
  constructor() {
    this.reset();
    this.setCharacterEncoding('CP437');
  }

  /**
   * Reset printer to default state
   */
  reset(): this {
    this.addBytes(0x1B, 0x40); // ESC @ - Initialize
    return this;
  }

  /**
   * Set character encoding
   */
  setCharacterEncoding(encoding: 'CP437' | 'CP850' | 'UTF-8' = 'CP437'): this {
    // For most thermal printers, CP437 is default
    if (encoding === 'CP850') {
      this.addBytes(0x1B, 0x74, 0x02); // ESC t 2 - CP850
    } else if (encoding === 'UTF-8') {
      this.addBytes(0x1B, 0x74, 0x08); // ESC t 8 - UTF-8 (if supported)
    }
    return this;
  }

  /**
   * Set text alignment
   */
  align(alignment: 'left' | 'center' | 'right'): this {
    const alignMap = { left: 0, center: 1, right: 2 };
    this.addBytes(0x1B, 0x61, alignMap[alignment]);
    return this;
  }

  /**
   * Set text style
   */
  style(options: { bold?: boolean; underline?: boolean; doubleHeight?: boolean; doubleWidth?: boolean }): this {
    if (options.bold !== undefined) {
      this.addBytes(0x1B, 0x45, options.bold ? 0x01 : 0x00); // ESC E
    }
    if (options.underline !== undefined) {
      this.addBytes(0x1B, 0x2D, options.underline ? 0x01 : 0x00); // ESC -
    }
    if (options.doubleHeight !== undefined || options.doubleWidth !== undefined) {
      const dh = options.doubleHeight ? 0x10 : 0x00;
      const dw = options.doubleWidth ? 0x20 : 0x00;
      this.addBytes(0x1D, 0x21, dh | dw); // GS !
    }
    return this;
  }

  /**
   * Set font size (normal, double, or large)
   */
  fontSize(size: 'normal' | 'double' | 'large'): this {
    if (size === 'normal') {
      this.addBytes(0x1D, 0x21, 0x00); // Normal
    } else if (size === 'double') {
      this.addBytes(0x1D, 0x21, 0x11); // Double width/height
    } else if (size === 'large') {
      this.addBytes(0x1D, 0x21, 0x30); // Extra large
    }
    return this;
  }

  /**
   * Add text
   */
  text(text: string): this {
    // Convert string to bytes (ASCII compatible for basic chars)
    for (let i = 0; i < text.length; i++) {
      this.buffer.push(text.charCodeAt(i) & 0xFF);
    }
    return this;
  }

  /**
   * Add new line
   */
  newLine(): this {
    this.addBytes(0x0A);
    return this;
  }

  /**
   * Add multiple new lines
   */
  newLines(count: number): this {
    for (let i = 0; i < count; i++) {
      this.newLine();
    }
    return this;
  }

  /**
   * Add a horizontal line (dashed)
   */
  hr(char: string = '-'): this {
    this.text(char.repeat(32));
    this.newLine();
    return this;
  }

  /**
   * Feed and cut paper
   * @param type 'full' or 'partial'
   */
  cut(type: 'full' | 'partial' = 'full'): this {
    this.newLines(3);
    if (type === 'full') {
      this.addBytes(0x1D, 0x56, 0x42, 0x00); // GS V 66 0 - Full cut
    } else {
      this.addBytes(0x1D, 0x56, 0x66, 0x00); // GS V 66 1 - Partial cut
    }
    return this;
  }

  /**
   * Open cash drawer
   * @param pin 0 for pin 2, 1 for pin 5
   * @param duration Pulse time in 2ms units (50 = 100ms)
   */
  openCashDrawer(pin: 0 | 1 = 0, duration: number = 50): this {
    // ESC p m t1 t2
    this.addBytes(0x1B, 0x70, pin, duration & 0xFF, (duration >> 8) & 0xFF);
    return this;
  }

  /**
   * Print image (simplified bitmap printing)
   * Note: This is a basic implementation for compatible printers
   */
  printImage(imageData: string): this {
    try {
      // Parse base64 image
      const base64Data = imageData.split(',')[1];
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // For now, just skip image printing as it requires complex bitmap conversion
      // In production, you would need to convert the image to 1-bit or 8-bit grayscale bitmap
      // and use GS v 0, GS 8 L commands for image printing

      console.log('Image printing would go here. For production, implement bitmap conversion.');
    } catch (error) {
      console.error('Failed to print image:', error);
    }
    return this;
  }

  /**
   * Print QR code (if supported)
   */
  qrCode(data: string, size: number = 8): this {
    // QR code printing varies by printer model
    // This is a basic implementation for compatible printers
    this.addBytes(
      0x1D, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, size, 0x00 // Set QR size
    );
    this.addBytes(
      0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, 0x03 // Set QR error correction
    );
    const dataLen = data.length + 3;
    this.addBytes(
      0x1D, 0x28, 0x6B, dataLen & 0xFF, (dataLen >> 8) & 0xFF, // Store QR data
      0x31, 0x50, 0x30
    );
    this.text(data);
    this.addBytes(0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30); // Print QR
    return this;
  }

  /**
   * Add bytes directly to buffer
   */
  private addBytes(...bytes: number[]): this {
    this.buffer.push(...bytes);
    return this;
  }

  /**
   * Get encoded data as Uint8Array
   */
  encode(): Uint8Array {
    return new Uint8Array(this.buffer);
  }

  /**
   * Clear buffer
   */
  clear(): this {
    this.buffer = [];
    return this;
  }

  /**
   * Get buffer length
   */
  get length(): number {
    return this.buffer.length;
  }
}

/**
 * Map font size setting to encoder font size
 */
function mapFontSize(size?: 'small' | 'medium' | 'large'): 'normal' | 'double' | 'large' {
  switch (size) {
    case 'small':
      return 'normal';
    case 'medium':
      return 'double';
    case 'large':
      return 'large';
    default:
      return 'double'; // Default to medium (double)
  }
}

/**
 * Generate a complete receipt with ESC/POS commands
 */
export function generateReceiptESCPOS(data: ReceiptData): Uint8Array {
  const encoder = new ESCPOSEncoder();

  // Debug: Log items with notes
  console.log('Thermal printer received items:', data.items.map(item => ({
    name: item.itemName,
    note: item.note,
    hasNote: !!item.note,
  })));

  // Map font size
  const baseFontSize = mapFontSize(data.fontSize);

  // Reset printer
  encoder.reset();

  // Store Name - Centered, Bold, Large (always large regardless of setting)
  encoder.align('center');

  // Print logo if available and enabled
  if (data.showLogo && data.logoData) {
    encoder.printImage(data.logoData).newLines(1);
  } else if (data.showLogo) {
    // Default emoji if no logo uploaded
    encoder.fontSize(baseFontSize).text('☕').newLines(1);
  }

  encoder.style({ bold: true, doubleWidth: true, doubleHeight: true })
    .text(data.storeName)
    .newLines(2)
    .style({ bold: false, doubleWidth: false, doubleHeight: false });

  // Branch name - use selected font size
  encoder.fontSize(baseFontSize)
    .text(data.branchName)
    .newLines(1);

  // Header Text (if enabled) - use selected font size
  if (data.headerText) {
    encoder.text(data.headerText).newLines(2);
  } else {
    encoder.newLine();
  }

  // Order Number - Bold
  encoder.fontSize(baseFontSize)
    .style({ bold: true })
    .text(`Receipt #${data.orderNumber}`)
    .newLine()
    .style({ bold: false });

  // Refund notice
  if (data.isRefunded) {
    encoder.newLines(1)
      .text('*** REFUNDED ***')
      .newLine();
    if (data.refundReason) {
      encoder.text(`Reason: ${data.refundReason}`);
    }
    encoder.newLine();
  }

  // Date and Time
  encoder.hr('=');
  if (data.showDateTime !== false) {
    encoder.fontSize(baseFontSize)
      .text(`Date: ${data.date.toLocaleDateString()} ${data.date.toLocaleTimeString()}`)
      .newLine();
  }

  // Cashier
  if (data.showCashier !== false) {
    encoder.fontSize(baseFontSize)
      .text(`Cashier: ${data.cashier}`)
      .newLine();
  }

  // Order Type
  if (data.showOrderType !== false && data.orderType) {
    const orderTypeMap = {
      'dine-in': 'Dine In',
      'take-away': 'Take Away',
      'delivery': 'Delivery'
    };
    encoder.fontSize(baseFontSize)
      .text(`Type: ${orderTypeMap[data.orderType as keyof typeof orderTypeMap] || data.orderType}`)
      .newLine();
  }

  // Customer Info
  if (data.showCustomerInfo !== false) {
    if (data.customerPhone) {
      encoder.fontSize(baseFontSize)
        .text(`Phone: ${data.customerPhone}`)
        .newLine();
    }
    if (data.customerName) {
      encoder.fontSize(baseFontSize)
        .text(`Customer: ${data.customerName}`)
        .newLine();
    }
  }

  // Delivery Address
  if (data.orderType === 'delivery' && data.deliveryAddress) {
    encoder.newLines(1)
      .style({ bold: true })
      .text('Delivery Details:')
      .style({ bold: false })
      .newLine()
      .fontSize(baseFontSize)
      .text(data.deliveryAddress)
      .newLine();
  }

  // Items Header
  encoder.hr('=')
    .newLines(1);

  // Items - use selected font size
  encoder.fontSize(baseFontSize);
  data.items.forEach(item => {
    const line1 = `${item.quantity}x ${item.itemName}`;
    const line2 = `${formatMoney(item.subtotal)}`;

    encoder.text(line1).newLine();
    encoder.align('right').text(line2).align('left').newLine();

    // Print note if exists
    if (item.note) {
      encoder.text(`  Note: ${item.note}`).newLine();
    }

    encoder.newLine();
  });

  // Totals - use selected font size
  encoder.hr('=')
    .newLines(1)
    .fontSize(baseFontSize);

  encoder.text(`Subtotal:`)
    .align('right')
    .text(formatMoney(data.subtotal))
    .align('left')
    .newLine();

  if (data.deliveryFee && data.deliveryFee > 0) {
    encoder.text(`Delivery Fee:`)
      .align('right')
      .text(formatMoney(data.deliveryFee))
      .align('left')
      .newLine();
  }

  if (data.loyaltyDiscount && data.loyaltyDiscount > 0) {
    encoder.text(`Loyalty Discount (${data.loyaltyPointsRedeemed} pts):`)
      .align('right')
      .text(`-${formatMoney(data.loyaltyDiscount)}`)
      .align('left')
      .newLine();
  }

  if (data.promoDiscount && data.promoDiscount > 0) {
    encoder.text(`Promo Code ${data.promoCode ? `(${data.promoCode})` : ''}:`)
      .align('right')
      .text(`-${formatMoney(data.promoDiscount)}`)
      .align('left')
      .newLine();
  }

  // Total - Always large for emphasis
  encoder.style({ bold: true, doubleWidth: true, doubleHeight: true })
    .text('TOTAL:')
    .align('right')
    .text(formatMoney(data.total))
    .align('left')
    .newLine()
    .style({ bold: false, doubleWidth: false, doubleHeight: false });

  // Payment Method - use selected font size
  encoder.fontSize(baseFontSize)
    .newLine()
    .text(`Payment: ${data.paymentMethod === 'card' ? 'Card' : 'Cash'}`)
    .newLines(2);

  // Card Reference Number - if card payment
  if (data.paymentMethod === 'card' && data.cardReferenceNumber) {
    encoder.text(`Ref. No: ${data.cardReferenceNumber}`)
      .newLines(2);
  }

  // Footer
  encoder.hr('=')
    .newLines(1)
    .align('center');

  // Thank you message - use selected font size
  encoder.fontSize(baseFontSize);
  if (data.thankYouMessage) {
    encoder.text(data.thankYouMessage).newLine();
  }

  // Footer text - use selected font size
  if (data.footerText) {
    encoder.text(data.footerText).newLine();
  }

  // Store name - use selected font size
  encoder.text(data.storeName)
    .newLines(3);

  // Open cash drawer (if enabled)
  if (data.openCashDrawer !== false) {
    encoder.openCashDrawer(0, 50);
  }

  // Cut paper (if enabled)
  if (data.cutPaper !== false) {
    encoder.cut(data.cutType === 'partial' ? 'partial' : 'full');
  }

  return encoder.encode();
}

/**
 * Format money amount
 */
function formatMoney(amount: number): string {
  return amount.toFixed(2);
}

// ============================================================================
// SHIFT CLOSING RECEIPT FUNCTIONS
// ============================================================================

export interface ShiftClosingReportData {
  storeName: string;
  branchName: string;
  shift: {
    shiftNumber: number;
    startTime: string;
    endTime: string;
    cashier: { name: string; username: string };
  };
  paymentSummary: {
    cash: number;
    card: number;
    other: number;
    total: number;
  };
  categoryBreakdown: Array<{
    categoryName: string;
    totalSales: number;
    items: Array<{
      itemName: string;
      quantity: number;
      totalPrice: number;
    }>;
  }>;
  fontSize?: 'small' | 'medium' | 'large';
}

/**
 * Generate Shift Closing Receipt - Paper 1 (Payment Summary)
 */
export function generateShiftClosingReceiptPaper1(data: ShiftClosingReportData): Uint8Array {
  const encoder = new ESCPOSEncoder();
  const baseFontSize = mapFontSize(data.fontSize);

  encoder.reset();

  // Header
  encoder.align('center')
    .style({ bold: true, doubleWidth: true })
    .text('SHIFT CLOSING REPORT')
    .newLines(2)
    .style({ bold: false, doubleWidth: false, doubleHeight: false });

  encoder.style({ bold: true })
    .text(`Shift Number: ${data.shift.shiftNumber}`)
    .newLines(1)
    .style({ bold: false });

  encoder.fontSize(baseFontSize)
    .text(`Date: ${new Date(data.shift.startTime).toLocaleDateString()}`)
    .newLine()
    .text(`Time: ${new Date(data.shift.startTime).toLocaleTimeString()} - ${new Date(data.shift.endTime).toLocaleTimeString()}`)
    .newLines(2);

  encoder.hr('=')
    .newLines(1);

  // Payment Summary Row
  const cashierName = data.shift.cashier.name || data.shift.cashier.username;
  
  // Format for TOTAL Visa, TOTAL Cash, User
  const visaTotal = formatMoney(data.paymentSummary.card + data.paymentSummary.other);
  const cashTotal = formatMoney(data.paymentSummary.cash);
  
  // Create a formatted row
  encoder.style({ bold: true })
    .text('TOTAL Visa')
    .newLine()
    .style({ bold: false });
  
  encoder.align('right')
    .text(visaTotal)
    .align('left')
    .newLines(1);
  
  encoder.style({ bold: true })
    .text('TOTAL Cash')
    .newLine()
    .style({ bold: false });
  
  encoder.align('right')
    .text(cashTotal)
    .align('left')
    .newLines(1);
  
  encoder.style({ bold: true })
    .text('User')
    .newLine()
    .style({ bold: false });
  
  encoder.text(cashierName)
    .newLines(2);

  encoder.hr('=')
    .newLines(2)
    .align('center')
    .fontSize(baseFontSize)
    .text('--- END OF REPORT ---')
    .newLines(3)
    .cut('full');

  return encoder.encode();
}

/**
 * Generate Shift Closing Receipt - Paper 2 (Item Breakdown)
 */
export function generateShiftClosingReceiptPaper2(data: ShiftClosingReportData): Uint8Array {
  const encoder = new ESCPOSEncoder();
  const baseFontSize = mapFontSize(data.fontSize);

  encoder.reset();

  // Header
  encoder.align('center')
    .style({ bold: true, doubleWidth: true })
    .text('SHIFT CLOSING REPORT')
    .newLines(2)
    .style({ bold: false, doubleWidth: false, doubleHeight: false });

  encoder.style({ bold: true })
    .text(`Shift Number: ${data.shift.shiftNumber}`)
    .newLines(1)
    .style({ bold: false });

  encoder.fontSize(baseFontSize)
    .text(`Date: ${new Date(data.shift.startTime).toLocaleDateString()}`)
    .newLine()
    .text(`Time: ${new Date(data.shift.startTime).toLocaleTimeString()} - ${new Date(data.shift.endTime).toLocaleTimeString()}`)
    .newLines(2);

  // Items Header
  encoder.hr('=')
    .newLines(1)
    .style({ bold: true })
    .text('Item                    Qty      Value')
    .newLine()
    .style({ bold: false })
    .hr('-')
    .newLines(1);

  // Category Breakdown
  data.categoryBreakdown.forEach(category => {
    // Category Header
    encoder.style({ bold: true })
      .text(category.categoryName)
      .newLine()
      .style({ bold: false });
    
    // Category Total
    encoder.align('right')
      .text(formatMoney(category.totalSales))
      .align('left')
      .newLines(1);
    
    encoder.hr('-')
      .newLines(1);

    // Items in category
    category.items.forEach(item => {
      const nameField = item.itemName.padEnd(24).substring(0, 24);
      const qtyField = item.quantity.toString().padStart(4).substring(0, 4);
      const valueField = formatMoney(item.totalPrice).padStart(10).substring(0, 10);
      
      encoder.text(`${nameField}${qtyField}${valueField}`)
        .newLine();
    });

    encoder.hr('-')
      .newLines(1);
  });

  encoder.hr('=')
    .newLines(2)
    .align('center')
    .fontSize(baseFontSize)
    .text('--- END OF REPORT ---')
    .newLines(3)
    .cut('full');

  return encoder.encode();
}


// ============================================================================
// DAY CLOSING RECEIPT FUNCTIONS
// ============================================================================

export interface DayClosingShiftData {
  shiftNumber: number;
  startTime: string;
  endTime: string;
  orderTypeBreakdown: {
    'take-away': { value: number; discounts: number; count: number; total: number };
    'dine-in': { value: number; discounts: number; count: number; total: number };
    'delivery': { value: number; discounts: number; count: number; total: number };
  };
  totals: {
    sales: number;
    discounts: number;
    deliveryFees: number;
    refunds: number;
    card: number;
    cash: number;
    openingCashBalance: number;
    expectedCash: number;
    closingCashBalance: number;
    overShort: number | null;
  };
  cashier: { name: string; username: string };
}

export interface DayClosingReportData {
  storeName: string;
  branchName: string;
  date: string;
  shifts: DayClosingShiftData[];
  categoryBreakdown: Array<{
    categoryName: string;
    totalSales: number;
    items: Array<{
      itemName: string;
      quantity: number;
      totalPrice: number;
    }>;
  }>;
  notes?: string | null;
  fontSize?: 'small' | 'medium' | 'large';
}

/**
 * Generate Day Closing Receipt - Paper 1 (Per Shift Summary)
 * Generates one receipt per shift
 */
export function generateDayClosingReceiptPaper1(shiftData: DayClosingShiftData, storeName: string, branchName: string, index: number, totalShifts: number): Uint8Array {
  const encoder = new ESCPOSEncoder();
  const baseFontSize = mapFontSize('medium');

  encoder.reset();

  // Header
  encoder.align('center')
    .style({ bold: true, doubleWidth: true })
    .text('DAY CLOSING REPORT')
    .newLines(2)
    .style({ bold: false, doubleWidth: false, doubleHeight: false });

  // User and Shift
  const cashierName = shiftData.cashier.name || shiftData.cashier.username;

  encoder.style({ bold: true })
    .text('USER')
    .newLines(1)
    .text(`Shift Totals`)
    .newLines(1)
    .style({ bold: false });

  encoder.fontSize(baseFontSize)
    .text(`${cashierName}               [Shift Number ${shiftData.shiftNumber}]`)
    .newLine()
    .text(`Time: ${new Date(shiftData.startTime).toLocaleTimeString()}               Date: ${new Date(shiftData.startTime).toLocaleDateString()}`)
    .newLines(1)
    .text(`Starting shift time : ${new Date(shiftData.startTime).toLocaleTimeString()}`)
    .newLine()
    .text(`Ending shift Time : ${new Date(shiftData.endTime).toLocaleTimeString()}`)
    .newLines(2);

  // Order Type Sections
  const orderTypes = [
    { key: 'take-away', label: 'Take Away' },
    { key: 'dine-in', label: 'Dine In' },
    { key: 'delivery', label: 'Delivery' }
  ] as const;

  orderTypes.forEach(({ key, label }) => {
    const typeData = shiftData.orderTypeBreakdown[key];
    
    encoder.hr('=')
      .newLines(1)
      .style({ bold: true })
      .text(`| ${label.padEnd(17)} Value|`)
      .newLine()
      .style({ bold: false });
    
    encoder.align('right')
      .text(formatMoney(typeData.value).padStart(20))
      .align('left')
      .newLines(1);
    
    encoder.hr('-')
      .newLines(1);
    
    encoder.style({ bold: true })
      .text(`| Discounts Value |`)
      .newLine()
      .style({ bold: false });
    
    encoder.align('right')
      .text(formatMoney(typeData.discounts).padStart(20))
      .align('left')
      .newLines(1);
    
    encoder.hr('-')
      .newLines(1);
    
    encoder.style({ bold: true })
      .text(`| Total ${label} Value|`)
      .newLine()
      .style({ bold: false });
    
    encoder.align('right')
      .text(formatMoney(typeData.total).padStart(20))
      .align('left')
      .newLines(2);
  });

  // Totals Section
  encoder.hr('=')
    .newLines(1)
    .style({ bold: true });

  const totalLines = [
    { label: 'TOTAL SALES', value: shiftData.totals.sales },
    { label: 'TOTAL DISCOUNT', value: shiftData.totals.discounts },
    { label: 'TOTAL DELIVERY FEES', value: shiftData.totals.deliveryFees },
    { label: 'TOTAL REFUND', value: shiftData.totals.refunds },
    { label: 'TOTAL CARD', value: shiftData.totals.card },
    { label: 'TOTAL CASH', value: shiftData.totals.cash },
    { label: 'OPENING CASH BALANCE', value: shiftData.totals.openingCashBalance },
    { label: 'TOTAL', value: shiftData.totals.expectedCash },
    { label: 'CLOSING CASH BALANCE', value: shiftData.totals.closingCashBalance },
    { label: 'OVER/SHORT', value: shiftData.totals.overShort || 0 }
  ];

  totalLines.forEach(line => {
    encoder.text(`| ${line.label}`)
      .newLine();
    encoder.align('right')
      .text(formatMoney(line.value).padStart(30))
      .align('left')
      .newLine();
  });

  encoder.hr('=')
    .newLines(2)
    .align('center')
    .fontSize(baseFontSize)
    .text(`--- SHIFT ${index + 1} OF ${totalShifts} ---`)
    .newLines(2)
    .text('--- END OF REPORT ---')
    .newLines(3)
    .cut('full');

  return encoder.encode();
}

/**
 * Generate Day Closing Receipt - Paper 2 (Item Summary)
 * Shows all items sold during the day
 */
export function generateDayClosingReceiptPaper2(data: DayClosingReportData): Uint8Array {
  const encoder = new ESCPOSEncoder();
  const baseFontSize = mapFontSize(data.fontSize);

  encoder.reset();

  // Header
  encoder.align('center')
    .style({ bold: true, doubleWidth: true })
    .text('DAY CLOSING REPORT')
    .newLines(2)
    .style({ bold: false, doubleWidth: false, doubleHeight: false });

  encoder.style({ bold: true })
    .text(`Date: ${data.date}`)
    .newLines(2)
    .style({ bold: false });

  // Items Header
  encoder.hr('=')
    .newLines(1)
    .style({ bold: true })
    .text('Item                    Qty      Value')
    .newLine()
    .style({ bold: false })
    .hr('-')
    .newLines(1);

  // Category Breakdown
  data.categoryBreakdown.forEach(category => {
    // Category Header
    encoder.style({ bold: true })
      .text(category.categoryName)
      .newLine()
      .style({ bold: false });
    
    // Category Total
    encoder.align('right')
      .text(formatMoney(category.totalSales))
      .align('left')
      .newLines(1);
    
    encoder.hr('-')
      .newLines(1);

    // Items in category
    category.items.forEach(item => {
      const nameField = item.itemName.padEnd(24).substring(0, 24);
      const qtyField = item.quantity.toString().padStart(4).substring(0, 4);
      const valueField = formatMoney(item.totalPrice).padStart(10).substring(0, 10);
      
      encoder.text(`${nameField}${qtyField}${valueField}`)
        .newLine();
    });

    encoder.hr('-')
      .newLines(1);
  });

  encoder.hr('=')
    .newLines(2)
    .align('center')
    .fontSize(baseFontSize)
    .text('--- END OF DAY REPORT ---')
    .newLines(3)
    .cut('full');

  return encoder.encode();
}
