import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, shadow } from '../../theme';
import { RootState } from '../../redux/store';
import { PrintService } from '../../services/printing';
import { blePrinter } from '../../services/blePrinter';
import { removeItem, updateItemQuantity, markOrderSaved, snapshotSavedQuantities, cancelOrder, changeOrderTable, applyDiscount, setOrderCustomer } from '../../redux/slices/ordersSlice';
// Removed direct customer mutations here; selection will use existing customers only
import { unmergeTables } from '../../redux/slices/tablesSlice';
import MergeTableModal from '../../components/MergeTableModal';
import * as Sharing from 'expo-sharing';

interface RouteParams {
  orderId: string;
  tableId: string;
}

const OrderConfirmationScreen: React.FC = () => {
  const [modificationNotes, setModificationNotes] = useState('');
  const [printModalVisible, setPrintModalVisible] = useState(false);
  const [isPreReceiptFlow, setIsPreReceiptFlow] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [mergeTableModalVisible, setMergeTableModalVisible] = useState(false);
  const [changeTableModalVisible, setChangeTableModalVisible] = useState(false);
  const [discountModalVisible, setDiscountModalVisible] = useState(false);
  const [discountType, setDiscountType] = useState<'percentage' | 'amount'>('percentage');
  const [discountValue, setDiscountValue] = useState<string>('');
  const [assignCustomerModalVisible, setAssignCustomerModalVisible] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  // Removed local saved state; rely on Redux flag directly
  
  const navigation = useNavigation();
  const route = useRoute();
  const dispatch = useDispatch();
  
  const { orderId, tableId } = route.params as RouteParams;
  const order = useSelector((state: RootState) => state.orders.ordersById[orderId]);
  const tables = useSelector((state: RootState) => state.tables.tablesById || {});
  const customersById = useSelector((state: RootState) => (state as any).customers?.customersById || {});
  const menuItems = useSelector((state: RootState) => state.menu.itemsById);
  const allOrdersById = useSelector((state: RootState) => state.orders.ordersById);

  if (!order) {
    return null;
  }

  // Derive saved status directly from Redux store
  const orderIsSaved = !!(order as any).isSaved;

  // Compute deltas
  const savedQuantities: Record<string, number> = (order as any)?.savedQuantities || {};
  const hasDelta = (order.items || []).some(
    (i: any) => (i.quantity - (savedQuantities[i.menuItemId] || 0)) > 0
  );

  const isSaveEnabled = hasDelta && order.items.length > 0;
  const isSettleEnabled = orderIsSaved && !hasDelta;

  const actualTableId = order.isMergedOrder ? order.tableId : tableId;
  const actualTable = tables[actualTableId];
  const isMergedOrder = order.isMergedOrder;
  const mergedTableInfo = isMergedOrder ? actualTable : null;
  
  const orderWithOrderTypes = {
    ...order,
    items: order.items.map((item: any) => ({
      ...item,
      orderType: item.orderType || menuItems[item.menuItemId]?.orderType || 'KOT'
    }))
  };

  const calculateSubtotal = () => orderWithOrderTypes.items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const percent = orderWithOrderTypes.discountPercentage || 0;
    const discountAmt = subtotal * (percent / 100);
    return Math.max(0, subtotal - discountAmt);
  };

  const handleIncreaseQuantity = (item: any) => {
    const newQuantity = item.quantity + 1;
    (dispatch as any)(updateItemQuantity({ orderId, menuItemId: item.menuItemId, quantity: newQuantity }));
  };

  const handleDecreaseQuantity = (item: any) => {
    const newQuantity = Math.max(0, item.quantity - 1);
    if (newQuantity === 0) {
      (dispatch as any)(removeItem({ orderId, menuItemId: item.menuItemId }));
    } else {
      (dispatch as any)(updateItemQuantity({ orderId, menuItemId: item.menuItemId, quantity: newQuantity }));
    }
  };

  // Save only opens modal; saved state is set after print/save/continue
  const handleSaveOrder = () => {
    if (!isSaveEnabled) {
      Alert.alert('No new items', 'Add items before saving the order.');
      return;
    }
    setPrintModalVisible(true);
  };

  const finalizeSave = () => {
    try { (dispatch as any)(markOrderSaved({ orderId })); } catch {}
    try { (dispatch as any)(snapshotSavedQuantities({ orderId })); } catch {}
    // Redirect to Ongoing Orders after saving
    try {
      (navigation as any).navigate('Orders', { screen: 'OngoingOrders', params: { tableId: actualTableId } });
    } catch {}
  };

  const handlePrint = async () => {
    try {
      const savedQuantitiesLocal: Record<string, number> = (order as any)?.savedQuantities || {};
      const deltaItems = orderWithOrderTypes.items
        .map((i: any) => ({ ...i, delta: i.quantity - (savedQuantitiesLocal[i.menuItemId] || 0) }))
        .filter((i: any) => i.delta > 0)
        .map((i: any) => ({ ...i, quantity: i.delta }));

      const orderDelta = { ...orderWithOrderTypes, items: deltaItems } as any;

      const result = await PrintService.printCombinedTicketsFromOrder(orderDelta, actualTable);
      if (result.success) {
        finalizeSave();
        setPrintModalVisible(false);
      } else {
        Alert.alert(
          'Print Failed', 
          result.message,
          [
            { text: 'Try Again', onPress: () => handlePrint() },
            { text: 'Continue without printing', onPress: () => { finalizeSave(); setPrintModalVisible(false); } }
          ] as any
        );
      }
    } catch (error: any) {
      Alert.alert(
        'Error', 
        `Failed to print tickets: ${error.message}`,
        [
          { text: 'Try Again', onPress: () => handlePrint() },
          { text: 'Continue without printing', onPress: () => { finalizeSave(); setPrintModalVisible(false); } }
        ]
      );
    }
  };

  const handlePrintPreReceipt = async () => {
    const subtotal = orderWithOrderTypes.items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
    const discount = subtotal * ((orderWithOrderTypes.discountPercentage || 0) / 100);
    const total = Math.max(0, subtotal - discount);
    const receipt = {
      receiptId: `PR${Date.now()}`,
      date: new Date(orderWithOrderTypes.createdAt).toLocaleDateString(),
      time: new Date(orderWithOrderTypes.createdAt).toLocaleTimeString(),
      tableNumber: actualTable?.name || orderWithOrderTypes.tableId,
      customerName: (order as any)?.customerName || (order as any)?.customerPhone || 'Guest',
      items: orderWithOrderTypes.items.map((i: any) => ({ name: i.name, quantity: i.quantity, price: i.price, total: i.price * i.quantity })),
      subtotal,
      tax: 0,
      serviceCharge: 0,
      discount,
      total,
      paymentMethod: 'Pending',
      cashier: 'POS System',
    } as any;
    // Themed modal for pre-receipt actions
    setIsPreReceiptFlow(true);
    setPrintModalVisible(true);
  };

  const handleSettlePayment = () => {
    (navigation as any).navigate('Payment', { orderId, tableId, totalAmount: calculateTotal() });
  };

  const renderOrderItem = (item: any, index: number) => (
    <View key={`${item.menuItemId}-${index}`} style={styles.orderItem}>
      <View style={styles.orderItemInfo}>
        <Text style={styles.orderItemName}>{item.name}</Text>
        <Text style={styles.orderItemPrice}>Rs {item.price.toFixed(2)}</Text>
      </View>
      <View style={styles.quantityControls}>
        <TouchableOpacity style={styles.quantityButton} onPress={() => handleDecreaseQuantity(item)} activeOpacity={0.7}>
          <Ionicons name="remove-circle" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.quantityText}>{item.quantity}</Text>
        <TouchableOpacity style={styles.quantityButton} onPress={() => handleIncreaseQuantity(item)} activeOpacity={0.7}>
          <Ionicons name="add-circle" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Order for {actualTable?.name || `Table ${actualTableId.slice(-6)}`}</Text>
        <Text style={styles.subtitle}>Customer: {(order as any).customerName || (order as any).customerPhone || 'Guest'}</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Current Order</Text>
            <View style={styles.sectionActions}>
              <TouchableOpacity style={styles.actionButton} onPress={handlePrintPreReceipt} activeOpacity={0.7} accessibilityLabel="Print Pre-Receipt">
                <Ionicons name="print" size={20} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton} onPress={() => setShowOptionsMenu(!showOptionsMenu)}>
                <Ionicons name="ellipsis-vertical" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {showOptionsMenu && (
            <View style={styles.optionsMenu}>
              {/* Add Items */}
              <TouchableOpacity style={styles.optionsMenuItem} onPress={() => { setShowOptionsMenu(false); (navigation as any).navigate('Orders', { screen: 'OrderTaking', params: { orderId, tableId } }); }}>
                  <Ionicons name="add-circle" size={16} color={colors.primary} />
                <Text style={styles.optionsMenuText}>Add Items</Text>
                </TouchableOpacity>
              {/* Merge Table */}
              <TouchableOpacity style={styles.optionsMenuItem} onPress={() => { setMergeTableModalVisible(true); setShowOptionsMenu(false); }}>
                <Ionicons name="git-merge" size={16} color={colors.textPrimary} />
                <Text style={styles.optionsMenuText}>Merge Table</Text>
                </TouchableOpacity>
              {/* Change Table */}
              <TouchableOpacity
                style={[styles.optionsMenuItem, isMergedOrder && { opacity: 0.5 }]}
                disabled={isMergedOrder}
                onPress={() => {
                  if (isMergedOrder) { Alert.alert('Unavailable', 'Cannot change table for merged orders.'); return; }
                  setShowOptionsMenu(false);
                  setChangeTableModalVisible(true);
                }}
              >
                <Ionicons name="swap-horizontal" size={16} color={colors.textPrimary} />
                <Text style={styles.optionsMenuText}>Change Table</Text>
                </TouchableOpacity>
              {/* Assign Customer */}
              <TouchableOpacity style={styles.optionsMenuItem} onPress={() => { setShowOptionsMenu(false); setAssignCustomerModalVisible(true); }}>
                <Ionicons name="person" size={16} color={colors.textPrimary} />
                <Text style={styles.optionsMenuText}>Assign Customer</Text>
                </TouchableOpacity>
              {/* Apply Discount */}
              <TouchableOpacity style={styles.optionsMenuItem} onPress={() => { setShowOptionsMenu(false); setDiscountModalVisible(true); }}>
                <Ionicons name="pricetag" size={16} color={colors.primary} />
                <Text style={styles.optionsMenuText}>Apply Discount</Text>
              </TouchableOpacity>
              {/* Removed Print Tickets / Save & Share per request */}
              {/* Go to Ongoing Orders */}
              <TouchableOpacity style={styles.optionsMenuItem} onPress={() => { (navigation as any).navigate('Orders', { screen: 'OngoingOrders', params: { tableId: actualTableId } }); setShowOptionsMenu(false); }}>
                <Ionicons name="list-outline" size={16} color={colors.textPrimary} />
                <Text style={styles.optionsMenuText}>Go to Ongoing Orders</Text>
              </TouchableOpacity>
              {/* Divider before destructive action */}
              <View style={{ height: 1, backgroundColor: colors.outline, marginVertical: spacing.xs }} />
              {/* Cancel Order (last) */}
              <TouchableOpacity style={styles.optionsMenuItem} onPress={() => { 
                Alert.alert('Cancel Order', 'Are you sure you want to cancel this order?', [
                  { text: 'No', style: 'cancel' },
                  { text: 'Yes, Cancel', style: 'destructive', onPress: () => { 
                    try { 
                      // If this was a merged order, unmerge the table so originals are reactivated
                      const isMerged = !!order.isMergedOrder && !!tables[order.tableId]?.isMerged;
                      if (isMerged) {
                        (dispatch as any)(unmergeTables({ mergedTableId: order.tableId }));
                      }
                      (dispatch as any)(cancelOrder({ orderId })); 
                    } catch {}
                    (navigation as any).navigate('Orders', { screen: 'OngoingOrders' }); 
                  } }
                ]);
                setShowOptionsMenu(false);
              }}>
                <Ionicons name="trash-outline" size={16} color={colors.danger} />
                <Text style={[styles.optionsMenuText, { color: colors.danger }]}>Cancel Order</Text>
            </TouchableOpacity>
            </View>
          )}

          {orderWithOrderTypes.items.map((item: any, index: number) => renderOrderItem(item, index))}

          <View style={styles.divider} />

          <View style={styles.notesSection}>
            <Text style={styles.notesTitle}>Modification Notes</Text>
            <TextInput style={styles.notesInput} placeholder="e.g. Extra spicy, no onions" placeholderTextColor={colors.textSecondary} value={modificationNotes} onChangeText={setModificationNotes} multiline numberOfLines={3} />
          </View>

          <View style={styles.summarySection}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal:</Text>
              <Text style={styles.summaryValue}>Rs {calculateSubtotal().toFixed(2)}</Text>
            </View>
            {!!orderWithOrderTypes.discountPercentage && orderWithOrderTypes.discountPercentage > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Discount ({orderWithOrderTypes.discountPercentage}%):</Text>
                <Text style={styles.summaryValue}>- Rs {(calculateSubtotal() * (orderWithOrderTypes.discountPercentage / 100)).toFixed(2)}</Text>
              </View>
            )}
            <View style={styles.summaryRowTotal}>
              <Text style={styles.summaryLabelTotal}>Total:</Text>
              <Text style={styles.summaryValueTotal}>Rs {calculateTotal().toFixed(2)}</Text>
            </View>
          </View>

          <View style={styles.actionButtons}>
            <TouchableOpacity style={[styles.saveOrderButton, (!isSaveEnabled) && styles.saveOrderButtonDisabled]} onPress={handleSaveOrder} disabled={!isSaveEnabled}>
              <Ionicons name="document" size={20} color="white" style={styles.buttonIcon} />
              <Text style={styles.saveOrderButtonText}>Save Order</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={[styles.settlePaymentButton, (!isSettleEnabled) && styles.settlePaymentButtonDisabled]} onPress={() => { if (!isSettleEnabled) { Alert.alert('Save order first', 'Save the new items before settling payment.'); return; } handleSettlePayment(); }} disabled={!isSettleEnabled}>
              <Ionicons name="card" size={20} color="white" style={styles.buttonIcon} />
              <Text style={styles.settlePaymentButtonText}>Settle Payment</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <Modal visible={printModalVisible} animationType="slide" transparent={true} onRequestClose={() => { setPrintModalVisible(false); setIsPreReceiptFlow(false); }}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Confirmation</Text>
              <TouchableOpacity style={styles.closeButton} onPress={() => { setPrintModalVisible(false); setIsPreReceiptFlow(false); }}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalDescription}>
              {isPreReceiptFlow ? 'Are you sure you want to print the Pre-Receipt?' : 'Are you sure you want to print the KOT/BOT?'}
            </Text>
            <View style={styles.modalActions}>
              {isPreReceiptFlow ? (
                <>
                  <TouchableOpacity style={styles.printButton} onPress={async () => {
                    try {
                      const res = await PrintService.printPreReceiptFromOrder(orderWithOrderTypes, actualTable);
                      if (!res.success) {
                        Alert.alert('Pre-Receipt Print Failed', res.message);
                      }
                    } catch (e: any) {
                      Alert.alert('Pre-Receipt Error', e?.message || 'Failed to print pre-receipt');
                    } finally {
                      setPrintModalVisible(false);
                      setIsPreReceiptFlow(false);
                    }
                  }}>
                    <Text style={styles.printButtonText}>Print</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.saveButton} onPress={async () => {
                    try {
                      const subtotal = orderWithOrderTypes.items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
                      const discount = subtotal * ((orderWithOrderTypes.discountPercentage || 0) / 100);
                      const total = Math.max(0, subtotal - discount);
                      const receipt = {
                        receiptId: `PR${Date.now()}`,
                        date: new Date(orderWithOrderTypes.createdAt).toLocaleDateString(),
                        time: new Date(orderWithOrderTypes.createdAt).toLocaleTimeString(),
                        tableNumber: actualTable?.name || orderWithOrderTypes.tableId,
                        customerName: (order as any)?.customerName || (order as any)?.customerPhone || 'Guest',
                        items: orderWithOrderTypes.items.map((i: any) => ({ name: i.name, quantity: i.quantity, price: i.price, total: i.price * i.quantity })),
                        subtotal,
                        tax: 0,
                        serviceCharge: 0,
                        discount,
                        total,
                        paymentMethod: 'Pending',
                        cashier: 'POS System',
                      } as any;
                      const saved = await PrintService.saveReceiptAsFile(receipt);
                      if (saved.success && saved.fileUri && (await Sharing.isAvailableAsync())) {
                        await Sharing.shareAsync(saved.fileUri, { mimeType: 'application/pdf', dialogTitle: 'Share Pre-Receipt' });
                      }
                    } catch {}
                    setPrintModalVisible(false);
                    setIsPreReceiptFlow(false);
                  }}>
                    <Text style={styles.saveButtonText}>Save</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity style={styles.printButton} onPress={handlePrint}>
                    <Text style={styles.printButtonText}>Print</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.saveButton} onPress={async () => {
                    try {
                      const savedQuantitiesLocal: Record<string, number> = (order as any)?.savedQuantities || {};
                      const deltaItems = orderWithOrderTypes.items
                        .map((i: any) => ({ ...i, delta: i.quantity - (savedQuantitiesLocal[i.menuItemId] || 0) }))
                        .filter((i: any) => i.delta > 0)
                        .map((i: any) => ({ ...i, quantity: i.delta }));
                      const ticketData = {
                        ticketId: `TKT-${Date.now()}`,
                        date: new Date(orderWithOrderTypes.createdAt).toLocaleDateString(),
                        time: new Date(orderWithOrderTypes.createdAt).toLocaleTimeString(),
                        table: actualTable?.name || orderWithOrderTypes.tableId,
                        items: deltaItems.map((item: any) => ({ name: item.name, quantity: item.quantity, price: item.price, orderType: item.orderType })),
                        estimatedTime: '20-30 minutes',
                        specialInstructions: orderWithOrderTypes.specialInstructions
                      };
                      await PrintService.saveTicketAsFile(ticketData, 'COMBINED');
                      finalizeSave();
                      setPrintModalVisible(false);
                    } catch {
                      setPrintModalVisible(false);
                    }
                  }}>
                    <Text style={styles.saveButtonText}>Save</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
                         </View>
      </Modal>

      {/* Apply Discount Modal */}
      <Modal visible={discountModalVisible} animationType="slide" transparent onRequestClose={() => setDiscountModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Apply Discount</Text>
              <TouchableOpacity style={styles.closeButton} onPress={() => setDiscountModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalDescription}>Choose discount type and enter a value.</Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
              <TouchableOpacity onPress={() => setDiscountType('percentage')} style={{ flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: discountType === 'percentage' ? colors.primary : colors.outline, backgroundColor: discountType === 'percentage' ? colors.primary + '10' : colors.surface }}>
                <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>Percentage (%)</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setDiscountType('amount')} style={{ flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: discountType === 'amount' ? colors.primary : colors.outline, backgroundColor: discountType === 'amount' ? colors.primary + '10' : colors.surface }}>
                <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>Amount (Rs)</Text>
              </TouchableOpacity>
            </View>
            <View style={{ marginBottom: spacing.md }}>
              <Text style={styles.modalDescription}>Value</Text>
              <TextInput
                style={{ borderWidth: 1, borderColor: colors.outline, borderRadius: radius.md, padding: spacing.md, color: colors.textPrimary, backgroundColor: colors.background }}
                keyboardType="numeric"
                placeholder={discountType === 'percentage' ? 'e.g., 10' : 'e.g., 100'}
                placeholderTextColor={colors.textSecondary}
                value={discountValue}
                onChangeText={setDiscountValue}
              />
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.saveButton} onPress={() => {
                const value = parseFloat(discountValue);
                const subtotal = calculateSubtotal();
                if (isNaN(value) || value < 0) { Alert.alert('Invalid', 'Enter a valid discount value'); return; }
                let percent = 0;
                if (discountType === 'percentage') {
                  percent = Math.min(100, value);
                } else {
                  const clamped = Math.min(subtotal, value);
                  percent = subtotal > 0 ? (clamped / subtotal) * 100 : 0;
                }
                try { (dispatch as any)(applyDiscount({ orderId, discountPercentage: Number(percent.toFixed(4)) })); } catch {}
                setDiscountModalVisible(false);
                setDiscountValue('');
              }}>
                <Text style={styles.saveButtonText}>Apply</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setDiscountModalVisible(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Assign Customer Modal */}
      <Modal visible={assignCustomerModalVisible} animationType="slide" transparent onRequestClose={() => setAssignCustomerModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Assign Customer</Text>
              <TouchableOpacity style={styles.closeButton} onPress={() => setAssignCustomerModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            {/* Search */}
            <View style={{ marginBottom: spacing.md }}>
              <Text style={styles.modalDescription}>Search Customers</Text>
              <TextInput
                style={{ borderWidth: 1, borderColor: colors.outline, borderRadius: radius.md, padding: spacing.md, color: colors.textPrimary, backgroundColor: colors.background }}
                placeholder="Search by name or phone"
                placeholderTextColor={colors.textSecondary}
                value={customerSearch}
                onChangeText={(t) => setCustomerSearch(t)}
              />
            </View>
            {/* Customer List */}
            <View style={{ maxHeight: 280, marginBottom: spacing.md }}>
              {Object.values(customersById as any).length === 0 ? (
                <Text style={{ color: colors.textSecondary }}>No customers found. Add customers in the Customers section first.</Text>
              ) : (
                <ScrollView>
                  {Object.values(customersById as any)
                    .filter((c: any) => {
                      const q = customerSearch.trim().toLowerCase();
                      if (!q) return true;
                      return (
                        (c.name || '').toLowerCase().includes(q) ||
                        (c.phone || '').toLowerCase().includes(q)
                      );
                    })
                    .map((c: any) => {
                      const isSelected = selectedCustomerId === c.id;
                      return (
                        <TouchableOpacity
                          key={c.id}
                          onPress={() => setSelectedCustomerId(c.id)}
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
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.saveButton, !selectedCustomerId && { opacity: 0.6 }]}
                disabled={!selectedCustomerId}
                onPress={() => {
                  if (!selectedCustomerId) { return; }
                  const customer = (customersById as any)[selectedCustomerId];
                  if (!customer) { Alert.alert('Error', 'Customer not found'); return; }
                  try { (dispatch as any)(setOrderCustomer({ orderId, customerName: customer.name, customerPhone: customer.phone })); } catch {}
                  setAssignCustomerModalVisible(false);
                  setCustomerSearch('');
                  setSelectedCustomerId(null);
                }}
              >
                <Text style={styles.saveButtonText}>Assign</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelButton} onPress={() => { setAssignCustomerModalVisible(false); setCustomerSearch(''); setSelectedCustomerId(null); }}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {/* Change Table Modal */}
      <Modal visible={changeTableModalVisible} animationType="slide" transparent onRequestClose={() => setChangeTableModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Change Table</Text>
              <TouchableOpacity style={styles.closeButton} onPress={() => setChangeTableModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalDescription}>Select an available table to move this order.</Text>
            <View style={{ gap: spacing.xs }}>
              {Object.values(tables)
                .filter((t: any) => t && t.isActive && !t.isMerged)
                .map((t: any) => {
                  const isCurrent = t.id === actualTableId;
                  const isReserved = (t as any).isReserved;
                  const isOccupied = Object.values(allOrdersById).some((o: any) => o && o.status === 'ongoing' && o.tableId === t.id && o.id !== orderId);
                  const disabled = isCurrent || isReserved || isOccupied;
                  return (
                    <TouchableOpacity
                      key={t.id}
                      disabled={disabled}
                      onPress={() => {
                        (dispatch as any)(changeOrderTable({ orderId, newTableId: t.id }));
                        setChangeTableModalVisible(false);
                        (navigation as any).setParams({ tableId: t.id });
                      }}
                      style={{
                        paddingVertical: spacing.sm,
                        paddingHorizontal: spacing.md,
                        borderRadius: radius.md,
                        borderWidth: 1,
                        borderColor: isCurrent ? colors.info : isReserved ? colors.warning : isOccupied ? colors.danger : colors.outline,
                        backgroundColor: isCurrent ? colors.info + '10' : isReserved ? colors.warning + '10' : isOccupied ? colors.danger + '10' : colors.surface,
                        opacity: disabled ? 0.8 : 1,
                      }}
                    >
                      <Text style={{ color: colors.textPrimary }}>
                        {t.name} {isCurrent ? '(Current)' : isReserved ? '(Reserved)' : isOccupied ? '(Occupied)' : ''}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
            </View>
          </View>
        </View>
      </Modal>

      <MergeTableModal visible={mergeTableModalVisible} onClose={() => setMergeTableModalVisible(false)} baseTableId={actualTableId} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { backgroundColor: colors.background, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.outline },
  title: { fontSize: 24, fontWeight: 'bold', color: colors.textPrimary, marginBottom: spacing.xs },
  subtitle: { fontSize: 16, color: colors.textSecondary },
  content: { flex: 1, padding: spacing.md },
  section: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: colors.textPrimary },
  sectionActions: { flexDirection: 'row', gap: spacing.sm },
  actionButton: { padding: spacing.sm },
  optionsMenu: { position: 'absolute', right: spacing.md, top: 60, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.outline, ...shadow.card, paddingVertical: spacing.xs, width: 220, zIndex: 10 },
  optionsMenuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, gap: spacing.sm },
  optionsMenuText: { color: colors.textPrimary, fontSize: 14 },
  divider: { height: 1, backgroundColor: colors.outline, marginVertical: spacing.lg },
  notesSection: { marginBottom: spacing.lg },
  notesTitle: { fontSize: 18, fontWeight: 'bold', color: colors.textPrimary, marginBottom: spacing.sm },
  notesInput: { backgroundColor: colors.surface2, borderRadius: radius.md, padding: spacing.md, fontSize: 16, color: colors.textPrimary, borderWidth: 1, borderColor: colors.outline, textAlignVertical: 'top', minHeight: 80 },
  summarySection: { backgroundColor: colors.surface2, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  summaryRowTotal: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.outline },
  summaryLabel: { fontSize: 16, color: colors.textSecondary },
  summaryLabelTotal: { fontSize: 18, fontWeight: '600', color: colors.textPrimary },
  summaryValue: { fontSize: 16, color: colors.textPrimary, fontWeight: '500' },
  summaryValueTotal: { fontSize: 20, fontWeight: 'bold', color: colors.success },
  actionButtons: { gap: spacing.md },
  saveOrderButton: { backgroundColor: colors.primary, paddingVertical: spacing.md, borderRadius: radius.md, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  saveOrderButtonDisabled: { backgroundColor: colors.textMuted },
  saveOrderButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  settlePaymentButton: { backgroundColor: colors.surface2, paddingVertical: spacing.md, borderRadius: radius.md, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', borderWidth: 1, borderColor: colors.outline },
  settlePaymentButtonDisabled: { opacity: 0.6 },
  settlePaymentButtonText: { color: colors.textPrimary, fontSize: 16, fontWeight: 'bold' },
  buttonIcon: { marginRight: spacing.sm },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, width: '80%', maxWidth: 400 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: colors.textPrimary },
  closeButton: { padding: spacing.xs },
  modalDescription: { fontSize: 14, color: colors.textSecondary, marginBottom: spacing.lg, lineHeight: 20 },
  modalActions: { gap: spacing.sm },
  printButton: { backgroundColor: colors.primary, paddingVertical: spacing.sm, borderRadius: radius.md, alignItems: 'center' },
  printButtonText: { color: 'white', fontSize: 14, fontWeight: 'bold' },
  saveButton: { backgroundColor: colors.surface2, paddingVertical: spacing.sm, borderRadius: radius.md, alignItems: 'center', borderWidth: 1, borderColor: colors.outline },
  saveButtonText: { color: colors.textPrimary, fontSize: 14, fontWeight: 'bold' },
  cancelButton: { backgroundColor: colors.surface2, paddingVertical: spacing.sm, borderRadius: radius.md, alignItems: 'center' },
  cancelButtonText: { color: colors.textPrimary, fontSize: 14, fontWeight: 'bold' },
  // Restored current order items styling
  orderItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.outline },
  orderItemInfo: { flex: 1 },
  orderItemName: { fontSize: 18, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.xs },
  orderItemPrice: { fontSize: 16, color: colors.success },
  quantityControls: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  quantityButton: { padding: spacing.sm, backgroundColor: colors.surface2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.outline, minWidth: 40, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  quantityText: { fontSize: 18, fontWeight: 'bold', color: colors.textPrimary, minWidth: 30, textAlign: 'center' },
});

export default OrderConfirmationScreen;
