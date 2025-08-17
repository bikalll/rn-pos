import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DrawerContentComponentProps } from '@react-navigation/drawer';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, radius } from '../theme';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../redux/slices/authSlice';
import { RootState } from '../redux/store';

const DrawerItem = (
  props: {
    label: string;
    icon: React.ReactNode;
    onPress: () => void;
    isActive?: boolean;
  }
) => {
  return (
    <TouchableOpacity
      onPress={props.onPress}
      style={[styles.item, props.isActive && styles.itemActive]}
    >
      <View style={styles.iconWrap}>{props.icon}</View>
      <Text style={[styles.itemLabel, props.isActive && styles.itemLabelActive]}>{props.label}</Text>
    </TouchableOpacity>
  );
};

const topInset = Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0;

const CustomDrawerContent: React.FC<DrawerContentComponentProps> = ({ navigation, state }) => {
  const dispatch = useDispatch();
  const auth = useSelector((s: RootState) => s.auth);
  const insets = useSafeAreaInsets();
  const current = state?.routeNames?.[state.index] as string | undefined;
  const currentRoute = state?.routes?.[state.index] as any;
  const nestedState = currentRoute?.state as any | undefined;
  const nestedRouteName = nestedState?.routes?.[nestedState.index || 0]?.name as string | undefined;

  const goTo = (routeName: string, nested?: { screen: string; params?: any }) => {
    if (nested) {
      navigation.navigate(routeName as never, nested as never);
    } else {
      navigation.navigate(routeName as never);
    }
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }] }>
      <View style={styles.header}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoText}>A</Text>
        </View>
        <View>
          <Text style={styles.brand}>Arbi POS</Text>
          <Text style={styles.tagline}>Restaurant POS</Text>
        </View>
      </View>

      <ScrollView style={styles.menu} contentContainerStyle={{ paddingBottom: spacing.xl }}>
        <DrawerItem
          label="Tables / Room"
          icon={<MaterialCommunityIcons name="view-dashboard-outline" size={20} color={colors.textPrimary} />}
          onPress={() => goTo('Dashboard')}
          isActive={current === 'Dashboard'}
        />
        <DrawerItem
          label="Menu"
          icon={<Feather name="shopping-bag" size={20} color={colors.textPrimary} />}
          onPress={() => goTo('Inventory', { screen: 'Menu' })}
          isActive={current === 'Inventory' && nestedRouteName === 'Menu'}
        />
        {/* Removed separate Menu entry to avoid confusion */}
        <DrawerItem
          label="Inventory"
          icon={<Feather name="box" size={20} color={colors.textPrimary} />}
          onPress={() => goTo('Inventory', { screen: 'InventoryManagement' })}
          isActive={current === 'Inventory' && (!nestedRouteName || nestedRouteName === 'InventoryManagement')}
        />
        <DrawerItem
          label="Ongoing Orders"
          icon={<Feather name="list" size={20} color={colors.textPrimary} />}
          onPress={() => goTo('Orders', { screen: 'OngoingOrders' })}
          isActive={current === 'Orders'}
        />
        <DrawerItem
          label="Receipts"
          icon={<Ionicons name="receipt-outline" size={20} color={colors.textPrimary} />}
          onPress={() => goTo('Receipts', { screen: 'DailySummary' })}
          isActive={current === 'Receipts'}
        />
        <DrawerItem
          label="Attendance"
          icon={<Feather name="check-square" size={20} color={colors.textPrimary} />}
          onPress={() => goTo('Staff', { screen: 'Attendance' })}
          isActive={current === 'Staff'}
        />
        
        <DrawerItem
          label="Customers"
          icon={<Ionicons name="people-outline" size={20} color={colors.textPrimary} />}
          onPress={() => goTo('Customers')}
          isActive={current === 'Customers'}
        />
        
        <DrawerItem
          label="Reports"
          icon={<Feather name="bar-chart-2" size={20} color={colors.textPrimary} />}
          onPress={() => goTo('Reports')}
          isActive={current === 'Reports'}
        />
        <DrawerItem
          label="Printer Setup"
          icon={<Feather name="printer" size={20} color={colors.textPrimary} />}
          onPress={() => goTo('Printer')}
          isActive={current === 'Printer'}
        />
        <DrawerItem
          label="Settings"
          icon={<Ionicons name="settings-outline" size={20} color={colors.textPrimary} />}
          onPress={() => goTo('Settings')}
          isActive={current === 'Settings'}
        />
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.userRow}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{(auth?.userName || 'U').slice(0,1).toUpperCase()}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.userName}>{auth?.userName || 'User'}</Text>
            <Text style={styles.userRole}>{auth?.role || 'Staff'}</Text>
          </View>
          <TouchableOpacity onPress={() => { dispatch(logout()); }}>
            <Feather name="log-out" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
        <Text style={styles.powered}>Powered by Arbi POS</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: topInset + spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.outline,
  },
  logoCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  logoText: { color: 'white', fontWeight: 'bold', fontSize: 20 },
  brand: { color: 'white', fontWeight: 'bold', fontSize: 18 },
  tagline: { color: colors.textSecondary, fontSize: 12 },
  menu: { flex: 1, paddingHorizontal: spacing.sm, paddingTop: spacing.md },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginHorizontal: spacing.xs,
    borderRadius: radius.md,
  },
  itemActive: { backgroundColor: colors.surface },
  iconWrap: { width: 28, alignItems: 'center', marginRight: spacing.sm },
  itemLabel: { color: colors.textPrimary, fontSize: 15, fontWeight: '500' },
  itemLabelActive: { color: colors.primary },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.outline,
    padding: spacing.md,
  },
  userRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm },
  avatarText: { color: 'white', fontWeight: 'bold' },
  userName: { color: 'white', fontWeight: '600' },
  userRole: { color: colors.textSecondary, fontSize: 12 },
  powered: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
});

export default CustomDrawerContent;



