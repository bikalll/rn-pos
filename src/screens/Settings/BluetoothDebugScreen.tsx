import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { bluetoothDebugger, DebugInfo } from '../../services/bluetoothDebugger';
import { bluetoothManager } from '../../services/bluetoothManager';
import { blePrinter } from '../../services/blePrinter';

const BluetoothDebugScreen: React.FC = () => {
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const [connectionDetails, setConnectionDetails] = useState<any>(null);

  useEffect(() => {
    runDiagnostics();
  }, []);

  const runDiagnostics = async () => {
    setLoading(true);
    try {
      const info = await bluetoothDebugger.runDiagnostics();
      setDebugInfo(info);
      setDebugLog(bluetoothDebugger.getDebugLog());
      
      const details = await bluetoothDebugger.getConnectionDetails();
      setConnectionDetails(details);
    } catch (error) {
      Alert.alert('Error', `Diagnostics failed: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const testPrintWithDebug = async () => {
    setLoading(true);
    try {
      const result = await bluetoothDebugger.testPrintWithDebug();
      
      if (result.success) {
        Alert.alert('Success', 'Test print completed successfully!');
      } else {
        Alert.alert('Test Print Failed', `Error: ${result.error}\n\nDetails: ${JSON.stringify(result.details, null, 2)}`);
      }
      
      // Refresh diagnostics
      await runDiagnostics();
    } catch (error) {
      Alert.alert('Error', `Test print error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const forceReconnect = async () => {
    if (!debugInfo?.currentDevice?.address) {
      Alert.alert('Error', 'No device connected to reconnect to');
      return;
    }

    setLoading(true);
    try {
      const result = await bluetoothDebugger.forceReconnect(debugInfo.currentDevice.address);
      
      if (result.success) {
        Alert.alert('Success', 'Device reconnected successfully!');
      } else {
        Alert.alert('Reconnect Failed', `Error: ${result.error}`);
      }
      
      await runDiagnostics();
    } catch (error) {
      Alert.alert('Error', `Reconnect error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const clearLogs = () => {
    bluetoothDebugger.clearDebugLog();
    setDebugLog([]);
  };

  const renderStatusItem = (label: string, value: any, color?: string) => (
    <View style={styles.statusItem}>
      <Text style={styles.statusLabel}>{label}:</Text>
      <Text style={[styles.statusValue, color && { color }]}>
        {typeof value === 'boolean' ? (value ? '✅ Yes' : '❌ No') : String(value || 'N/A')}
      </Text>
    </View>
  );

  const renderDebugSection = (title: string, data: any) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionContent}>
        {Object.entries(data).map(([key, value]) => (
          <Text key={key} style={styles.debugText}>
            <Text style={styles.debugKey}>{key}:</Text> {JSON.stringify(value, null, 2)}
          </Text>
        ))}
      </View>
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Bluetooth Debug</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={runDiagnostics}>
          <Text style={styles.buttonText}>🔄 Refresh</Text>
        </TouchableOpacity>
      </View>

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Running diagnostics...</Text>
        </View>
      )}

      {debugInfo && (
        <View style={styles.content}>
          {/* Module Status */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Module Status</Text>
            <View style={styles.sectionContent}>
              {renderStatusItem('Module Supported', debugInfo.moduleSupported, debugInfo.moduleSupported ? 'green' : 'red')}
              {debugInfo.moduleError && renderStatusItem('Module Error', debugInfo.moduleError, 'red')}
            </View>
          </View>

          {/* Bluetooth Status */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Bluetooth Status</Text>
            <View style={styles.sectionContent}>
              {renderStatusItem('Bluetooth Enabled', debugInfo.bluetoothEnabled)}
              {renderStatusItem('Permissions Granted', debugInfo.permissionsGranted)}
              {renderStatusItem('Device Connected', debugInfo.deviceConnected)}
              {debugInfo.lastError && renderStatusItem('Last Error', debugInfo.lastError, 'red')}
            </View>
          </View>

          {/* Current Device */}
          {debugInfo.currentDevice && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Current Device</Text>
              <View style={styles.sectionContent}>
                {renderStatusItem('Name', debugInfo.currentDevice.name)}
                {renderStatusItem('Address', debugInfo.currentDevice.address)}
                {renderStatusItem('Paired', debugInfo.currentDevice.paired)}
                {renderStatusItem('Connected', debugInfo.currentDevice.connected)}
              </View>
            </View>
          )}

          {/* Device List */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Available Devices ({debugInfo.deviceList.length})</Text>
            <View style={styles.sectionContent}>
              {debugInfo.deviceList.length === 0 ? (
                <Text style={styles.noDevices}>No devices found</Text>
              ) : (
                debugInfo.deviceList.map((device, index) => (
                  <View key={index} style={styles.deviceItem}>
                    <Text style={styles.deviceName}>{device.name}</Text>
                    <Text style={styles.deviceAddress}>{device.address}</Text>
                    <Text style={styles.deviceStatus}>
                      {device.paired ? 'Paired' : 'Found'} {device.connected ? '• Connected' : ''}
                    </Text>
                  </View>
                ))
              )}
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity 
              style={[styles.actionButton, styles.testButton]} 
              onPress={testPrintWithDebug}
              disabled={loading || !debugInfo.deviceConnected}
            >
              <Text style={styles.buttonText}>🧪 Test Print</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionButton, styles.reconnectButton]} 
              onPress={forceReconnect}
              disabled={loading || !debugInfo.deviceConnected}
            >
              <Text style={styles.buttonText}>🔗 Force Reconnect</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionButton, styles.clearButton]} 
              onPress={clearLogs}
            >
              <Text style={styles.buttonText}>🗑️ Clear Logs</Text>
            </TouchableOpacity>
          </View>

          {/* Debug Log */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Debug Log</Text>
            <View style={styles.logContainer}>
              {debugLog.length === 0 ? (
                <Text style={styles.noLogs}>No debug logs</Text>
              ) : (
                debugLog.map((log, index) => (
                  <Text key={index} style={styles.logEntry}>{log}</Text>
                ))
              )}
            </View>
          </View>

          {/* Connection Details */}
          {connectionDetails && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Connection Details</Text>
              <View style={styles.sectionContent}>
                {renderDebugSection('Module', connectionDetails.module)}
                {renderDebugSection('Bluetooth', connectionDetails.bluetooth)}
                {renderDebugSection('Permissions', { granted: connectionDetails.permissions })}
              </View>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  refreshButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
    color: '#666',
  },
  content: {
    padding: 16,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  sectionContent: {
    padding: 16,
  },
  statusItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  statusLabel: {
    fontSize: 16,
    color: '#666',
    flex: 1,
  },
  statusValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    textAlign: 'right',
  },
  deviceItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  deviceAddress: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'monospace',
  },
  deviceStatus: {
    fontSize: 12,
    color: '#007AFF',
    marginTop: 2,
  },
  noDevices: {
    textAlign: 'center',
    color: '#999',
    fontStyle: 'italic',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  testButton: {
    backgroundColor: '#28a745',
  },
  reconnectButton: {
    backgroundColor: '#ffc107',
  },
  clearButton: {
    backgroundColor: '#dc3545',
  },
  logContainer: {
    maxHeight: 200,
  },
  logEntry: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#666',
    marginBottom: 2,
  },
  noLogs: {
    textAlign: 'center',
    color: '#999',
    fontStyle: 'italic',
  },
  debugText: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#666',
    marginBottom: 4,
  },
  debugKey: {
    fontWeight: 'bold',
    color: '#333',
  },
});

export default BluetoothDebugScreen;







