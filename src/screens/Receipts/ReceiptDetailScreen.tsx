import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootState } from '../../redux/store';
import { colors, spacing, radius, shadow } from '../../theme';
import { blePrinter } from '../../services/blePrinter';
import { printDocument } from '../../services/printing';
import { MaterialCommunityIcons } from '@expo/vector-icons';

type ReceiptDetailNavigationProp = NativeStackNavigationProp<any, 'ReceiptsTab'>;

interface RouteParams {
  orderId: string;
}

const ReceiptDetailScreen: React.FC = () => {
  const [receiptContent, setReceiptContent] = useState<string>('');
  const [isPrinting, setIsPrinting] = useState(false);
  
  const navigation = useNavigation<ReceiptDetailNavigationProp>();
  const route = useRoute();
  
  const { orderId } = route.params as RouteParams;
  const order = useSelector((state: RootState) => state.orders.ordersById[orderId]);
  const tables = useSelector((state: RootState) => state.tables.tablesById);

  console.log('ReceiptDetailScreen - orderId received:', orderId);
  console.log('ReceiptDetailScreen - order found:', order);
  console.log('ReceiptDetailScreen - tables:', tables);

  const handleBackToSummary = () => {
    navigation.navigate('Receipts' as any, { screen: 'DailySummary' } as any);
  };

  // Generate a shorter receipt number
  const getShortReceiptId = (id: string) => {
    // Take last 3 characters and add a prefix
    const shortId = id.slice(-3);
    const date = new Date().getDate().toString().padStart(2, '0');
    const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
    return `R${month}${date}-${shortId}`;
  };

  const shortReceiptId = getShortReceiptId(orderId);

  useEffect(() => {
    if (order) {
      generateReceiptContent();
    }
  }, [order]);

  if (!order) {
    console.log('Order not found for orderId:', orderId);
    console.log('Available orders:', Object.keys(useSelector((state: RootState) => state.orders.ordersById)));
    
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={handleBackToSummary}
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.title}>Receipt Not Found</Text>
            <Text style={styles.subtitle}>Order ID: {orderId}</Text>
          </View>
        </View>
        <View style={{ padding: 20, alignItems: 'center' }}>
          <MaterialCommunityIcons name="file-document-outline" size={64} color={colors.danger} />
          <Text style={styles.errorText}>Order not found</Text>
          <Text style={{ color: colors.textSecondary, textAlign: 'center', marginTop: 10 }}>
            The order with ID "{orderId}" could not be found in the system.
          </Text>
          <TouchableOpacity 
            style={[styles.actionButton, { marginTop: 20 }]} 
            onPress={handleBackToSummary}
          >
            <Text style={styles.actionButtonText}>Back to Receipts</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const table = tables[order.tableId];
  const subtotal = order.items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
  const tax = subtotal * (order.taxPercentage / 100);
  const serviceCharge = subtotal * (order.serviceChargePercentage / 100);
  const discount = subtotal * (order.discountPercentage / 100);
  const total = subtotal + tax + serviceCharge - discount;

  const generateReceiptContent = () => {
    const content = `
RESTAURANT POS
====================
Receipt #${shortReceiptId}
Date: ${new Date(order.createdAt).toLocaleDateString()}
Time: ${new Date(order.createdAt).toLocaleTimeString()}
Table: ${table?.name || order.tableId.replace('table-', '')}
====================

ITEMS:
${order.items.map((item: any) => 
  `${item.name}
   ${item.quantity}x Rs. ${item.price.toFixed(2)} = Rs. ${(item.price * item.quantity).toFixed(2)}`
).join('\n')}

====================
Subtotal: Rs. ${subtotal.toFixed(2)}
Service Charge (${order.serviceChargePercentage}%): Rs. ${serviceCharge.toFixed(2)}
${order.discountPercentage > 0 ? `Discount (${order.discountPercentage}%): -Rs. ${discount.toFixed(2)}` : ''}
====================
TOTAL: Rs. ${total.toFixed(2)}

${order.payment ? `
PAYMENT:
Method: ${order.payment.method}
Amount Paid: Rs. ${order.payment.amountPaid.toFixed(2)}
Change: Rs. ${(order.payment.amountPaid - total).toFixed(2)}
` : ''}

Thank you for dining with us!
====================
Generated by Restaurant POS System
    `.trim();

    setReceiptContent(content);
  };

  const handlePrintReceipt = async () => {
    if (isPrinting) return; // Prevent multiple print attempts
    
    setIsPrinting(true);
    try {
      // Import PrintService
      const { PrintService } = await import('../../services/printing');
      
      // Show printing status
      Alert.alert('Printing...', 'Sending receipt to printer...');

      // Use the new PrintService method for better error handling
      const result = await PrintService.printReceiptFromOrder(order, table);
      
      if (result.success) {
        Alert.alert('Success!', result.message);
      } else {
        Alert.alert(
          'Print Failed', 
          result.message,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Share Receipt', onPress: handleShareReceipt }
          ]
        );
      }
    } catch (e: any) {
      console.error('Print error:', e);
      Alert.alert(
        'Print Error', 
        e?.message || 'Unable to print receipt. Would you like to share it instead?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Share Receipt', onPress: handleShareReceipt }
        ]
      );
    } finally {
      setIsPrinting(false);
    }
  };

  const handleShareReceipt = async () => {
    try {
      await Share.share({
        message: receiptContent,
        title: `Receipt #${shortReceiptId}`,
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to share receipt');
    }
  };

  const handleEmailReceipt = () => {
    Alert.alert('Email Receipt', 'Receipt sent to customer email successfully', [{ text: 'OK' }]);
  };

  const formatCurrency = (amount: number) => `Rs ${amount.toFixed(2)}`;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.content} 
        contentContainerStyle={[styles.scrollContent, { paddingTop: 0 }]}
        showsVerticalScrollIndicator={true}
        bounces={true}
        alwaysBounceVertical={true}
        nestedScrollEnabled={true}
        scrollEnabled={true}
      >
        {/* Receipt Paper */}
        <View style={styles.receiptPaper}>
          {/* Header Row with Print Button */}
          <View style={styles.headerRow}>
            <View style={styles.restaurantHeader}>
              <Text style={styles.restaurantName}>RESTAURANT POS</Text>
              <Text style={styles.restaurantTagline}>Fine Dining & Hospitality</Text>
            </View>
            <TouchableOpacity 
              style={[styles.printButton, isPrinting && styles.printButtonDisabled]}
              onPress={handlePrintReceipt}
              disabled={isPrinting}
            >
              <MaterialCommunityIcons 
                name={isPrinting ? "loading" : "printer"} 
                size={16} 
                color={isPrinting ? "#999" : "#FF6B35"} 
              />
            </TouchableOpacity>
          </View>

          {/* Receipt Info */}
          <View style={styles.receiptInfo}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Receipt:</Text>
              <Text style={styles.infoValue}>#{shortReceiptId}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Date:</Text>
              <Text style={styles.infoValue}>{new Date(order.createdAt).toLocaleDateString()}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Time:</Text>
              <Text style={styles.infoValue}>{new Date(order.createdAt).toLocaleTimeString()}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Table:</Text>
              <Text style={styles.infoValue}>{table?.name || order.tableId.replace('table-', '')}</Text>
            </View>
            {(
              (order.payment?.customerName && order.payment.customerName.length > 0) ||
              (order.payment?.customerPhone && order.payment.customerPhone.length > 0)
            ) && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Customer:</Text>
                <Text style={styles.infoValue}>{order.payment?.customerName || order.payment?.customerPhone}</Text>
              </View>
            )}
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Items List */}
          <View style={styles.itemsSection}>
            <Text style={styles.sectionTitle}>ORDER ITEMS</Text>
            {order.items.map((item: any, index: number) => (
              <View key={index} style={styles.itemRow}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemQuantity}>Qty: {item.quantity}</Text>
                </View>
                <View style={styles.itemPrice}>
                  <Text style={styles.itemUnitPrice}>Rs {item.price.toFixed(2)}</Text>
                  <Text style={styles.itemTotalPrice}>Rs {(item.price * item.quantity).toFixed(2)}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Bill Summary */}
          <View style={styles.billSummary}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal:</Text>
              <Text style={styles.summaryValue}>{formatCurrency(subtotal)}</Text>
            </View>
            {tax > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Tax ({order.taxPercentage}%):</Text>
                <Text style={styles.summaryValue}>{formatCurrency(tax)}</Text>
              </View>
            )}
            {serviceCharge > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Service Charge ({order.serviceChargePercentage}%):</Text>
                <Text style={styles.summaryValue}>{formatCurrency(serviceCharge)}</Text>
              </View>
            )}
            {discount > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Discount ({order.discountPercentage}%):</Text>
                <Text style={[styles.summaryValue, styles.discountValue]}>-{formatCurrency(discount)}</Text>
              </View>
            )}
          </View>

          {/* Total */}
          <View style={styles.totalSection}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>TOTAL</Text>
              <Text style={styles.totalValue}>{formatCurrency(total)}</Text>
            </View>
          </View>

          {/* Payment Info */}
          {order.payment && (
            <>
              <View style={styles.divider} />
              <View style={styles.paymentSection}>
                <Text style={styles.sectionTitle}>PAYMENT</Text>
                <View style={styles.paymentRow}>
                  <Text style={styles.paymentLabel}>Method:</Text>
                  <Text style={styles.paymentValue}>{order.payment.method}</Text>
                </View>
                <View style={styles.paymentRow}>
                  <Text style={styles.paymentLabel}>Amount Paid:</Text>
                  <Text style={styles.paymentValue}>{formatCurrency(order.payment.amountPaid)}</Text>
                </View>
                <View style={styles.paymentRow}>
                  <Text style={styles.paymentLabel}>Change:</Text>
                  <Text style={styles.paymentValue}>{formatCurrency(order.payment.amountPaid - total)}</Text>
                </View>
              </View>
            </>
          )}

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Thank you for dining with us!</Text>
            <Text style={styles.footerSubtext}>Please visit again</Text>
            <Text style={styles.generatedBy}>Generated by Restaurant POS System</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f5f5f5'
  },
  header: { 
    backgroundColor: 'white', 
    padding: spacing.md, 
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1, 
    borderBottomColor: '#e0e0e0',
    elevation: 2,
  },
  backButton: {
    padding: 0,
    marginRight: spacing.sm,
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  title: { 
    fontSize: 20, 
    fontWeight: 'bold', 
    color: colors.textPrimary, 
    marginBottom: 2 
  },
  subtitle: { 
    fontSize: 14, 
    color: colors.textSecondary 
  },
  printButton: {
    position: 'absolute',
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
  },
  printButtonContainer: {
    alignItems: 'flex-end',
    marginBottom: 20,
  },
  printButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  printButtonDisabled: {
    opacity: 0.7,
  },
  content: { 
    flex: 1, 
    paddingHorizontal: spacing.md,
    paddingTop: 16
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40, // Add bottom padding to ensure content can scroll
    paddingTop: 0
  },
  receiptPaper: { 
    backgroundColor: 'white', 
    borderRadius: 12, 
    padding: 20, 
    marginTop: 0,
    marginBottom: spacing.lg, 
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    minHeight: 800, // Ensure minimum height so content can scroll
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    position: 'relative',
  },
  restaurantHeader: {
    alignItems: 'center',
  },
  restaurantName: { 
    fontSize: 20, 
    fontWeight: 'bold', 
    color: '#2c3e50', 
    marginBottom: 4 
  },
  restaurantTagline: { 
    fontSize: 12, 
    color: '#7f8c8d' 
  },
  receiptInfo: {
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: '#7f8c8d',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: '#2c3e50',
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 15,
  },
  itemsSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 15,
    textAlign: 'center',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  itemInfo: {
    flex: 1,
    marginRight: 10,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 4,
  },
  itemQuantity: {
    fontSize: 13,
    color: '#7f8c8d',
  },
  itemPrice: {
    alignItems: 'flex-end',
  },
  itemUnitPrice: {
    fontSize: 13,
    color: '#7f8c8d',
    marginBottom: 2,
  },
  itemTotalPrice: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  billSummary: {
    marginBottom: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#7f8c8d',
  },
  summaryValue: {
    fontSize: 14,
    color: '#2c3e50',
    fontWeight: '600',
  },
  discountValue: {
    color: '#e74c3c',
  },
  totalSection: {
    marginBottom: 20,
    paddingTop: 15,
    borderTopWidth: 2,
    borderTopColor: '#2c3e50',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  paymentSection: {
    marginBottom: 20,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  paymentLabel: {
    fontSize: 14,
    color: '#7f8c8d',
  },
  paymentValue: {
    fontSize: 14,
    color: '#2c3e50',
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  footerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 4,
  },
  footerSubtext: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 8,
  },
  generatedBy: {
    fontSize: 12,
    color: '#95a5a6',
    fontStyle: 'italic',
  },
  actionButtons: { 
    gap: spacing.sm, 
    marginBottom: spacing.lg 
  },
  actionButton: { 
    backgroundColor: colors.primary, 
    padding: spacing.md, 
    borderRadius: radius.md, 
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  actionButtonText: { 
    color: 'white', 
    fontSize: 16, 
    fontWeight: '600' 
  },
  errorText: { 
    textAlign: 'center', 
    fontSize: 18, 
    color: colors.danger, 
    marginTop: 100 
  },
});

export default ReceiptDetailScreen;
