import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  RefreshControl,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootState } from '../../redux/store';
import { colors, radius, spacing, shadow } from '../../theme';

type TablesDashboardNavigationProp = NativeStackNavigationProp<any, 'TablesDashboard'>;

interface Table {
  id: string;
  number: number;
  capacity: number;
  status: 'available' | 'occupied' | 'reserved' | 'cleaning';
  currentOrderId?: string;
  totalAmount?: number;
  customerCount?: number;
  isMerged?: boolean;
  mergedTableNames?: string[];
  totalSeats?: number;
}

const TablesDashboardScreen: React.FC = () => {
  const [tables, setTables] = useState<Table[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const navigation = useNavigation<TablesDashboardNavigationProp>();
  const ongoingOrderIds = useSelector((state: RootState) => state.orders.ongoingOrderIds || []);
  const ordersById = useSelector((state: RootState) => state.orders.ordersById || {});
  const tablesById = useSelector((state: RootState) => state.tables.tablesById || {});
  const tableIds = useSelector((state: RootState) => state.tables.tableIds || []);

  useEffect(() => {
    // Use real tables from Redux store, fallback to mock tables if none exist
    if (tableIds.length > 0) {
      const realTables: Table[] = tableIds.map((tableId: string) => {
        const table = tablesById[tableId];
        if (table.isMerged) {
          return {
            id: table.id,
            number: parseInt(table.name.replace(/\D/g, '')) || 1,
            capacity: table.totalSeats || table.seats,
            status: 'available' as const,
            isMerged: true,
            mergedTableNames: table.mergedTableNames,
            totalSeats: table.totalSeats || table.seats,
          };
        } else {
          return {
            id: table.id,
            number: parseInt(table.name.replace(/\D/g, '')) || 1,
            capacity: table.seats,
            status: 'available' as const,
          };
        }
      });
      setTables(realTables);
    } else {
      // Fallback to mock tables (default 4 tables)
      const mockTables: Table[] = Array.from({ length: 4 }, (_, index) => ({
        id: `table-${index + 1}`,
        number: index + 1,
        capacity: index < 2 ? 2 : 4,
        status: 'available' as const,
      }));
      setTables(mockTables);
    }
  }, [tableIds, tablesById]);

  useEffect(() => {
    setTables(prevTables => 
      prevTables.map(table => {
        const activeOrderId = ongoingOrderIds.find((id: string) => ordersById[id]?.tableId === table.id);
        if (activeOrderId) {
          return { ...table, status: 'occupied' as const, currentOrderId: activeOrderId };
        }
        return { ...table, status: 'available' as const, currentOrderId: undefined };
      })
    );
  }, [ongoingOrderIds, ordersById]);

  const handleTablePress = (table: Table) => {
    try {
      // Resolve the active order for this table from store (robust lookup)
      const resolvedOrderFromMap = Object.values(ordersById || {}).find(
        (o: any) => o?.tableId === table.id && o?.status === 'ongoing'
      ) as any;
      const resolvedOrderId = resolvedOrderFromMap?.id || (ongoingOrderIds || []).find(
        (id: string) => ordersById[id]?.tableId === table.id
      );
      console.log('[Manage Order] Table press', {
        tableId: table.id,
        tableStatus: table.status,
        currentOrderId: table.currentOrderId,
        resolvedOrderId,
      });

      if (table.status === 'occupied' && (table.currentOrderId || resolvedOrderId)) {
        // Navigate to order confirmation for existing order (cross-navigator)
        const nestedParams = {
          screen: 'OrderConfirmation',
          params: {
            orderId: table.currentOrderId || resolvedOrderId,
            tableId: table.id,
          },
        } as any;
        console.log('[Manage Order] Navigating to Orders → OrderConfirmation with', nestedParams);

        // Try root dispatch first (works across drawer/stack boundaries)
        navigation.dispatch(
          CommonActions.navigate({
            name: 'Orders',
            params: nestedParams,
          })
        );

        // Fallback: try via parent navigator (Drawer)
        const parentNav = (navigation as any).getParent?.();
        parentNav?.navigate?.('Orders', nestedParams);

        // Fallback 2: try parent dispatch
        parentNav?.dispatch?.(
          CommonActions.navigate({
            name: 'Orders',
            params: nestedParams,
          })
        );

        // Fallback 3: try root (if Drawer is nested in RootStack)
        const rootNav = parentNav?.getParent?.();
        rootNav?.navigate?.('Orders', nestedParams);
        rootNav?.dispatch?.(
          CommonActions.navigate({
            name: 'Orders',
            params: nestedParams,
          })
        );
      } else if (table.status === 'available') {
        navigation.navigate('OrderTaking' as any, { 
          tableId: table.id,
          orderId: 'new'
        });
      } else {
        Alert.alert('No Active Order', `Could not find an active order for ${tablesById[table.id]?.name || `Table ${table.number}`}.`);
      }
    } catch (error) {
      Alert.alert('Error', 'Unable to process table action');
    }
  };

  const getStatusText = (status: Table['status']) => {
    switch (status) {
      case 'available': return 'Available';
      case 'occupied': return 'Occupied';
      case 'reserved': return 'Reserved';
      case 'cleaning': return 'Cleaning';
      default: return 'Unknown';
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const renderTable = ({ item: table }: { item: Table }) => (
    <View style={styles.tableCard}>
      <View style={styles.cardHeader}>
        <Text style={styles.tableNumber}>
          {tablesById[table.id]?.name || `Table ${table.number}`}
        </Text>
        <View
          style={[
            styles.badge,
            table.status === 'available' && styles.badge_available,
            table.status === 'occupied' && styles.badge_occupied,
            table.status === 'reserved' && styles.badge_reserved,
            table.status === 'cleaning' && styles.badge_cleaning,
          ]}
        >
          <Text
            style={[
              styles.badgeText,
              table.status === 'available' && styles.badgeText_available,
              table.status === 'occupied' && styles.badgeText_occupied,
              table.status === 'reserved' && styles.badgeText_reserved,
              table.status === 'cleaning' && styles.badgeText_cleaning,
            ]}
          >
            {getStatusText(table.status)}
          </Text>
        </View>
      </View>
      
      {/* Show merged table information */}
      {table.isMerged && table.mergedTableNames && (
        <View style={styles.mergedInfo}>
          <Text style={styles.mergedLabel}>Merged Tables:</Text>
          <Text style={styles.mergedTables}>
            {table.mergedTableNames.join(' + ')}
          </Text>
          <Text style={styles.totalSeats}>
            Total Seats: {table.totalSeats || table.capacity}
          </Text>
        </View>
      )}
      
      <TouchableOpacity style={styles.createOrderButton} onPress={() => handleTablePress(table)}>
        <Text style={styles.createOrderButtonText}>
          {table.status === 'occupied' ? 'Manage Order' : 'Create Order'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        style={styles.content}
        contentContainerStyle={styles.listContent}
        data={tables}
        keyExtractor={(t) => t.id}
        renderItem={renderTable}
        numColumns={1}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <View style={styles.header}> 
            <Text style={styles.title}>Tables</Text>
            <Text style={styles.subtitle}>Manage your tables and create orders</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
  header: {
    backgroundColor: colors.background,
    padding: spacing.md,
    paddingTop: 0,
    borderBottomWidth: 1,
    borderBottomColor: colors.outline,
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  subtitle: {
    marginTop: spacing.xs,
    fontSize: 14,
    color: colors.textSecondary,
  },
  listContent: { padding: spacing.md, paddingBottom: spacing.lg },
  tableCard: {
    width: '96%',
    maxWidth: 520,
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.outline,
    ...shadow.card,
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  tableNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  badge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  badge_available: { backgroundColor: '#27ae6033', borderColor: colors.success },
  badge_occupied: { backgroundColor: '#e74c3c33', borderColor: colors.danger },
  badge_reserved: { backgroundColor: '#f39c1233', borderColor: colors.warning },
  badge_cleaning: { backgroundColor: '#ff6b3533', borderColor: colors.primary },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  badgeText_available: { color: colors.success },
  badgeText_occupied: { color: colors.danger },
  badgeText_reserved: { color: colors.warning },
  badgeText_cleaning: { color: colors.primary },
  createOrderButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  createOrderButtonText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  mergedInfo: {
    backgroundColor: colors.primary + '10',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  mergedLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  mergedTables: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  totalSeats: {
    fontSize: 12,
    color: colors.textSecondary,
  },
});

export default TablesDashboardScreen;
