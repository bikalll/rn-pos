import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { RootState } from '../../redux/store';
import { colors, spacing, radius } from '../../theme';

const OngoingOrdersScreen: React.FC = () => {
  const [refreshing, setRefreshing] = useState(false);
  const [highlightedOrderId, setHighlightedOrderId] = useState<string | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  
  const navigation = useNavigation();
  const route = useRoute();
  
  const ongoingOrders = useSelector((state: RootState) => state.orders.ongoingOrderIds || []);
  const ordersById = useSelector((state: RootState) => state.orders.ordersById || {});
  const tables = useSelector((state: RootState) => state.tables.tablesById || {});

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  // Handle route parameters to scroll to specific table
  useEffect(() => {
    const params = route.params as { tableId?: string };
    if (params?.tableId) {
      // Find the order for the specific table
      const targetOrderId = ongoingOrders.find((orderId: string) => {
        const order = ordersById[orderId];
        return order && order.tableId === params.tableId;
      });

      if (targetOrderId) {
        setHighlightedOrderId(targetOrderId);
        
        // Find the index for scrolling
        const targetOrderIndex = ongoingOrders.findIndex((orderId: string) => orderId === targetOrderId);
        
        if (targetOrderIndex !== -1 && scrollViewRef.current) {
          // Scroll to the specific order after a short delay to ensure rendering
          setTimeout(() => {
            // Calculate approximate position (each order card is roughly 200px tall)
            const estimatedPosition = targetOrderIndex * 200;
            scrollViewRef.current?.scrollTo({
              y: Math.max(0, estimatedPosition - 100), // Offset by 100px to show some context above
              animated: true
            });
          }, 500);
        }
        
        // Clear highlight after 3 seconds
        setTimeout(() => {
          setHighlightedOrderId(null);
        }, 3000);
      }
    }
  }, [route.params, ongoingOrders, ordersById]);

  const getTableName = (tableId: string) => {
    const table = tables[tableId];
    if (table) {
      return table.name;
    }
    // Fallback: extract table number from tableId if it follows the pattern "table-X"
    if (tableId.startsWith('table-')) {
      const tableNumber = tableId.replace('table-', '');
      return `Table ${tableNumber}`;
    }
    // Final fallback
    return `Table ${tableId.slice(-6)}`;
  };

  const getTableCapacity = (tableId: string) => {
    const table = tables[tableId];
    if (table && table.seats) {
      return table.seats;
    }
    // Fallback: use a simple capacity calculation based on table ID
    if (tableId.startsWith('table-')) {
      const tableNumber = parseInt(tableId.replace('table-', ''));
      return tableNumber <= 4 ? 2 : tableNumber <= 8 ? 4 : 6;
    }
    return 4; // Default capacity
  };

  const handleOrderPress = (orderId: string) => {
    // @ts-ignore
    const order = ordersById[orderId];
    if (order) {
      // @ts-ignore
      navigation.navigate('Orders', { 
        screen: 'OrderConfirmation', 
        params: { orderId, tableId: order.tableId } 
      });
    }
  };

  const calculateTotal = (order: any) => {
    const subtotal = order.items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
    return subtotal;
  };

  const renderOrder = (orderId: string, isHighlighted: boolean = false) => {
    const order = ordersById[orderId];
    if (!order) return null;

    return (
      <TouchableOpacity key={order.id} onPress={() => handleOrderPress(order.id)}>
        <View style={[styles.orderCard, isHighlighted && styles.highlightedOrderCard]}>
          <View style={styles.orderHeader}>
            <View style={styles.orderHeaderLeft}>
              <View style={styles.titleRow}>
                <Text style={styles.orderTitle}>
                  {getTableName(order.tableId)}
                  <Text style={styles.orderReference}> • Order #{order.id.slice(-6)}</Text>
                </Text>
                <View style={styles.statusIndicator}>
                  <Ionicons name="time" size={16} color={colors.warning} />
                </View>
              </View>
              <View style={styles.orderMeta}>
                <Text style={styles.orderTime}>
                  {new Date(order.createdAt).toLocaleTimeString()}
                </Text>
                <Text style={styles.tableCapacity}>
                  • {getTableCapacity(order.tableId)} seats
                </Text>
              </View>
            </View>
            <View style={styles.orderHeaderRight}>
              <View style={styles.actionButtons}>
                <TouchableOpacity 
                  style={styles.actionButton}
                  onPress={() => {
                    // @ts-ignore
                    navigation.navigate('Orders', { 
                      screen: 'OrderTaking', 
                      params: { orderId: order.id, tableId: order.tableId } 
                    });
                  }}
                >
                  <Ionicons name="add-circle" size={18} color="white" />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={styles.orderBrief}>
            <Text style={styles.orderBriefText}>
              {order.items.length} items • Rs. {calculateTotal(order).toFixed(2)}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Ongoing Orders</Text>
        <Text style={styles.subtitle}>Monitor and manage all active customer orders.</Text>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {ongoingOrders.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="restaurant-outline" size={48} color={colors.textSecondary} />
            <Text style={styles.emptyStateText}>No ongoing orders</Text>
            <Text style={styles.emptyStateSubtext}>
              All tables are currently available
            </Text>
            <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
              <Ionicons name="refresh" size={20} color={colors.primary} />
              <Text style={styles.refreshButtonText}>Refresh</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.ordersList}>
            {ongoingOrders.map((orderId: string) => renderOrder(orderId, orderId === highlightedOrderId))}
          </View>
        )}
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
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
    padding: spacing.md,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.xl,
  },
  emptyStateText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.outline,
  },
  refreshButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: spacing.xs,
  },
  ordersList: {
    width: '100%',
  },
  orderCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.outline,
  },
  highlightedOrderCard: {
    borderColor: colors.primary,
    borderWidth: 2,
    backgroundColor: colors.surface2,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  orderHeaderLeft: {
    flex: 1,
  },
  orderHeaderRight: {
    paddingLeft: spacing.sm,
  },
  orderTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.primary,
  },
  orderReference: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: 'normal',
  },
  orderTime: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  orderMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs / 2,
  },
  tableCapacity: {
    fontSize: 14,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },
  orderItems: {
    marginBottom: spacing.sm,
  },
  orderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  orderItemInfo: {
    flex: 1,
  },
  orderItemName: {
    fontSize: 16,
    color: colors.textPrimary,
    marginBottom: spacing.xs / 2,
  },
  orderItemPrice: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    paddingHorizontal: spacing.xs,
  },
  quantityButton: {
    padding: spacing.xs,
  },
  quantityText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
    paddingHorizontal: spacing.xs,
  },
  removeButton: {
    padding: spacing.xs,
  },
  orderSummary: {
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.outline,
    paddingTop: spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  summaryLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  summaryValue: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  summaryValueTotal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },

  primaryButton: {
    backgroundColor: colors.primary,
  },
  primaryButtonText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  dangerButton: {
    backgroundColor: colors.danger,
  },
  dangerButtonText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    padding: spacing.md,
    width: '80%',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  paymentMethodSection: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  paymentMethods: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    gap: spacing.sm,
  },
  paymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.outline,
  },
  paymentMethodSelected: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  paymentMethodIcon: {
    fontSize: 24,
    marginRight: spacing.xs,
  },
  paymentMethodName: {
    fontSize: 16,
    color: colors.textPrimary,
  },
  inputSection: {
    width: '100%',
    marginBottom: spacing.md,
  },
  inputLabel: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 18,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.outline,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: spacing.md,
  },
  modalButtonSecondary: {
    backgroundColor: colors.outline,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
  },
  modalButtonSecondaryText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalButtonPrimary: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
  },
  modalButtonPrimaryText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  orderBrief: {
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.outline,
  },
  orderBriefText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs / 2,
  },

  actionButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statusIndicator: {
    marginLeft: spacing.xs,
  },
  actionButton: {
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },

});

export default OngoingOrdersScreen;
