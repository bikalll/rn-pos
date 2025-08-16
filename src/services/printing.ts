import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

export interface PrintOptions {
  type: 'receipt' | 'ticket' | 'report' | 'invoice';
  title: string;
  content: any;
  printerName?: string;
  copies?: number;
}

export interface ReceiptData {
  receiptId: string;
  date: string;
  time: string;
  tableNumber: string;
  customerName: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    total: number;
  }>;
  subtotal: number;
  tax: number;
  serviceCharge: number;
  discount: number;
  total: number;
  paymentMethod: string;
  cashier: string;
}

export interface TicketData {
  ticketId: string;
  date: string;
  time: string;
  tableNumber: string;
  orderType: 'KOT' | 'BOT' | 'COMBINED';
  estimatedTime: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    orderType: 'KOT' | 'BOT';
    specialInstructions?: string;
  }>;
  specialInstructions?: string;
}

export interface KOTData {
  ticketId: string;
  date: string;
  time: string;
  table: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    orderType: 'KOT';
    specialInstructions?: string;
  }>;
  estimatedTime: string;
  specialInstructions?: string;
}

export interface BOTData {
  ticketId: string;
  date: string;
  time: string;
  table: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    orderType: 'BOT';
    specialInstructions?: string;
  }>;
  estimatedTime: string;
  specialInstructions?: string;
}

export interface ReportData {
  title: string;
  date: string;
  data: any;
  summary: {
    totalOrders: number;
    totalRevenue: number;
    totalItems: number;
  };
}

