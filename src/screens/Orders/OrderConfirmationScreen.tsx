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
import { removeItem, updateItemQuantity } from '../../redux/slices/ordersSlice';
import MergeTableModal from '../../components/MergeTableModal';

interface RouteParams {
  orderId: string;
  tableId: string;
}

const OrderConfirmationScreen: React.FC = () => {
  const [modificationNotes, setModificationNotes] = useState('');
  const [printModalVisible, setPrintModalVisible] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [mergeTableModalVisible, setMergeTableModalVisible] = useState(false);
  
  const navigation = useNavigation();
  const route = useRoute();
  const dispatch = useDispatch();
  
  const { orderId, tableId } = route.params as RouteParams;
  const order = useSelector((state: RootState) => state.orders.ordersById[orderId]);
  const tables = useSelector((state: RootState) => state.tables.tablesById || {});
  const menuItems = useSelector((state: RootState) => state.menu.itemsById);

  if (!order) {
    return null;
  }

  // Merge orderType from menu items for existing orders that don't have orderType
  const orderWithOrderTypes = {
    ...order,
    items: order.items.map((item: any) => ({
      ...item,
      orderType: item.orderType || menuItems[item.menuItemId]?.orderType || 'KOT' // Default to KOT if not found
    }))
  };

  const calculateSubtotal = () => {
    return orderWithOrderTypes.items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
  };

  const calculateTotal = () => {
    return calculateSubtotal();
  };

  const hasBarProducts = () => {
    // Check if any items are bar products based on orderType
    const hasBOT = orderWithOrderTypes.items.some((item: any) => item.orderType === 'BOT');
    console.log('🔍 BOT Detection:', { 
      items: orderWithOrderTypes.items.map((i: any) => ({ name: i.name, orderType: i.orderType })),
      hasBOT 
    });
    return hasBOT;
  };

  const hasKitchenProducts = () => {
    // Check if any items are kitchen products based on orderType
    const hasKOT = orderWithOrderTypes.items.some((item: any) => item.orderType === 'KOT');
    console.log('🔍 KOT Detection:', { 
      items: orderWithOrderTypes.items.map((i: any) => ({ name: i.name, orderType: i.orderType })),
      hasKOT 
    });
    return hasKOT;
  };

  const handleIncreaseQuantity = (item: any) => {
    // Update quantity directly in the order
    const newQuantity = item.quantity + 1;
    dispatch(updateItemQuantity({ 
      orderId, 
      menuItemId: item.menuItemId, 
      quantity: newQuantity 
    }));
  };

  const handleDecreaseQuantity = (item: any) => {
    // Update quantity directly in the order
    const newQuantity = Math.max(0, item.quantity - 1);
    if (newQuantity === 0) {
      // Remove item if quantity becomes 0
      dispatch(removeItem({ orderId, menuItemId: item.menuItemId }));
    } else {
      dispatch(updateItemQuantity({ 
        orderId, 
        menuItemId: item.menuItemId, 
        quantity: newQuantity 
      }));
    }
  };

  const handlePrintKOT = async () => {
    try {
      const result = await PrintService.printKOTFromOrder(orderWithOrderTypes, tables[tableId]);
      if (result.success) {
        Alert.alert('Success', result.message);
      } else {
        Alert.alert(
          'Print Failed', 
          result.message,
          [
            {
              text: 'Continue without printing',
              onPress: () => {
                // Navigate to ongoing orders
                navigation.navigate('Orders' as any, { screen: 'OngoingOrders' } as any);
              }
            }
          ] as any
        );
      }
    } catch (error: any) {
      Alert.alert(
        'Error', 
        `Failed to print KOT: ${error.message}`,
        [
          {
            text: 'Continue without printing',
            onPress: () => {
              // Navigate to ongoing orders
              navigation.navigate('Orders' as any, { screen: 'OngoingOrders' } as any);
            }
          }
        ] as any
      );
    }
  };

  const handlePrintBOT = async () => {
    try {
      const result = await PrintService.printBOTFromOrder(orderWithOrderTypes, tables[tableId]);
      if (result.success) {
        Alert.alert('Success', result.message);
      } else {
        Alert.alert(
          'Print Failed', 
          result.message,
          [
            {
              text: 'Continue without printing',
              onPress: () => {
                // Navigate to ongoing orders
                navigation.navigate('Orders' as any, { screen: 'OngoingOrders' } as any);
              }
            }
          ] as any
        );
      }
    } catch (error: any) {
      Alert.alert(
        'Error', 
        `Failed to print BOT: ${error.message}`,
        [
          {
            text: 'Continue without printing',
            onPress: () => {
              // Navigate to ongoing orders
              navigation.navigate('Orders' as any, { screen: 'OngoingOrders' } as any);
            }
          }
        ]
      );
    }
  };

  const handlePrintPreReceipt = async () => {
    try {
      // Show printing status
      Alert.alert('Printing...', 'Generating pre-receipt for customer...');
      
      // Create pre-receipt data (customer copy before payment)
      const preReceiptData = {
        restaurantName: 'HOUSE OF HOSPITALITY',
        receiptId: `PRE-${Date.now().toString().slice(-6)}`,
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString(),
        table: tables[tableId]?.name || `Table ${tableId.slice(-6)}`,
        items: orderWithOrderTypes.items.map((item: any) => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price
        })),
        taxLabel: `Tax (${orderWithOrderTypes.taxPercentage || 0}%)`,
        serviceLabel: `Service (${orderWithOrderTypes.serviceChargePercentage || 0}%)`,
        subtotal: calculateSubtotal(),
        tax: calculateSubtotal() * ((orderWithOrderTypes.taxPercentage || 0) / 100),
        service: calculateSubtotal() * ((orderWithOrderTypes.serviceChargePercentage || 0) / 100),
        discount: calculateSubtotal() * ((orderWithOrderTypes.discountPercentage || 0) / 100),
        total: calculateTotal(),
        payment: null, // No payment info for pre-receipt
        isPreReceipt: true // Flag to indicate this is a pre-receipt
      };

      // Print pre-receipt using the same physical printer
      const result = await PrintService.printReceiptFromOrder(
        { ...orderWithOrderTypes, ...preReceiptData }, 
        tables[tableId]
      );
      
      if (result.success) {
        Alert.alert('Success', 'Pre-receipt printed successfully for customer!');
      } else {
        Alert.alert(
          'Print Failed', 
          result.message,
          [
            {
              text: 'Try Again',
              onPress: () => handlePrintPreReceipt()
            },
            {
              text: 'Continue without printing',
              style: 'cancel'
            }
          ]
        );
      }
    } catch (error: any) {
      console.error('Pre-receipt print error:', error);
      Alert.alert(
        'Print Error', 
        `Failed to print pre-receipt: ${error.message}`,
        [
          {
            text: 'Try Again',
            onPress: () => handlePrintPreReceipt()
          },
          {
            text: 'Continue without printing',
            style: 'cancel'
          }
        ]
      );
    }
  };

  const handleAssignCustomer = () => {
    setShowOptionsMenu(false);
    // Handle customer assignment
    Alert.alert('Assign Customer', 'Customer assignment feature');
  };

  const handleChangeTable = () => {
    setShowOptionsMenu(false);
    // Handle table change
    Alert.alert('Change Table', 'Table change feature');
  };

  const handleMergeTable = () => {
    setShowOptionsMenu(false);
    setMergeTableModalVisible(true);
  };

  const handleApplyDiscount = () => {
    setShowOptionsMenu(false);
    // Handle discount application
    Alert.alert('Apply Discount', 'Discount application feature');
  };

  const handleSaveOrder = () => {
    // Show print confirmation modal
    setPrintModalVisible(true);
  };

  const handlePrint = async () => {
    try {
      console.log('🖨️ Print Request:', {
        orderId: orderWithOrderTypes.id,
        items: orderWithOrderTypes.items.map((i: any) => ({ 
          name: i.name, 
          orderType: i.orderType, 
          quantity: i.quantity 
        })),
        hasKOT: hasKitchenProducts(),
        hasBOT: hasBarProducts()
      });
      
      const result = await PrintService.printCombinedTicketsFromOrder(orderWithOrderTypes, tables[tableId]);
      if (result.success) {
        Alert.alert('Success', result.message);
        setPrintModalVisible(false);
      } else {
        // Show error with fallback option
        Alert.alert(
          'Print Failed', 
          result.message,
          [
            {
              text: 'Save as File',
              onPress: async () => {
                try {
                  const ticketData = {
                    ticketId: `TKT-${Date.now()}`,
                    date: new Date(orderWithOrderTypes.createdAt).toLocaleDateString(),
                    time: new Date(orderWithOrderTypes.createdAt).toLocaleTimeString(),
                    table: tables[tableId]?.name || orderWithOrderTypes.tableId,
                    items: orderWithOrderTypes.items.map((item: any) => ({
                      name: item.name,
                      quantity: item.quantity,
                      price: item.price,
                      orderType: item.orderType
                    })),
                    estimatedTime: '20-30 minutes',
                    specialInstructions: orderWithOrderTypes.specialInstructions
                  };

                  const saveResult = await PrintService.saveTicketAsFile(ticketData, 'COMBINED');
                  if (saveResult.success) {
                    Alert.alert('Success', 'Tickets saved as file successfully!');
                  } else {
                    Alert.alert('Error', `Failed to save tickets: ${saveResult.message}`);
                  }
                  setPrintModalVisible(false);
                } catch (error: any) {
                  console.error('Save ticket failed:', error);
                  Alert.alert('Error', `Failed to save tickets: ${error.message}`);
                  setPrintModalVisible(false);
                }
              }
            },
            {
              text: 'Continue without printing',
              onPress: () => {
                setPrintModalVisible(false);
                // Navigate to ongoing orders
                navigation.navigate('Orders' as any, { screen: 'OngoingOrders' } as any);
              }
            }
          ] as any
        );
      }
    } catch (error: any) {
      console.error('❌ Print Error:', error);
      Alert.alert(
        'Error', 
        `Failed to print tickets: ${error.message}`,
        [
          {
            text: 'Try Again',
            onPress: () => handlePrint()
          },
          {
            text: 'Continue without printing',
            onPress: () => {
              setPrintModalVisible(false);
              // Navigate to ongoing orders
              navigation.navigate('Orders' as any, { screen: 'OngoingOrders' } as any);
            }
          }
        ]
      );
    }
  };

  const handleSettlePayment = () => {
    // Navigate to payment screen
    // @ts-ignore
    navigation.navigate('Orders', { screen: 'OrderManagement', params: { orderId } });
  };

  const renderOrderItem = (item: any) => (
    <View key={item.menuItemId} style={styles.orderItem}>
      <View style={styles.orderItemInfo}>
        <Text style={styles.orderItemName}>{item.name}</Text>
        <Text style={styles.orderItemPrice}>Rs {item.price.toFixed(2)}</Text>
      </View>
      <View style={styles.quantityControls}>
        <TouchableOpacity 
          style={styles.quantityButton}
          onPress={() => handleDecreaseQuantity(item)}
          activeOpacity={0.7}
        >
          <Ionicons name="remove-circle" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.quantityText}>{item.quantity}</Text>
        <TouchableOpacity 
          style={styles.quantityButton}
          onPress={() => handleIncreaseQuantity(item)}
          activeOpacity={0.7}
        >
          <Ionicons name="add-circle" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Order for {tables[tableId]?.name || `Table ${tableId.slice(-6)}`}</Text>
        <Text style={styles.subtitle}>Customer: Guest</Text>
        
        {/* Show merged table information */}
        {tables[tableId]?.isMerged && tables[tableId]?.mergedTableNames && (
          <View style={styles.mergedTableInfo}>
            <Text style={styles.mergedTableLabel}>Merged Tables:</Text>
            <Text style={styles.mergedTableNames}>
              {tables[tableId].mergedTableNames.join(' + ')}
            </Text>
            <Text style={styles.mergedTableSeats}>
              Total Seats: {tables[tableId]?.totalSeats || tables[tableId]?.seats}
            </Text>
          </View>
        )}
      </View>

      <ScrollView style={styles.content}>
        {/* Current Order Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Current Order</Text>
            <View style={styles.sectionActions}>
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={handlePrintPreReceipt}
                activeOpacity={0.7}
                accessibilityLabel="Print Pre-Receipt"
              >
                <Ionicons name="print" size={20} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => setShowOptionsMenu(!showOptionsMenu)}
              >
                <Ionicons name="ellipsis-vertical" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Options Menu */}
          {showOptionsMenu && (
            <TouchableOpacity 
              style={styles.optionsMenuOverlay}
              onPress={() => setShowOptionsMenu(false)}
              activeOpacity={1}
            >
              <TouchableOpacity 
                style={styles.optionsMenu}
                onPress={(e) => e.stopPropagation()}
                activeOpacity={1}
              >

                <TouchableOpacity 
                  style={styles.optionItem}
                  onPress={() => {
                    setShowOptionsMenu(false);
                    // @ts-ignore
                    navigation.navigate('Orders', { 
                      screen: 'OrderTaking', 
                      params: { orderId, tableId } 
                    });
                  }}
                >
                  <Ionicons name="add-circle" size={16} color={colors.primary} />
                  <Text style={styles.optionText}>Add Items</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.optionItem}
                  onPress={handlePrintKOT}
                >
                  <Ionicons name="restaurant" size={16} color={colors.textSecondary} />
                  <Text style={styles.optionText}>Print KOT/BOT</Text>
                </TouchableOpacity>
                
                {/* Separator Line */}
                <View style={styles.optionSeparator} />
                
                <TouchableOpacity 
                  style={styles.optionItem}
                  onPress={handleAssignCustomer}
                >
                  <Ionicons name="person" size={16} color={colors.textSecondary} />
                  <Text style={styles.optionText}>Assign Customer</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.optionItem}
                  onPress={handleChangeTable}
                >
                  <Ionicons name="swap-horizontal" size={16} color={colors.textSecondary} />
                  <Text style={styles.optionText}>Change Table</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.optionItem}
                  onPress={handleMergeTable}
                >
                  <Ionicons name="git-merge" size={16} color={colors.textSecondary} />
                  <Text style={styles.optionText}>Merge Table</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.optionItem}
                  onPress={handleApplyDiscount}
                >
                  <Ionicons name="pricetag" size={16} color={colors.primary} />
                  <Text style={styles.optionText}>Apply Discount</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            </TouchableOpacity>
          )}

          {/* Order Items */}
          {orderWithOrderTypes.items.map(renderOrderItem)}

          {/* Divider */}
          <View style={styles.divider} />

          {/* Modification Notes */}
          <View style={styles.notesSection}>
            <Text style={styles.notesTitle}>Modification Notes</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="e.g. Extra spicy, no onions"
              placeholderTextColor={colors.textSecondary}
              value={modificationNotes}
              onChangeText={setModificationNotes}
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Order Summary */}
          <View style={styles.summarySection}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal:</Text>
              <Text style={styles.summaryValue}>Rs {calculateSubtotal().toFixed(2)}</Text>
            </View>
            <View style={styles.summaryRowTotal}>
              <Text style={styles.summaryLabelTotal}>Total:</Text>
              <Text style={styles.summaryValueTotal}>Rs {calculateTotal().toFixed(2)}</Text>
            </View>
          </View>

          {/* KOT/BOT Indicators */}
          <View style={styles.ticketIndicators}>
            <View style={[styles.ticketIndicator, hasKitchenProducts() && styles.ticketIndicatorActiveKOT]}>
              <Ionicons 
                name="restaurant" 
                size={20} 
                color={hasKitchenProducts() ? colors.primary : colors.textSecondary} 
              />
              <Text style={[styles.ticketText, hasKitchenProducts() && styles.ticketTextActiveKOT]}>KOT</Text>
            </View>
            <View style={[styles.ticketIndicator, hasBarProducts() && styles.ticketIndicatorActiveBOT]}>
              <Ionicons 
                name="wine" 
                size={24} 
                color={hasBarProducts() ? '#ff1a1a' : colors.textSecondary} 
              />
              <Text style={[styles.ticketText, hasBarProducts() && styles.ticketTextActiveBOT]}>BOT</Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.saveOrderButton} onPress={handleSaveOrder}>
              <Ionicons name="document" size={20} color="white" style={styles.buttonIcon} />
              <Text style={styles.saveOrderButtonText}>Save Order</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.settlePaymentButton} onPress={handleSettlePayment}>
              <Ionicons name="card" size={20} color="white" style={styles.buttonIcon} />
              <Text style={styles.settlePaymentButtonText}>Settle Payment</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Print Confirmation Modal */}
      <Modal
        visible={printModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setPrintModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Print Tickets?</Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setPrintModalVisible(false)}
              >
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.modalDescription}>
              {hasKitchenProducts() && hasBarProducts() 
                ? 'Both KOT and BOT will be sent to the configured printer.'
                : hasKitchenProducts() 
                ? 'A KOT will be sent to the configured printer.'
                : hasBarProducts()
                ? 'A BOT will be sent to the configured printer.'
                : 'No items to print.'
              }
            </Text>
            
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.printButton} onPress={handlePrint}>
                <Text style={styles.printButtonText}>Print</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setPrintModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
                         </View>
      </Modal>

      {/* Merge Table Modal */}
      <MergeTableModal
        visible={mergeTableModalVisible}
        onClose={() => setMergeTableModalVisible(false)}
      />
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.outline,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  content: {
    flex: 1,
    padding: spacing.md,
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  sectionActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    padding: spacing.sm,
  },
  optionsMenuOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
  },
  optionsMenu: {
    position: 'absolute',
    top: 60,
    right: 20,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.xs,
    borderWidth: 1,
    borderColor: colors.outline,
    shadowColor: colors.textPrimary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    minWidth: 180,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    gap: spacing.sm,
    borderRadius: radius.sm,
  },
  optionText: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  optionSeparator: {
    height: 1,
    backgroundColor: colors.outline,
    marginVertical: spacing.sm,
    marginHorizontal: spacing.md,
  },
  orderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.outline,
  },
  orderItemInfo: {
    flex: 1,
  },
  orderItemName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  orderItemPrice: {
    fontSize: 16,
    color: colors.success,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  quantityButton: {
    padding: spacing.sm,
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.outline,
    minWidth: 40,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    minWidth: 30,
    textAlign: 'center',
  },

  divider: {
    height: 1,
    backgroundColor: colors.outline,
    marginVertical: spacing.lg,
  },
  notesSection: {
    marginBottom: spacing.lg,
  },
  notesTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  notesInput: {
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 16,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.outline,
    textAlignVertical: 'top',
    minHeight: 80,
  },
  summarySection: {
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  summaryRowTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.outline,
  },
  summaryLabel: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  summaryLabelTotal: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  summaryValue: {
    fontSize: 16,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  summaryValueTotal: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.success,
  },
  ticketIndicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xl,
    marginBottom: spacing.lg,
  },
  ticketIndicator: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  ticketIndicatorActiveKOT: {
    // Active state styling
  },
  ticketIndicatorActiveBOT: {
    // Active state styling
  },
  ticketText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  ticketTextActiveKOT: {
    color: colors.primary,
  },
  ticketTextActiveBOT: {
    color: '#ff1a1a', // Bright red color
    fontWeight: 'bold',
  },
  actionButtons: {
    gap: spacing.md,
  },
  saveOrderButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  saveOrderButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  settlePaymentButton: {
    backgroundColor: colors.surface2,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.outline,
  },
  settlePaymentButtonText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonIcon: {
    marginRight: spacing.sm,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    width: '80%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  closeButton: {
    padding: spacing.xs,
  },
  modalDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  modalActions: {
    gap: spacing.sm,
  },
  printButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  printButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  cancelButton: {
    backgroundColor: colors.surface2,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: 'bold',
  },
  mergedTableInfo: {
    backgroundColor: colors.primary + '10',
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  mergedTableLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  mergedTableNames: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  mergedTableSeats: {
    fontSize: 12,
    color: colors.textSecondary,
  },
});

export default OrderConfirmationScreen;
