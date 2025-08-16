import { Alert, PermissionsAndroid, Platform } from 'react-native';
import { blePrinter } from './blePrinter';

export interface BluetoothDevice {
  address: string;
  name: string;
  paired: boolean;
  connected?: boolean;
  rssi?: number;
}

export interface BluetoothStatus {
  enabled: boolean;
  scanning: boolean;
  connected: boolean;
  currentDevice?: BluetoothDevice;
  error?: string;
}

class BluetoothManager {
  private status: BluetoothStatus = {
    enabled: false,
    scanning: false,
    connected: false,
  };

  private devices: BluetoothDevice[] = [];
  private connectionTimeout: NodeJS.Timeout | null = null;

  // Get current status
  getStatus(): BluetoothStatus {
    return { ...this.status };
  }

  // Get all discovered devices
  getDevices(): BluetoothDevice[] {
    return [...this.devices];
  }

  // Check if Bluetooth is supported and available
  async isSupported(): Promise<boolean> {
    return blePrinter.isSupported();
  }

  // Request all necessary permissions
  async requestPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;
    
    try {
      const permissions = [
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN as any,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT as any,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
      ];

      const results = await PermissionsAndroid.requestMultiple(permissions);
      
      const allGranted = Object.values(results).every(
        result => result === PermissionsAndroid.RESULTS.GRANTED
      );

      if (!allGranted) {
        Alert.alert(
          'Permissions Required',
          'Bluetooth and Location permissions are required for printer functionality.',
          [{ text: 'OK' }]
        );
      }

      return allGranted;
    } catch (error) {
      console.error('Permission request failed:', error);
      return false;
    }
  }

  // Check if Bluetooth is enabled
  async checkBluetoothStatus(): Promise<boolean> {
    try {
      const enabled = await blePrinter.isEnabled();
      this.status.enabled = enabled;
      
      if (!enabled) {
        this.status.error = 'Bluetooth is disabled';
      } else {
        this.status.error = undefined;
      }
      
      return enabled;
    } catch (error) {
      this.status.enabled = false;
      this.status.error = 'Failed to check Bluetooth status';
      return false;
    }
  }

  // Enable Bluetooth
  async enableBluetooth(): Promise<boolean> {
    try {
      const success = await blePrinter.enableBluetooth();
      if (success) {
        this.status.enabled = true;
        this.status.error = undefined;
      }
      return success;
    } catch (error) {
      this.status.error = 'Failed to enable Bluetooth';
      return false;
    }
  }

  // Scan for Bluetooth devices
  async scanDevices(): Promise<BluetoothDevice[]> {
    if (!this.status.enabled) {
      const enabled = await this.checkBluetoothStatus();
      if (!enabled) {
        throw new Error('Bluetooth is not enabled');
      }
    }

    const hasPermissions = await this.requestPermissions();
    if (!hasPermissions) {
      throw new Error('Required permissions not granted');
    }

    this.status.scanning = true;
    this.status.error = undefined;

    try {
      const result = await blePrinter.scanDevices();
      
      // Process paired devices
      const pairedDevices = (result.paired || []).map((device: any) => ({
        address: device.address || device.Address,
        name: device.name || device.Name || 'Unknown Device',
        paired: true,
        rssi: device.rssi || device.RSSI,
      }));

      // Process found devices
      const foundDevices = (result.found || []).map((device: any) => ({
        address: device.address || device.Address,
        name: device.name || device.Name || 'Unknown Device',
        paired: false,
        rssi: device.rssi || device.RSSI,
      }));

      // Merge and deduplicate devices
      const allDevices = [...pairedDevices, ...foundDevices];
      this.devices = allDevices.filter((device, index, self) => 
        index === self.findIndex(d => d.address === device.address)
      );

      return this.devices;
    } catch (error) {
      this.status.error = 'Failed to scan for devices';
      throw error;
    } finally {
      this.status.scanning = false;
    }
  }

  // Connect to a Bluetooth device
  async connectToDevice(device: BluetoothDevice): Promise<boolean> {
    if (!this.status.enabled) {
      throw new Error('Bluetooth is not enabled');
    }

    try {
      this.status.error = undefined;
      
      // Disconnect from current device if connected
      if (this.status.connected && this.status.currentDevice) {
        await this.disconnect();
      }

      // Set connection timeout
      const connectionPromise = new Promise<boolean>((resolve, reject) => {
        this.connectionTimeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 10000); // 10 second timeout

        blePrinter.connect(device.address)
          .then(() => {
            if (this.connectionTimeout) {
              clearTimeout(this.connectionTimeout);
              this.connectionTimeout = null;
            }
            resolve(true);
          })
          .catch(reject);
      });

      const connected = await connectionPromise;
      
      if (connected) {
        this.status.connected = true;
        this.status.currentDevice = { ...device, connected: true };
        
        // Update device in list
        const deviceIndex = this.devices.findIndex(d => d.address === device.address);
        if (deviceIndex !== -1) {
          this.devices[deviceIndex].connected = true;
        }
      }

      return connected;
    } catch (error) {
      this.status.error = `Failed to connect: ${error}`;
      this.status.connected = false;
      this.status.currentDevice = undefined;
      throw error;
    }
  }

  // Disconnect from current device
  async disconnect(): Promise<void> {
    try {
      await blePrinter.disconnect();
    } catch (error) {
      console.warn('Error during disconnect:', error);
    } finally {
      this.status.connected = false;
      this.status.currentDevice = undefined;
      
      // Update device in list
      this.devices.forEach(device => {
        device.connected = false;
      });

      if (this.connectionTimeout) {
        clearTimeout(this.connectionTimeout);
        this.connectionTimeout = null;
      }
    }
  }

  // Print text to connected device
  async printText(text: string): Promise<void> {
    if (!this.status.connected) {
      throw new Error('No device connected');
    }

    try {
      await blePrinter.printText(text);
    } catch (error) {
      this.status.error = `Print failed: ${error}`;
      throw error;
    }
  }

  // Print receipt to connected device
  async printReceipt(receiptData: any): Promise<void> {
    if (!this.status.connected) {
      throw new Error('No device connected');
    }

    try {
      await blePrinter.printReceipt(receiptData);
    } catch (error) {
      this.status.error = `Receipt print failed: ${error}`;
      throw error;
    }
  }

  // Test connection
  async testConnection(): Promise<boolean> {
    if (!this.status.connected) {
      return false;
    }

    try {
      await blePrinter.printText('Test Print\n');
      return true;
    } catch (error) {
      this.status.error = `Connection test failed: ${error}`;
      return false;
    }
  }

  // Get module status
  getModuleStatus() {
    return blePrinter.getModuleStatus();
  }

  // Clear error
  clearError(): void {
    this.status.error = undefined;
  }

  // Reset manager state
  reset(): void {
    this.status = {
      enabled: false,
      scanning: false,
      connected: false,
    };
    this.devices = [];
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
  }
}

// Export singleton instance
export const bluetoothManager = new BluetoothManager();

