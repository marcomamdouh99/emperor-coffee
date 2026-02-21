/**
 * WebUSB Thermal Printer
 * Allows printing directly to USB thermal printers from the browser
 */

export interface PrinterConfig {
  vendorId?: number;
  productId?: number;
  endpoint?: number;
}

export class WebUSBPrinter {
  private device: USBDevice | null = null;
  private endpoint: number = 0x01;
  private interfaceNumber: number = 0;

  /**
   * Check if WebUSB is supported
   */
  static isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'usb' in navigator;
  }

  /**
   * Check if the device is actually open (not just selected)
   */
  private isDeviceOpen(): boolean {
    return this.device !== null && 'opened' in this.device && this.device.opened;
  }

  /**
   * Request printer device from user
   */
  async requestDevice(config?: PrinterConfig): Promise<boolean> {
    if (!WebUSBPrinter.isSupported()) {
      throw new Error('WebUSB is not supported in this browser');
    }

    try {
      // If we already have a device, try to disconnect it first
      if (this.device) {
        console.log('Existing device found, disconnecting first...');
        try {
          await this.disconnect();
        } catch (error) {
          console.warn('Error disconnecting existing device:', error);
          // Continue anyway, we'll request a new device
        }
      }

      const filters: USBDeviceFilter[] = [];

      // Add specific vendor/product if provided
      if (config?.vendorId) {
        filters.push({
          vendorId: config.vendorId,
          productId: config.productId,
        });
      }

      // Try multiple common thermal printer vendor IDs if no specific filter
      if (filters.length === 0) {
        // Common thermal printer vendor IDs
        const thermalPrinterVendors = [
          0x0456, // EPSON
          0x04B8, // EPSON (alternate)
          0x0519, // Star Micronics
          0x0DD4, // Custom (POS)
          0x0483, // STMicroelectronics (common in thermal printers)
          0x1504, // SNBC
          0x20D1, // Xprinter
        ];

        for (const vendorId of thermalPrinterVendors) {
          filters.push({ vendorId });
        }
      }

      // If still no filters or if filters didn't work, use empty filters to show all devices
      if (filters.length === 0) {
        console.log('No specific filters, showing all USB devices');
      }

      this.device = await navigator.usb.requestDevice({
        filters: filters.length > 0 ? filters : undefined
      });

      this.endpoint = config?.endpoint || 0x01;

      console.log('Device selected:', this.device.productName, 'VID:', this.device.vendorId.toString(16).padStart(4, '0'), 'PID:', this.device.productId.toString(16).padStart(4, '0'));
      return true;
    } catch (error) {
      console.error('Failed to request device:', error);
      throw error;
    }
  }

  /**
   * Connect to the printer
   */
  async connect(): Promise<void> {
    if (!this.device) {
      throw new Error('No device selected. Call requestDevice() first.');
    }

    try {
      // Check if device is already open
      if (this.isDeviceOpen()) {
        console.log('Device is already open, proceeding with interface claiming');
      } else {
        // Device is not open, need to open it
        console.log('Opening device...');
        console.log('Device info:', {
          productName: this.device.productName,
          manufacturerName: this.device.manufacturerName,
          vendorId: '0x' + this.device.vendorId.toString(16).padStart(4, '0'),
          productId: '0x' + this.device.productId.toString(16).padStart(4, '0'),
          configurations: this.device.configurations?.length || 0,
        });

        try {
          await this.device.open();
          console.log('Device opened successfully');
        } catch (openError) {
          console.error('Failed to open device:', openError);

          // Check if this is a "device in use" error
          if (openError instanceof Error) {
            if (
              openError.name === 'SecurityError' ||
              openError.message.includes('Access denied') ||
              openError.message.includes('access denied') ||
              openError.message.includes('in use') ||
              openError.message.includes('busy')
            ) {
              throw new Error(
                `The printer "${this.device.productName}" (VID: 0x${this.device.vendorId.toString(16).padStart(4, '0')}) is already in use by your operating system.\n\n` +
                `This happens because:\n` +
                `• A printer driver is installed and loaded\n` +
                `• The OS has taken exclusive control of the USB device\n` +
                `• WebUSB cannot access devices claimed by system drivers\n\n` +
                `SOLUTIONS:\n` +
                `1. Use "Standard Print" (recommended) - Works perfectly with your thermal printer\n` +
                `2. Uninstall the printer driver and let the browser handle it\n` +
                `3. Try a different USB port (sometimes helps)\n\n` +
                `Note: "Standard Print" will still print to your thermal printer - it just uses the OS driver instead of direct USB.`
              );
            }
          }
          throw openError;
        }
      }

      // Try to find a working configuration and interface
      const configurations = this.device.configurations || [];
      console.log('Available configurations:', configurations.length);

      if (configurations.length === 0) {
        // No configurations, try to select configuration 1
        console.log('No configurations found, trying to select configuration 1');
        await this.device.selectConfiguration(1);
      }

      // Try each configuration to find one that works
      let connectedSuccessfully = false;
      let lastError: Error | null = null;

      const configsToTry = configurations.length > 0 ? configurations : [this.device.configuration];

      for (let configIndex = 0; configIndex < configsToTry.length; configIndex++) {
        const config = configsToTry[configIndex];
        if (!config) continue;

        console.log(`Trying configuration ${configIndex}, interfaces: ${config.interfaces.length}`);

        for (let ifaceIndex = 0; ifaceIndex < config.interfaces.length; ifaceIndex++) {
          const iface = config.interfaces[ifaceIndex];
          console.log(`  Trying interface ${ifaceIndex}, alternates: ${iface.alternates.length}`);

          for (let altIndex = 0; altIndex < iface.alternates.length; altIndex++) {
            const alternate = iface.alternates[altIndex];

            // Find an OUT endpoint
            const outEndpoint = alternate.endpoints.find(ep => ep.direction === 'out');
            if (!outEndpoint) continue;

            console.log(`    Found OUT endpoint: ${outEndpoint.endpointNumber.toString(16)}`);

            try {
              // Select this configuration if needed
              if (configurations.length > 0) {
                await this.device.selectConfiguration(config.configurationValue);
              }

              // Claim this interface
              await this.device.claimInterface(ifaceIndex);

              // Set the endpoint
              this.endpoint = outEndpoint.endpointNumber;
              this.interfaceNumber = ifaceIndex;

              console.log(`Successfully connected! Interface: ${ifaceIndex}, Endpoint: ${this.endpoint.toString(16)}`);
              connectedSuccessfully = true;
              break;
            } catch (error) {
              console.warn(`    Failed to claim interface ${ifaceIndex}:`, error);
              lastError = error as Error;
              continue;
            }
          }

          if (connectedSuccessfully) break;
        }

        if (connectedSuccessfully) break;
      }

      if (!connectedSuccessfully) {
        throw lastError || new Error('Could not find a suitable interface to connect to the printer');
      }
    } catch (error) {
      console.error('Failed to connect to printer:', error);

      // If we get a SecurityError or AccessDeniedError, provide more helpful message
      if (error instanceof Error) {
        if (error.name === 'SecurityError' || error.message.includes('Access denied') || error.message.includes('access denied')) {
          throw new Error(
            'Access denied to USB device. This usually means:\n\n' +
            '1. The device is already in use by another application\n' +
            '2. The operating system has claimed the device\n' +
            '3. You may need to unplug and replug the printer\n\n' +
            'Tip: Use "Standard Print" instead, which works with any printer.'
          );
        }
      }

      throw error;
    }
  }

  /**
   * Disconnect from the printer
   */
  async disconnect(): Promise<void> {
    if (this.device) {
      try {
        await this.device.close();
        this.device = null;
      } catch (error) {
        console.error('Error disconnecting:', error);
      }
    }
  }

  /**
   * Print data to the printer
   * @param data Uint8Array of ESC/POS commands
   */
  async print(data: Uint8Array): Promise<void> {
    if (!this.device) {
      throw new Error('Not connected to printer');
    }

    try {
      // Send data in chunks (max packet size is typically 64 bytes for USB 1.1)
      const CHUNK_SIZE = 64;
      for (let i = 0; i < data.length; i += CHUNK_SIZE) {
        const chunk = data.slice(i, i + CHUNK_SIZE);
        await this.device.transferOut(this.endpoint, chunk);
      }

      console.log(`Printed ${data.length} bytes`);
    } catch (error) {
      console.error('Failed to print:', error);
      throw error;
    }
  }

  /**
   * Print from base64 encoded data
   */
  async printBase64(base64Data: string): Promise<void> {
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    await this.print(bytes);
  }

  /**
   * Get connected device info
   */
  getDeviceInfo(): { productName: string; manufacturerName: string } | null {
    if (!this.device) return null;
    return {
      productName: this.device.productName,
      manufacturerName: this.device.manufacturerName,
    };
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.isDeviceOpen();
  }
}

/**
 * Global printer instance (singleton pattern)
 */
let globalPrinter: WebUSBPrinter | null = null;

export function getPrinter(): WebUSBPrinter {
  if (!globalPrinter) {
    globalPrinter = new WebUSBPrinter();
  }
  return globalPrinter;
}

/**
 * Print a receipt from order ID
 */
export async function printReceipt(orderId: string): Promise<void> {
  const printer = getPrinter();

  // Fetch ESC/POS receipt data
  const response = await fetch(`/api/orders/orderId/receipt/escpos?orderId=${orderId}`);
  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Failed to fetch receipt');
  }

  // Print the receipt
  await printer.printBase64(data.escposData);
}
