/**
 * Data export utilities
 * Supports CSV, Excel, and PDF export formats
 */

import { type } from 'os';

export interface ExportData {
  headers: string[];
  data: Record<string, any>[];
  filename?: string;
}

/**
 * Export data to CSV format
 */
export function exportToCSV(exportData: ExportData): void {
  const { headers, data, filename = 'export.csv' } = exportData;

  // Create CSV content
  const csvContent = [
    headers.join(','),
    ...data.map(row =>
      headers.map(header => {
        const value = row[header] ?? '';
        // Escape quotes and commas
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      }).join(',')
    ),
  ].join('\n');

  // Create and download file
  downloadFile(csvContent, filename, 'text/csv;charset=utf-8');
}

/**
 * Export data to Excel format
 */
export async function exportToExcel(exportData: ExportData): Promise<void> {
  const { headers, data, filename = 'export.xlsx' } = exportData;

  // Create HTML table for Excel
  const tableRows = [
    `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`,
    ...data.map(row =>
      `<tr>${headers.map(h => `<td>${row[h] ?? ''}</td>`).join('')}</tr>`
    ),
  ];

  const htmlContent = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:x="urn:schemas-microsoft-com:office:excel">
      <head>
        <meta charset="utf-8" />
        <style>
          table { border-collapse: collapse; }
          td, th { border: 1px solid #ccc; padding: 8px; }
          th { background-color: #4CAF50; color: white; font-weight: bold; }
        </style>
      </head>
      <body>
        <table>${tableRows.join('')}</table>
      </body>
    </html>
  `;

  downloadFile(htmlContent, filename, 'application/vnd.ms-excel');
}

/**
 * Export data to PDF format (basic text-based PDF)
 */
export function exportToPDF(exportData: ExportData): void {
  const { headers, data, filename = 'export.pdf' } = exportData;

  // Simple text-based PDF (for more advanced PDF, use a library like jsPDF)
  let pdfContent = 'Data Export Report\n';
  pdfContent += '='.repeat(80) + '\n\n';
  pdfContent += `Generated: ${new Date().toLocaleString()}\n\n`;
  pdfContent += '='.repeat(80) + '\n\n';

  // Table header
  pdfContent += headers.join(' | ').padEnd(headers.join(' | ').length + 20) + '\n';
  pdfContent += '-'.repeat(headers.join(' | ').length + 20) + '\n\n';

  // Table data
  data.forEach(row => {
    const row = headers.map(h => String(row[h] ?? 'N/A')).join(' | ');
    pdfContent += row.padEnd(headers.join(' | ').length + 20) + '\n';
  });

  pdfContent += '\n\n' + '='.repeat(80) + '\n';
  pdfContent += `Total Records: ${data.length}\n`;

  downloadFile(pdfContent, filename, 'text/plain;charset=utf-8');
}

/**
 * Generic download file helper
 */
function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export orders data
 */
export function exportOrders(orders: any[], format: 'csv' | 'excel' | 'pdf' = 'csv'): void {
  const exportData: ExportData = {
    headers: [
      'Order ID',
      'Order Number',
      'Date',
      'Total Amount',
      'Payment Method',
      'Order Type',
      'Cashier',
      'Items Count',
    ],
    data: orders.map(order => ({
      'Order ID': order.id,
      'Order Number': order.orderNumber,
      'Date': new Date(order.orderTimestamp || order.createdAt).toLocaleString(),
      'Total Amount': order.totalAmount?.toFixed(2),
      'Payment Method': order.paymentMethod,
      'Order Type': order.orderType,
      'Cashier': order.cashier?.name || 'N/A',
      'Items Count': order.items?.length || 0,
    })),
    filename: `orders_${new Date().toISOString().split('T')[0]}.${format}`,
  };

  switch (format) {
    case 'csv':
      exportToCSV(exportData);
      break;
    case 'excel':
      exportToExcel(exportData);
      break;
    case 'pdf':
      exportToPDF(exportData);
      break;
  }
}

/**
 * Export inventory data
 */
export function exportInventory(inventory: any[], format: 'csv' | 'excel' | 'pdf' = 'csv'): void {
  const exportData: ExportData = {
    headers: [
      'Branch',
      'Ingredient',
      'Current Stock',
      'Reorder Threshold',
      'Unit',
      'Cost Per Unit',
      'Total Value',
      'Status',
    ],
    data: inventory.map(item => ({
      'Branch': item.branch?.branchName || 'N/A',
      'Ingredient': item.ingredient?.name || 'N/A',
      'Current Stock': item.currentStock,
      'Reorder Threshold': item.ingredient?.reorderThreshold || 0,
      'Unit': item.unit || item.ingredient?.unit || 'N/A',
      'Cost Per Unit': item.ingredient?.costPerUnit?.toFixed(2) || '0.00',
      'Total Value': (item.currentStock * (item.ingredient?.costPerUnit || 0)).toFixed(2),
      'Status': item.currentStock < (item.ingredient?.reorderThreshold || 0) ? 'Low Stock' : 'OK',
    })),
    filename: `inventory_${new Date().toISOString().split('T')[0]}.${format}`,
  };

  switch (format) {
    case 'csv':
      exportToCSV(exportData);
      break;
    case 'excel':
      exportToExcel(exportData);
      break;
    case 'pdf':
      exportToPDF(exportData);
      break;
  }
}

/**
 * Export customer data
 */
export function exportCustomers(customers: any[], format: 'csv' | 'excel' | 'pdf' = 'csv'): void {
  const exportData: ExportData = {
    headers: [
      'Customer ID',
      'Name',
      'Phone',
      'Email',
      'Address',
      'Total Orders',
      'Total Spent',
      'Status',
    ],
    data: customers.map(customer => ({
      'Customer ID': customer.id,
      'Name': customer.name,
      'Phone': customer.phone,
      'Email': customer.email || 'N/A',
      'Address': customer.address || 'N/A',
      'Total Orders': customer.orderCount || 0,
      'Total Spent': customer.totalSpent?.toFixed(2) || '0.00',
      'Status': customer.isActive ? 'Active' : 'Inactive',
    })),
    filename: `customers_${new Date().toISOString().split('T')[0]}.${format}`,
  };

  switch (format) {
    case 'csv':
      exportToCSV(exportData);
      break;
    case 'excel':
      exportToExcel(exportData);
      break;
    case 'pdf':
      exportToPDF(exportData);
      break;
  }
}
