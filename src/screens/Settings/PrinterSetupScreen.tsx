import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  Switch,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { bluetoothManager, BluetoothDevice, BluetoothStatus } from '../../services/bluetoothManager';
import { Toast } from '../../services/toastService';
import PrinterTroubleshooter from '../../components/PrinterTroubleshooter';

interface PrinterSetupScreenProps {
  navigation: any;
}

export default function PrinterSetupScreen({ navigation }: PrinterSetupScreenProps) {
  const [status, setStatus] = useState<BluetoothStatus>({
    enabled: false,
    scanning: false,
    connected: false,
  });
  const [devices, setDevices] = useState<BluetoothDevice[]>([]);
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [moduleStatus, setModuleStatus] = useState<any>(null);
  const [autoConnect, setAutoConnect] = useState<boolean>(false);
  const [permissionsGranted, setPermissionsGranted] = useState<boolean>(false);
  const [showTroubleshooter, setShowTroubleshooter] = useState<boolean>(false);

  useEffect(() => {
    initializeBluetooth();
  }, []);

  const initializeBluetooth = async () => {
    try {
      // Check if Bluetooth is supported
      const supported = await bluetoothManager.isSupported();
      setIsSupported(supported);

      if (!supported) {
        const moduleStatus = bluetoothManager.getModuleStatus();
        setModuleStatus(moduleStatus);
        Toast.show('Bluetooth printing module not available', 'error');
        return;
      }

      // Check current permissions status
      const permissionsGranted = await bluetoothManager.requestPermissions();
      setPermissionsGranted(permissionsGranted);
      
      if (!permissionsGranted) {
        Toast.show('Bluetooth permissions are required for printer functionality', 'error');
        return;
      }

      // Check Bluetooth status
      await updateStatus();
    } catch (error) {
      console.error('Bluetooth initialization failed:', error);
      Toast.show('Failed to initialize Bluetooth', 'error');
    }
  };

  const requestBluetoothPermissions = async (): Promise<boolean> => {
    try {
      const permissionsGranted = await bluetoothManager.requestPermissions();
      setPermissionsGranted(permissionsGranted);
      if (!permissionsGranted) {
        Alert.alert(
          'Permissions Required',
          'Bluetooth and Location permissions are required for printer functionality. Please grant all permissions in settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => {
              // You can add navigation to settings here if needed
              Toast.show('Please enable permissions in device settings', 'info');
            }}
          ]
        );
      }
      return permissionsGranted;
    } catch (error) {
      console.error('Permission request failed:', error);
      Toast.show('Failed to request permissions', 'error');
      setPermissionsGranted(false);
      return false;
    }
  };

  const updateStatus = async () => {
    const currentStatus = bluetoothManager.getStatus();
    setStatus(currentStatus);
  };

  const handleEnableBluetooth = async () => {
    try {
      if (!permissionsGranted) {
        Toast.show('Bluetooth permissions required. Please request permissions first.', 'error');
        return;
      }
      
      const success = await bluetoothManager.enableBluetooth();
      if (success) {
        Toast.show('Bluetooth enabled successfully', 'success');
        await updateStatus();
      } else {
        Toast.show('Failed to enable Bluetooth', 'error');
      }
    } catch (error) {
      Toast.show('Error enabling Bluetooth', 'error');
    }
  };

  const handleScanDevices = async () => {
    try {
      if (!permissionsGranted) {
        Toast.show('Bluetooth permissions required. Please request permissions first.', 'error');
        return;
      }
      
      setStatus(prev => ({ ...prev, scanning: true }));
      const discoveredDevices = await bluetoothManager.scanDevices();
      setDevices(discoveredDevices);
      Toast.show(`Found ${discoveredDevices.length} devices`, 'success');
    } catch (error) {
      Toast.show('Failed to scan for devices', 'error');
    } finally {
      setStatus(prev => ({ ...prev, scanning: false }));
      await updateStatus();
    }
  };

  const handleConnectDevice = async (device: BluetoothDevice) => {
    try {
      if (!permissionsGranted) {
        Toast.show('Bluetooth permissions required. Please request permissions first.', 'error');
        return;
      }
      
      const connected = await bluetoothManager.connectToDevice(device);
      if (connected) {
        Toast.show(`Connected to ${device.name}`, 'success');
        await updateStatus();
      } else {
        Toast.show('Failed to connect to device', 'error');
      }
    } catch (error) {
      Toast.show(`Connection failed: ${error}`, 'error');
    }
  };

  const handleDisconnect = async () => {
    try {
      if (!permissionsGranted) {
        Toast.show('Bluetooth permissions required. Please request permissions first.', 'error');
        return;
      }
      
      await bluetoothManager.disconnect();
      Toast.show('Disconnected from printer', 'success');
      await updateStatus();
    } catch (error) {
      Toast.show('Error disconnecting', 'error');
    }
  };

  const handleTestPrint = async () => {
    try {
      if (!permissionsGranted) {
        Toast.show('Bluetooth permissions required. Please request permissions first.', 'error');
        return;
      }
      
      const success = await bluetoothManager.testConnection();
      if (success) {
        Toast.show('Test print successful', 'success');
      } else {
        Toast.show('Test print failed', 'error');
      }
    } catch (error) {
      Toast.show('Test print error', 'error');
    }
  };

  const renderDevice = ({ item }: { item: BluetoothDevice }) => (
    <View style={styles.deviceItem}>
      <View style={styles.deviceInfo}>
        <Text style={styles.deviceName}>{item.name}</Text>
        <Text style={styles.deviceAddress}>{item.address}</Text>
        <View style={styles.deviceMeta}>
          <Text style={[styles.deviceStatus, item.paired && styles.pairedText]}>
            {item.paired ? 'Paired' : 'Found'}
          </Text>
          {item.connected && (
            <Text style={styles.connectedText}>Connected</Text>
          )}
          {item.rssi && (
            <Text style={styles.rssiText}>Signal: {item.rssi}dBm</Text>
          )}
        </View>
      </View>
      <View style={styles.deviceActions}>
        {item.connected ? (
          <TouchableOpacity
            style={getButtonStyle([styles.actionButton, styles.disconnectButton], !permissionsGranted)}
            onPress={handleDisconnect}
            disabled={!permissionsGranted}
          >
            <Text style={!permissionsGranted ? styles.disabledButtonText : styles.buttonText}>
              Disconnect
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={getButtonStyle([styles.actionButton, styles.connectButton], !permissionsGranted)}
            onPress={() => handleConnectDevice(item)}
            disabled={!permissionsGranted}
          >
            <Text style={!permissionsGranted ? styles.disabledButtonText : styles.buttonText}>
              Connect
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const getButtonStyle = (baseStyle: any, isDisabled: boolean = false) => {
    if (isDisabled) {
      return [baseStyle, styles.disabledButton];
    }
    return baseStyle;
  };

  const renderStatusCard = () => (
    <View style={styles.statusCard}>
      <Text style={styles.statusTitle}>Bluetooth Status</Text>
      <View style={styles.statusRow}>
        <Text style={styles.statusLabel}>Module:</Text>
        <Text style={[styles.statusValue, isSupported ? styles.successText : styles.errorText]}>
          {isSupported ? 'Available' : 'Not Available'}
        </Text>
      </View>
      <View style={styles.statusRow}>
        <Text style={styles.statusLabel}>Permissions:</Text>
        <Text style={[styles.statusValue, permissionsGranted ? styles.successText : styles.errorText]}>
          {permissionsGranted ? 'Granted' : 'Not Granted'}
        </Text>
      </View>
      <View style={styles.statusRow}>
        <Text style={styles.statusLabel}>Bluetooth:</Text>
        <Text style={[styles.statusValue, status.enabled ? styles.successText : styles.errorText]}>
          {status.enabled ? 'Enabled' : 'Disabled'}
        </Text>
      </View>
      <View style={styles.statusRow}>
        <Text style={styles.statusLabel}>Connection:</Text>
        <Text style={[styles.statusValue, status.connected ? styles.successText : styles.errorText]}>
          {status.connected ? 'Connected' : 'Disconnected'}
        </Text>
      </View>
      {status.currentDevice && (
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Device:</Text>
          <Text style={styles.statusValue}>{status.currentDevice.name}</Text>
        </View>
      )}
      {status.error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{status.error}</Text>
        </View>
      )}
    </View>
  );

  if (showTroubleshooter) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => setShowTroubleshooter(false)}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Printer Troubleshooter</Text>
        </View>
        <PrinterTroubleshooter />
      </SafeAreaView>
    );
  }

  if (!isSupported) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.unsupportedContainer}>
          <Text style={styles.unsupportedTitle}>Bluetooth Printing Not Available</Text>
          <Text style={styles.unsupportedText}>
            The Bluetooth printing module is not available on this device.
          </Text>
          {moduleStatus?.error && (
            <Text style={styles.errorText}>Error: {moduleStatus.error}</Text>
          )}
          <TouchableOpacity
            style={styles.retryButton}
            onPress={initializeBluetooth}
          >
            <Text style={styles.buttonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {renderStatusCard()}

        {!permissionsGranted && (
          <View style={styles.permissionWarningCard}>
            <Text style={styles.permissionWarningTitle}>⚠️ Permissions Required</Text>
            <Text style={styles.permissionWarningText}>
              Bluetooth and Location permissions are required to scan for and connect to printers. 
              Please use the "Request Permissions" button above to grant the necessary permissions.
            </Text>
          </View>
        )}

        <View style={styles.controlsCard}>
          <Text style={styles.sectionTitle}>Controls</Text>
          
          <TouchableOpacity
            style={[styles.actionButton, styles.secondaryButton]}
            onPress={requestBluetoothPermissions}
          >
            <Text style={styles.buttonText}>Request Permissions</Text>
          </TouchableOpacity>
          
          {!status.enabled && (
            <TouchableOpacity
              style={getButtonStyle([styles.actionButton, styles.primaryButton], !permissionsGranted)}
              onPress={handleEnableBluetooth}
              disabled={!permissionsGranted}
            >
              <Text style={!permissionsGranted ? styles.disabledButtonText : styles.buttonText}>
                Enable Bluetooth
              </Text>
            </TouchableOpacity>
          )}

          {status.enabled && (
            <>
              <TouchableOpacity
                style={getButtonStyle([styles.actionButton, styles.primaryButton], !permissionsGranted)}
                onPress={handleScanDevices}
                disabled={status.scanning || !permissionsGranted}
              >
                {status.scanning ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={!permissionsGranted ? styles.disabledButtonText : styles.buttonText}>
                    Scan for Devices
                  </Text>
                )}
              </TouchableOpacity>

              {status.connected && (
                <>
                  <TouchableOpacity
                    style={getButtonStyle([styles.actionButton, styles.secondaryButton], !permissionsGranted)}
                    onPress={handleTestPrint}
                    disabled={!permissionsGranted}
                  >
                    <Text style={!permissionsGranted ? styles.disabledButtonText : styles.buttonText}>
                      Test Print
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={getButtonStyle([styles.actionButton, styles.dangerButton], !permissionsGranted)}
                    onPress={handleDisconnect}
                    disabled={!permissionsGranted}
                  >
                    <Text style={!permissionsGranted ? styles.disabledButtonText : styles.buttonText}>
                      Disconnect
                    </Text>
                  </TouchableOpacity>
                </>
              )}

              <TouchableOpacity
                style={[styles.actionButton, styles.infoButton]}
                onPress={() => setShowTroubleshooter(true)}
              >
                <Text style={styles.buttonText}>🛠️ Troubleshooter</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {devices.length > 0 && (
          <View style={styles.devicesCard}>
            <Text style={styles.sectionTitle}>Available Devices ({devices.length})</Text>
            <FlatList
              data={devices}
              renderItem={renderDevice}
              keyExtractor={(item) => item.address}
              scrollEnabled={false}
            />
          </View>
        )}

        <View style={styles.settingsCard}>
          <Text style={styles.sectionTitle}>Settings</Text>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Auto-connect to last device</Text>
            <Switch
              value={autoConnect}
              onValueChange={setAutoConnect}
              trackColor={{ false: '#767577', true: '#81b0ff' }}
              thumbColor={autoConnect ? '#f5dd4b' : '#f4f3f4'}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  statusCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  statusLabel: {
    fontSize: 14,
    color: '#666',
  },
  statusValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  successText: {
    color: '#4CAF50',
  },
  errorText: {
    color: '#F44336',
  },
  errorContainer: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#ffebee',
    borderRadius: 4,
  },
  controlsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  actionButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: '#2196F3',
  },
  secondaryButton: {
    backgroundColor: '#4CAF50',
  },
  dangerButton: {
    backgroundColor: '#F44336',
  },
  infoButton: {
    backgroundColor: '#2196F3',
  },
  connectButton: {
    backgroundColor: '#4CAF50',
  },
  disconnectButton: {
    backgroundColor: '#F44336',
  },
  disabledButton: {
    opacity: 0.5,
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  disabledButtonText: {
    color: '#999',
    fontSize: 14,
    fontWeight: '500',
  },
  devicesCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  deviceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  deviceAddress: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  deviceMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deviceStatus: {
    fontSize: 12,
    color: '#666',
    marginRight: 8,
  },
  pairedText: {
    color: '#4CAF50',
    fontWeight: '500',
  },
  connectedText: {
    fontSize: 12,
    color: '#2196F3',
    fontWeight: '500',
    marginRight: 8,
  },
  rssiText: {
    fontSize: 12,
    color: '#999',
  },
  deviceActions: {
    marginLeft: 12,
  },
  settingsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  settingLabel: {
    fontSize: 14,
    color: '#333',
  },
  permissionWarningCard: {
    backgroundColor: '#fff3cd',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  permissionWarningTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#856404',
    marginBottom: 8,
    textAlign: 'center',
  },
  permissionWarningText: {
    fontSize: 14,
    color: '#856404',
    textAlign: 'center',
    lineHeight: 20,
  },
  unsupportedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  unsupportedTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  unsupportedText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  retryButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
    marginRight: 16,
  },
  backButtonText: {
    fontSize: 16,
    color: '#2196F3',
    fontWeight: '500',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
});