// Generate HTML for receipts
export function generateReceiptHTML(receipt: ReceiptData): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Receipt - ${receipt.receiptId}</title>
      <style>
        body {
          font-family: 'Courier New', monospace;
          font-size: 12px;
          line-height: 1.2;
          margin: 0;
          padding: 10px;
          background: white;
        }
        .header {
          text-align: center;
          border-bottom: 1px solid #000;
          padding-bottom: 10px;
          margin-bottom: 15px;
        }
        .logo {
          font-size: 18px;
          font-weight: bold;
          margin-bottom: 5px;
        }
        .receipt-info {
          margin-bottom: 15px;
        }
        .items-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 15px;
        }
        .items-table th,
        .items-table td {
          text-align: left;
          padding: 3px 0;
          border-bottom: 1px dotted #ccc;
        }
        .items-table th {
          border-bottom: 1px solid #000;
        }
        .totals {
          border-top: 1px solid #000;
          padding-top: 10px;
        }
        .total-row {
          display: flex;
          justify-content: space-between;
          margin: 2px 0;
        }
        .footer {
          text-align: center;
          margin-top: 20px;
          font-size: 10px;
          color: #666;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo">ARBI POS</div>
        <div>Restaurant Management System</div>
        <div>${receipt.date} - ${receipt.time}</div>
      </div>
      
      <div class="receipt-info">
        <div><strong>Receipt:</strong> ${receipt.receiptId}</div>
        <div><strong>Table:</strong> ${receipt.tableNumber}</div>
        <div><strong>Customer:</strong> ${receipt.customerName}</div>
        <div><strong>Cashier:</strong> ${receipt.cashier}</div>
      </div>
      
      <table class="items-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Qty</th>
            <th>Price</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          ${receipt.items.map(item => `
            <tr>
              <td>${item.name}</td>
              <td>${item.quantity}</td>
              <td>Rs ${item.price.toFixed(2)}</td>
              <td>Rs ${item.total.toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      
      <div class="totals">
        <div class="total-row">
          <span>Subtotal:</span>
          <span>Rs ${receipt.subtotal.toFixed(2)}</span>
        </div>
        <div class="total-row">
          <span>Tax (${((receipt.tax / receipt.subtotal) * 100).toFixed(1)}%):</span>
          <span>Rs ${receipt.tax.toFixed(2)}</span>
        </div>
        <div class="total-row">
          <span>Service Charge:</span>
          <span>Rs ${receipt.serviceCharge.toFixed(2)}</span>
        </div>
        <div class="total-row">
          <span>Discount:</span>
          <span>-Rs ${receipt.discount.toFixed(2)}</span>
        </div>
        <div class="total-row" style="font-weight: bold; font-size: 14px;">
          <span>TOTAL:</span>
          <span>Rs ${receipt.total.toFixed(2)}</span>
        </div>
        <div class="total-row">
          <span>Payment Method:</span>
          <span>${receipt.paymentMethod}</span>
        </div>
      </div>
      
      <div class="footer">
        Thank you for dining with us!<br>
        Please visit again
      </div>
    </body>
    </html>
  `;
}

// Generate HTML for kitchen tickets
export function generateTicketHTML(ticket: TicketData): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Kitchen Ticket - ${ticket.ticketId}</title>
      <style>
        body {
          font-family: 'Courier New', monospace;
          font-size: 14px;
          line-height: 1.3;
          margin: 0;
          padding: 15px;
          background: white;
        }
        .header {
          text-align: center;
          border: 2px solid #000;
          padding: 10px;
          margin-bottom: 20px;
          background: #f0f0f0;
        }
        .ticket-id {
          font-size: 18px;
          font-weight: bold;
          margin-bottom: 5px;
        }
        .order-info {
          margin-bottom: 20px;
        }
        .items-list {
          margin-bottom: 20px;
        }
        .item {
          padding: 8px 0;
          border-bottom: 1px solid #ccc;
        }
        .item-name {
          font-weight: bold;
          margin-bottom: 3px;
        }
        .item-quantity {
          color: #666;
        }
        .special-instructions {
          font-style: italic;
          color: #e74c3c;
          margin-top: 3px;
        }
        .footer {
          text-align: center;
          margin-top: 20px;
          padding: 10px;
          border: 1px solid #000;
          background: #f0f0f0;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="ticket-id">KITCHEN TICKET</div>
        <div>${ticket.date} - ${ticket.time}</div>
        <div>Table ${ticket.tableNumber} | ${ticket.orderType.toUpperCase()}</div>
      </div>
      
      <div class="order-info">
        <div><strong>Ticket ID:</strong> ${ticket.ticketId}</div>
        <div><strong>Estimated Time:</strong> ${ticket.estimatedTime}</div>
      </div>
      
      <div class="items-list">
        <h3>ORDER ITEMS:</h3>
        ${ticket.items.map(item => `
          <div class="item">
            <div class="item-name">${item.quantity}x ${item.name}</div>
            ${item.specialInstructions ? `<div class="special-instructions">${item.specialInstructions}</div>` : ''}
          </div>
        `).join('')}
      </div>
      
      <div class="footer">
        <strong>PLEASE PREPARE WITH CARE</strong><br>
        ${new Date().toLocaleTimeString()}
      </div>
    </body>
    </html>
  `;
}

// Generate HTML for reports
export function generateReportHTML(report: ReportData): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${report.title}</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          font-size: 12px;
          line-height: 1.4;
          margin: 0;
          padding: 20px;
          background: white;
        }
        .header {
          text-align: center;
          border-bottom: 2px solid #333;
          padding-bottom: 15px;
          margin-bottom: 20px;
        }
        .title {
          font-size: 24px;
          font-weight: bold;
          margin-bottom: 5px;
        }
        .date {
          font-size: 16px;
          color: #666;
        }
        .summary {
          display: flex;
          justify-content: space-around;
          margin-bottom: 30px;
          padding: 15px;
          background: #f8f9fa;
          border-radius: 8px;
        }
        .summary-item {
          text-align: center;
        }
        .summary-value {
          font-size: 24px;
          font-weight: bold;
          color: #333;
        }
        .summary-label {
          font-size: 12px;
          color: #666;
          margin-top: 5px;
        }
        .data-section {
          margin-bottom: 25px;
        }
        .section-title {
          font-size: 18px;
          font-weight: bold;
          margin-bottom: 10px;
          border-bottom: 1px solid #ddd;
          padding-bottom: 5px;
        }
        .data-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 15px;
        }
        .data-table th,
        .data-table td {
          border: 1px solid #ddd;
          padding: 8px;
          text-align: left;
        }
        .data-table th {
          background: #f8f9fa;
          font-weight: bold;
        }
        .footer {
          text-align: center;
          margin-top: 30px;
          padding-top: 15px;
          border-top: 1px solid #ddd;
          color: #666;
          font-size: 10px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="title">${report.title}</div>
        <div class="date">${report.date}</div>
        <div>Generated by Arbi POS System</div>
      </div>
      
      <div class="summary">
        <div class="summary-item">
          <div class="summary-value">${report.summary.totalOrders}</div>
          <div class="summary-label">Total Orders</div>
        </div>
        <div class="summary-item">
          <div class="summary-value">Rs ${report.summary.totalRevenue.toFixed(2)}</div>
          <div class="summary-label">Total Revenue</div>
        </div>
        <div class="summary-item">
          <div class="summary-value">${report.summary.totalItems}</div>
          <div class="summary-label">Items Sold</div>
        </div>
      </div>
      
      <div class="data-section">
        <div class="section-title">Detailed Data</div>
        <table class="data-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Quantity</th>
              <th>Revenue</th>
            </tr>
          </thead>
          <tbody>
            ${Object.entries(report.data).map(([key, value]: [string, any]) => `
              <tr>
                <td>${key}</td>
                <td>${value.quantity || 0}</td>
                <td>Rs ${(value.revenue || 0).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      
      <div class="footer">
        Report generated on ${new Date().toLocaleString()}<br>
        Arbi POS - Restaurant Management System
      </div>
    </body>
    </html>
  `;
}

// Main print function
export async function printDocument(options: PrintOptions): Promise<string> {
  let html = '';
  
  switch (options.type) {
    case 'receipt':
      html = generateReceiptHTML(options.content);
      break;
    case 'ticket':
      html = generateTicketHTML(options.content);
      break;
    case 'report':
      html = generateReportHTML(options.content);
      break;
    case 'invoice':
      html = generateReceiptHTML(options.content); // Use receipt format for invoices
      break;
    default:
      throw new Error(`Unsupported print type: ${options.type}`);
  }

  try {
    // Print to file
    const { uri } = await Print.printToFileAsync({ 
      html,
      base64: false
    });

    // If sharing is available, share the file
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Print ${options.title}`,
      });
    }

    return uri;
  } catch (error) {
    console.error('Print error:', error);
    throw new Error(`Failed to print ${options.type}: ${error}`);
  }
}

