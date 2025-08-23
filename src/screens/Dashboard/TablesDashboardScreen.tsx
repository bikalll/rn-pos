import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { CommonActions } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../redux/store';
import { selectActiveTables, reserveTable, unreserveTable } from '../../redux/slices/tablesSlice';
import { colors, spacing, radius, shadow } from '../../theme';

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
  const activeTables = useSelector(selectActiveTables);
  const customers = useSelector((state: RootState) => (state as any).customers?.customersById || {});
  const dispatch = useDispatch();

  // Reservation modal state
  const [reservationModalVisible, setReservationModalVisible] = useState(false);
  const [reservationTargetTableId, setReservationTargetTableId] = useState<string | null>(null);
  const [resNote, setResNote] = useState<string>('');
  const [resHour, setResHour] = useState<string>('');
  const [resMinute, setResMinute] = useState<string>('');
  const [resAmPm, setResAmPm] = useState<'AM' | 'PM'>('PM');
  const [resDayOffset, setResDayOffset] = useState<0 | 1>(0); // 0: Today, 1: Tomorrow
  const [nowTs, setNowTs] = useState<number>(Date.now());

  // Customer selection for reservation
  const [customerSearchRes, setCustomerSearchRes] = useState<string>('');
  const [selectedCustomerIdRes, setSelectedCustomerIdRes] = useState<string | null>(null);

  // Reservation details modal
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [detailsTableId, setDetailsTableId] = useState<string | null>(null);

  // Themed actions modal for long-press on reserved table
  const [actionsModalVisible, setActionsModalVisible] = useState(false);
  const [actionsTableId, setActionsTableId] = useState<string | null>(null);

  useEffect(() => {
    // Use active tables from Redux store, fallback to mock tables if none exist
    if (activeTables.length > 0) {
      const realTables: Table[] = activeTables.map((table) => {
        const reservedActive = (table as any).isReserved && (!((table as any).reservedUntil) || (table as any).reservedUntil > Date.now());
        if (table.isMerged) {
          return {
            id: table.id,
            number: parseInt(table.name.replace(/\D/g, '')) || 1,
            capacity: table.totalSeats || table.seats,
            status: reservedActive ? 'reserved' as const : 'available' as const,
            isMerged: true,
            mergedTableNames: table.mergedTableNames,
            totalSeats: table.totalSeats || table.seats,
          };
        } else {
          return {
            id: table.id,
            number: parseInt(table.name.replace(/\D/g, '')) || 1,
            capacity: table.seats,
            status: reservedActive ? 'reserved' as const : 'available' as const,
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
  }, [activeTables]);

  useEffect(() => {
    setTables(prevTables => 
      prevTables.map(table => {
        const activeOrderId = ongoingOrderIds.find((id: string) => ordersById[id]?.tableId === table.id);
        if (activeOrderId) {
          return { ...table, status: 'occupied' as const, currentOrderId: activeOrderId };
        }
        const reduxTable = activeTables.find(t => t.id === table.id) as any;
        const reservedActive = reduxTable?.isReserved && (!reduxTable?.reservedUntil || reduxTable?.reservedUntil > Date.now());
        if (reservedActive) {
          return { ...table, status: 'reserved' as const, currentOrderId: undefined };
        }
        return { ...table, status: 'available' as const, currentOrderId: undefined };
      })
    );
  }, [ongoingOrderIds, ordersById, activeTables]);

  // Tick every 30s to update remaining timers
  useEffect(() => {
    const id = setInterval(() => setNowTs(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const openReservationModal = (table: Table) => {
    setReservationTargetTableId(table.id);
    setResNote('');
    setCustomerSearchRes('');
    setSelectedCustomerIdRes(null);
    // Default to next 30-min slot today
    const now = new Date();
    let minutes = now.getMinutes();
    const nextSlot = Math.ceil((minutes + 1) / 30) * 30;
    const base = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0, 0);
    base.setMinutes(nextSlot % 60);
    if (nextSlot >= 60) base.setHours(base.getHours() + 1);
    let hour24 = base.getHours();
    const ampm: 'AM' | 'PM' = hour24 >= 12 ? 'PM' : 'AM';
    let hour12 = hour24 % 12; if (hour12 === 0) hour12 = 12;
    setResHour(String(hour12));
    setResMinute((base.getMinutes()).toString().padStart(2, '0'));
    setResAmPm(ampm);
    setResDayOffset(0);
    setReservationModalVisible(true);
  };

  const handleLongPress = (table: Table) => {
    const name = activeTables.find(t => t.id === table.id)?.name || `Table ${table.number}`;
    if (table.status === 'reserved') {
      setActionsTableId(table.id);
      setActionsModalVisible(true);
    } else if (table.status === 'available') {
      openReservationModal(table);
    } else if (table.status === 'occupied') {
      Alert.alert('Cannot Reserve', `${name} is currently occupied.`);
    } else if (table.isMerged) {
      Alert.alert('Cannot Reserve', `${name} is a merged table.`);
    }
  };

  const confirmReservation = () => {
    if (!reservationTargetTableId) return;
    if (!selectedCustomerIdRes) {
      Alert.alert('Select Customer', 'Please choose a customer for this reservation.');
      return;
    }
    const selectedCustomer: any = (customers as any)[selectedCustomerIdRes];
    const nameTrimmed = (selectedCustomer?.name || selectedCustomer?.phone || '').trim();
    const hourNum = parseInt(resHour, 10);
    const minuteNum = parseInt(resMinute, 10);
    if (isNaN(hourNum) || isNaN(minuteNum) || hourNum < 1 || hourNum > 12 || minuteNum < 0 || minuteNum > 59) {
      Alert.alert('Invalid Time', 'Please enter a valid time.');
      return;
    }
    let hour24 = hourNum % 12;
    if (resAmPm === 'PM') hour24 += 12;
    const now = new Date();
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + resDayOffset, hour24, minuteNum, 0, 0);
    const ts = date.getTime();
    if (ts <= Date.now()) {
      Alert.alert('Invalid Time', 'Please choose a future time.');
      return;
    }
    dispatch(reserveTable({ id: reservationTargetTableId, reservedBy: nameTrimmed, reservedNote: resNote.trim() || undefined, reservedUntil: ts }));
    setReservationModalVisible(false);
    setReservationTargetTableId(null);
  };

  const cancelReservationModal = () => {
    setReservationModalVisible(false);
    setReservationTargetTableId(null);
    setResNote('');
    setCustomerSearchRes('');
    setSelectedCustomerIdRes(null);
  };

  const getRemainingLabel = (tableId: string) => {
    const t = activeTables.find(t0 => t0.id === tableId) as any;
    if (!t?.isReserved || !t?.reservedUntil) return '';
    const diff = t.reservedUntil - nowTs;
    if (diff <= 0) return 'Expired';
    const mins = Math.round(diff / 60000);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0) return `${h}h ${m}m left`;
    return `${m}m left`;
  };

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
        Alert.alert('No Active Order', `Could not find an active order for ${activeTables.find(t => t.id === table.id)?.name || `Table ${table.number}`}.`);
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
    <TouchableOpacity
      activeOpacity={0.9}
      onLongPress={() => handleLongPress(table)}
      delayLongPress={400}
      style={[styles.tableCard, table.status === 'reserved' && styles.tableCardReserved]}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.tableNumber}>
          {activeTables.find(t => t.id === table.id)?.name || `Table ${table.number}`}
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
      {table.status === 'reserved' && (
        <Text style={styles.remainingTime}>{getRemainingLabel(table.id)}</Text>
      )}
      
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
      
      <TouchableOpacity 
        style={[styles.createOrderButton, table.status === 'reserved' && styles.createOrderButtonDisabled]}
        onPress={() => {
          if (table.status === 'reserved') {
            Alert.alert('Reserved', 'This table is reserved. Long-press the card to unreserve.');
            return;
          }
          handleTablePress(table);
        }}
      >
        <Text style={styles.createOrderButtonText}>
          {table.status === 'occupied' ? 'Manage Order' : 'Create Order'}
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        style={styles.content}
        contentContainerStyle={styles.listContent}
        data={tables}
        keyExtractor={(t, index) => `${t.id}-${index}`}
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
      {/* Reservation Modal */}
      <Modal
        visible={reservationModalVisible}
        transparent
        animationType="fade"
        onRequestClose={cancelReservationModal}
      >
        <View style={styles.reservationModalOverlay}>
          <View style={[styles.reservationModalContent, { maxHeight: 640, width: '95%', marginTop: -spacing.lg }]}> 
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Reserve Table</Text>
              <TouchableOpacity onPress={cancelReservationModal}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={{ padding: spacing.lg }}>
              <View style={styles.reservationRow}>
                <TouchableOpacity
                  style={[styles.dayToggle, resDayOffset === 0 && styles.dayToggleActive]}
                  onPress={() => setResDayOffset(0)}
                >
                  <Text style={[styles.dayToggleText, resDayOffset === 0 && styles.dayToggleTextActive]}>Today</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.dayToggle, resDayOffset === 1 && styles.dayToggleActive]}
                  onPress={() => setResDayOffset(1)}
                >
                  <Text style={[styles.dayToggleText, resDayOffset === 1 && styles.dayToggleTextActive]}>Tomorrow</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.reservationRow}>
                <Text style={styles.sectionLabel}>Select Customer</Text>
              </View>
              <View style={styles.reservationRow}>
                <TextInput
                  style={styles.textField}
                  placeholder="Search customer by name or phone"
                  value={customerSearchRes}
                  onChangeText={setCustomerSearchRes}
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
              <View style={{ marginBottom: spacing.md }}>
                {Object.values(customers as any).length === 0 ? (
                  <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>No customers found. Add customers in the Customers section.</Text>
                ) : (
                  <ScrollView style={{ maxHeight: 140 }} showsVerticalScrollIndicator>
                    {(Object.values(customers as any) as any[])
                      .filter((c: any) => {
                        const q = customerSearchRes.trim().toLowerCase();
                        if (!q) return true;
                        return ((c.name || '').toLowerCase().includes(q) || (c.phone || '').toLowerCase().includes(q));
                      })
                      .map((c: any, idx: number) => {
                        const isSelected = selectedCustomerIdRes === c.id;
                        return (
                          <TouchableOpacity
                            key={`${c.id}-${idx}`}
                            onPress={() => setSelectedCustomerIdRes(c.id)}
                            style={{
                              paddingVertical: spacing.sm,
                              paddingHorizontal: spacing.md,
                              borderRadius: radius.md,
                              borderWidth: 1,
                              borderColor: isSelected ? colors.primary : colors.outline,
                              backgroundColor: isSelected ? colors.primary + '10' : colors.surface,
                              marginBottom: spacing.xs,
                            }}
                          >
                            <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>{c.name || c.phone || 'Unnamed'}</Text>
                            {!!c.phone && (
                              <Text style={{ color: colors.textSecondary, marginTop: 2 }}>{c.phone}</Text>
                            )}
                          </TouchableOpacity>
                        );
                      })}
                  </ScrollView>
                )}
              </View>
              <View style={styles.reservationRow}>
                <Text style={styles.sectionLabel}>Note</Text>
              </View>
              <View style={styles.reservationRow}>
                <TextInput
                  style={[styles.textField, { height: 72, textAlignVertical: 'top' }]}
                  placeholder="Note (optional)"
                  value={resNote}
                  onChangeText={setResNote}
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  numberOfLines={3}
                />
              </View>
              <View style={[styles.reservationRow, { marginBottom: spacing.xs }] }>
                <TextInput
                  style={styles.timeInput}
                  placeholder="HH"
                  keyboardType="numeric"
                  value={resHour}
                  onChangeText={setResHour}
                  maxLength={2}
                  placeholderTextColor={colors.textSecondary}
                />
                <Text style={styles.colon}>:</Text>
                <TextInput
                  style={styles.timeInput}
                  placeholder="MM"
                  keyboardType="numeric"
                  value={resMinute}
                  onChangeText={setResMinute}
                  maxLength={2}
                  placeholderTextColor={colors.textSecondary}
                />
                <TouchableOpacity
                  style={[styles.ampmToggle, resAmPm === 'AM' && styles.ampmToggleActive]}
                  onPress={() => setResAmPm('AM')}
                >
                  <Text style={[styles.ampmText, resAmPm === 'AM' && styles.ampmTextActive]}>AM</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.ampmToggle, resAmPm === 'PM' && styles.ampmToggleActive]}
                  onPress={() => setResAmPm('PM')}
                >
                  <Text style={[styles.ampmText, resAmPm === 'PM' && styles.ampmTextActive]}>PM</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={[styles.reservationActions, { paddingHorizontal: spacing.lg, marginTop: 0, paddingBottom: 0 }]}>
              <TouchableOpacity style={styles.reservationCancel} onPress={cancelReservationModal}>
                <Text style={styles.reservationCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.reservationConfirm} onPress={confirmReservation}>
                <Text style={styles.reservationConfirmText}>Reserve</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {/* Themed Actions Modal (Long-press on Reserved Table) */}
      <Modal
        visible={actionsModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setActionsModalVisible(false)}
      >
        <View style={styles.reservationModalOverlay}>
          <View style={styles.reservationModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Table Options</Text>
              <TouchableOpacity onPress={() => setActionsModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={{ padding: spacing.lg }}>
              <View style={styles.actionsList}>
                <TouchableOpacity
                  style={[styles.actionItem, { marginBottom: spacing.xs }]}
                  onPress={() => {
                    if (actionsTableId) {
                      setDetailsTableId(actionsTableId);
                      setDetailsModalVisible(true);
                    }
                    setActionsModalVisible(false);
                  }}
                >
                  <Ionicons name="information-circle-outline" size={20} color={colors.textPrimary} style={styles.actionIcon} />
                  <Text style={styles.actionItemText}>See details</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionItem, styles.actionItemDestructive]}
                  onPress={() => {
                    if (!actionsTableId) { setActionsModalVisible(false); return; }
                    Alert.alert(
                      'Unreserve Table',
                      'Are you sure you want to remove this reservation?',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Unreserve', style: 'destructive', onPress: () => dispatch(unreserveTable({ id: actionsTableId })) },
                      ]
                    );
                    setActionsModalVisible(false);
                  }}
                >
                  <Ionicons name="trash-outline" size={20} color={colors.danger} style={styles.actionIcon} />
                  <Text style={[styles.actionItemText, { color: colors.danger }]}>Unreserve</Text>
                </TouchableOpacity>
              </View>
              <View style={[styles.reservationActions, { marginTop: spacing.md }] }>
                <TouchableOpacity style={styles.reservationCancel} onPress={() => setActionsModalVisible(false)}>
                  <Text style={styles.reservationCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
      {/* Reservation Details Modal */}
      <Modal
        visible={detailsModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDetailsModalVisible(false)}
      >
        <View style={styles.reservationModalOverlay}>
          <View style={styles.reservationModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Reservation Details</Text>
              <TouchableOpacity onPress={() => setDetailsModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ padding: spacing.lg }} showsVerticalScrollIndicator={false}>
              {(() => {
                const t: any = activeTables.find(tt => tt.id === detailsTableId) as any;
                if (!t) return <Text style={{ color: colors.textSecondary }}>Table not found.</Text>;
                const tableName = t.name || detailsTableId;
                const reservedBy = t.reservedBy || 'Unknown';
                const note = t.reservedNote || '-';
                const reservedAt = t.reservedAt ? new Date(t.reservedAt).toLocaleString() : '-';
                const reservedUntil = t.reservedUntil ? new Date(t.reservedUntil).toLocaleString() : '-';
                return (
                  <View>
                    <Text style={{ color: colors.textPrimary, fontWeight: '700', marginBottom: spacing.sm }}>{tableName}</Text>
                    <View style={styles.reservationRow}><Text style={{ color: colors.textSecondary }}>Customer</Text><Text style={{ color: colors.textPrimary, fontWeight: '600' }}>{reservedBy}</Text></View>
                    <View style={styles.reservationRow}><Text style={{ color: colors.textSecondary }}>Note</Text><Text style={{ color: colors.textPrimary, flexShrink: 1, textAlign: 'right' }}>{note}</Text></View>
                    <View style={styles.reservationRow}><Text style={{ color: colors.textSecondary }}>Reserved At</Text><Text style={{ color: colors.textPrimary }}>{reservedAt}</Text></View>
                    <View style={styles.reservationRow}><Text style={{ color: colors.textSecondary }}>Reserved Until</Text><Text style={{ color: colors.textPrimary }}>{reservedUntil}</Text></View>
                  </View>
                );
              })()}
            </ScrollView>
            <View style={[styles.reservationActions, { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg }]}>
              <TouchableOpacity style={styles.reservationCancel} onPress={() => setDetailsModalVisible(false)}>
                <Text style={styles.reservationCancelText}>Close</Text>
              </TouchableOpacity>
              {detailsTableId && (
                <TouchableOpacity style={styles.reservationConfirm} onPress={() => { dispatch(unreserveTable({ id: detailsTableId as string })); setDetailsModalVisible(false); }}>
                  <Text style={styles.reservationConfirmText}>Unreserve</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
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
  tableCardReserved: {
    opacity: 0.6,
    borderColor: colors.warning,
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
  remainingTime: {
    color: colors.warning,
    fontSize: 12,
    marginBottom: spacing.sm,
  },
  createOrderButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  createOrderButtonDisabled: {
    backgroundColor: colors.textMuted,
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
  reservationModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reservationModalContent: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    width: '90%',
    padding: spacing.lg,
    ...shadow.card,
  },
  reservationTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  reservationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  dayToggle: {
    flex: 1,
    paddingVertical: spacing.sm,
    marginHorizontal: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.outline,
    alignItems: 'center',
  },
  dayToggleActive: {
    backgroundColor: colors.primary + '10',
    borderColor: colors.primary,
  },
  dayToggleText: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  dayToggleTextActive: {
    color: colors.primary,
  },
  timeInput: {
    width: 60,
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: radius.md,
    padding: spacing.sm,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  colon: {
    color: colors.textPrimary,
    marginHorizontal: spacing.xs,
    fontSize: 18,
    fontWeight: 'bold',
  },
  ampmToggle: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.outline,
    marginLeft: spacing.xs,
  },
  ampmToggleActive: {
    backgroundColor: colors.info + '10',
    borderColor: colors.info,
  },
  ampmText: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  ampmTextActive: {
    color: colors.info,
  },
  reservationActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  reservationCancel: {
    flex: 1,
    marginRight: spacing.xs,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  reservationCancelText: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  reservationConfirm: {
    flex: 1,
    marginLeft: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  reservationConfirmText: {
    color: 'white',
    fontWeight: '700',
  },
  sectionLabel: {
    color: colors.textSecondary,
    fontWeight: '700',
  },
  textField: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: radius.md,
    padding: spacing.sm,
    color: colors.textPrimary,
    backgroundColor: colors.background,
  },
  actionsList: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  actionItemDestructive: {
    backgroundColor: colors.danger + '10',
  },
  actionIcon: {
    marginRight: spacing.sm,
  },
  actionItemText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  // Shared modal header styles for consistency
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.outline,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
});

export default TablesDashboardScreen;
