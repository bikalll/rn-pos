import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing, radius } from '../../theme';

const SettingsScreen: React.FC = () => {
  const navigation = useNavigation();

  const settingsOptions = [
    {
      title: 'Table Management',
      subtitle: 'Add, edit, and manage restaurant tables',
      icon: '🪑',
      onPress: () => navigation.navigate('TableManagement' as any),
    },
    {
      title: 'Menu Management',
      subtitle: 'Add, edit, or remove menu items',
      icon: '🍽️',
      onPress: () => navigation.navigate('Inventory' as any, { screen: 'MenuManagement' } as any),
    },
    {
      title: 'Printer Setup',
      subtitle: 'Configure Bluetooth and USB printers',
      icon: '🖨️',
      onPress: () => navigation.navigate('PrinterSetup' as any),
    },
    {
      title: 'Printing Demo',
      subtitle: 'Test printing functionality',
      icon: '📄',
      onPress: () => navigation.navigate('PrintDemo' as any),
    },
    {
      title: 'Bluetooth Debug',
      subtitle: 'Troubleshoot Bluetooth printing issues',
      icon: '🔧',
      onPress: () => navigation.navigate('BluetoothDebug' as any),
    },
    {
      title: 'Print Debug',
      subtitle: 'Test KOT and Receipt printing',
      icon: '🧪',
      onPress: () => navigation.navigate('PrintDebug' as any),
    },
    {
      title: 'General Settings',
      subtitle: 'App preferences and configuration',
      icon: '⚙️',
      onPress: () => {},
    },
    {
      title: 'Employee Management',
      subtitle: 'Manage staff accounts and permissions',
      icon: '👥',
      onPress: () => navigation.navigate('EmployeeManagement' as any),
    },
    {
      title: 'Backup & Restore',
      subtitle: 'Data backup and recovery options',
      icon: '💾',
      onPress: () => {},
    },
    {
      title: 'About',
      subtitle: 'App version and information',
      icon: 'ℹ️',
      onPress: () => {},
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>Configure your Arbi POS system</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: spacing.xl }}>
        {settingsOptions.map((option, index) => (
          <TouchableOpacity
            key={index}
            style={styles.settingOption}
            onPress={option.onPress}
          >
            <Text style={styles.optionIcon}>{option.icon}</Text>
            <View style={styles.optionContent}>
              <Text style={styles.optionTitle}>{option.title}</Text>
              <Text style={styles.optionSubtitle}>{option.subtitle}</Text>
            </View>
            <Text style={styles.arrowIcon}>›</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.background,
    padding: spacing.md,
    paddingTop: 0,
    borderBottomWidth: 1,
    borderBottomColor: colors.outline,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  content: { 
    flex: 1, 
    padding: spacing.md 
  },
  settingOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.outline,
  },
  optionIcon: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  optionSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  arrowIcon: {
    fontSize: 20,
    color: colors.textSecondary,
  },
});

export default SettingsScreen;