// Quick print functions for common use cases
export async function printReceipt(receiptData: ReceiptData): Promise<string> {
  return printDocument({
    type: 'receipt',
    title: 'Receipt',
    content: receiptData,
  });
}

export async function printKitchenTicket(ticketData: KOTData): Promise<string> {
  return printDocument({
    type: 'ticket',
    title: 'Kitchen Ticket (KOT)',
    content: {
      ...ticketData,
      orderType: 'KOT',
      tableNumber: ticketData.table,
    },
  });
}

export async function printBarTicket(ticketData: BOTData): Promise<string> {
  return printDocument({
    type: 'ticket',
    title: 'Bar Ticket (BOT)',
    content: {
      ...ticketData,
      orderType: 'BOT',
      tableNumber: ticketData.table,
    },
  });
}

export async function printCombinedTickets(kotData: KOTData, botData: BOTData): Promise<string[]> {
  const results: string[] = [];
  
  if (kotData.items.length > 0) {
    results.push(await printKitchenTicket(kotData));
  }
  
  if (botData.items.length > 0) {
    results.push(await printBarTicket(botData));
  }
  
  return results;
}

export async function printReport(reportData: ReportData): Promise<string> {
  return printDocument({
    type: 'report',
    title: 'Report',
    content: reportData,
  });
}

// Legacy function for backward compatibility
export async function printHtmlAsync(html: string) {
  // On real devices, integrate with Bluetooth/USB printers via native modules.
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri);
  }
  return uri;
}

// Comprehensive printing utility for the entire app
export class PrintService {
  static async checkPrinterConnection(): Promise<{ connected: boolean; message: string }> {
    try {
      // Check if Bluetooth printing is supported
      const { blePrinter } = await import('./blePrinter');
      
      if (!blePrinter.isSupported()) {
        return {
          connected: false,
          message: 'Bluetooth printing not supported on this device'
        };
      }

      // Check if Bluetooth is enabled
      const isEnabled = await blePrinter.isEnabled();
      if (!isEnabled) {
        return {
          connected: false,
          message: 'Bluetooth is not enabled. Please enable Bluetooth to print.'
        };
      }

      return {
        connected: true,
        message: 'Printer connection available'
      };
    } catch (error) {
      return {
        connected: false,
        message: 'Unable to check printer connection'
      };
    }
  }

  static async printKOTFromOrder(order: any, table: any): Promise<{ success: boolean; message: string }> {
    try {
      const { blePrinter } = await import('./blePrinter');
      
      // Check printer connection
      const connectionStatus = await this.checkPrinterConnection();
      if (!connectionStatus.connected) {
        return {
          success: false,
          message: 'No printer connected. Please connect a printer to print KOT tickets.'
        };
      }

      // Print via Bluetooth
      await blePrinter.printKOT({
        restaurantName: 'ARBI POS',
        ticketId: `KOT-${Date.now()}`,
        date: new Date(order.createdAt).toLocaleDateString(),
        time: new Date(order.createdAt).toLocaleTimeString(),
        table: table?.name || order.tableId,
        items: order.items
          .filter((item: any) => item.orderType === 'KOT')
          .map((item: any) => ({
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            orderType: item.orderType
          })),
        estimatedTime: '20-30 minutes',
        specialInstructions: order.specialInstructions
      });

      return {
        success: true,
        message: 'Kitchen ticket (KOT) sent to printer successfully'
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to print KOT: ${error.message}`
      };
    }
  }

  static async printBOTFromOrder(order: any, table: any): Promise<{ success: boolean; message: string }> {
    try {
      const { blePrinter } = await import('./blePrinter');
      
      // Check printer connection
      const connectionStatus = await this.checkPrinterConnection();
      if (!connectionStatus.connected) {
        return {
          success: false,
          message: 'No printer connected. Please connect a printer to print BOT tickets.'
        };
      }

      // Print via Bluetooth
      await blePrinter.printBOT({
        restaurantName: 'ARBI POS',
        ticketId: `BOT-${Date.now()}`,
        date: new Date(order.createdAt).toLocaleDateString(),
        time: new Date(order.createdAt).toLocaleTimeString(),
        table: table?.name || order.tableId,
        items: order.items
          .filter((item: any) => item.orderType === 'BOT')
          .map((item: any) => ({
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            orderType: item.orderType
          })),
        estimatedTime: '5-10 minutes',
        specialInstructions: order.specialInstructions
      });

      return {
        success: true,
        message: 'Bar ticket (BOT) sent to printer successfully'
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to print BOT: ${error.message}`
      };
    }
  }

  static async printCombinedTicketsFromOrder(order: any, table: any): Promise<{ success: boolean; message: string }> {
    try {
      console.log('🖨️ PrintService: Processing order for combined tickets:', {
        orderId: order.id,
        totalItems: order.items.length,
        items: order.items.map((item: any) => ({ 
          name: item.name, 
          orderType: item.orderType, 
          quantity: item.quantity 
        }))
      });

      const { blePrinter } = await import('./blePrinter');
      
      // Check printer connection
      const connectionStatus = await this.checkPrinterConnection();
      if (!connectionStatus.connected) {
        return {
          success: false,
          message: 'No printer connected. Please connect a printer to print KOT/BOT tickets.'
        };
      }

      // Print via Bluetooth
      await blePrinter.printCombinedTickets({
        restaurantName: 'ARBI POS',
        ticketId: `TKT-${Date.now()}`,
        date: new Date(order.createdAt).toLocaleDateString(),
        time: new Date(order.createdAt).toLocaleTimeString(),
        table: table?.name || order.tableId,
        items: order.items.map((item: any) => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          orderType: item.orderType
        })),
        estimatedTime: '20-30 minutes',
        specialInstructions: order.specialInstructions
      });

      return {
        success: true,
        message: 'Combined tickets sent to printer successfully'
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to print tickets: ${error.message}`
      };
    }
  }
}
