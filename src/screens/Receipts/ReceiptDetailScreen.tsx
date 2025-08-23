import React, { useState, useEffect, useLayoutEffect } from 'react';
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
  const customers = useSelector((state: RootState) => state.customers.customersById);

  console.log('ReceiptDetailScreen - orderId received:', orderId);
  console.log('ReceiptDetailScreen - order found:', order);
  console.log('ReceiptDetailScreen - tables:', tables);

  // Calculate remaining credit for credit settlements
  const getRemainingCredit = () => {
    if (order?.payment?.customerPhone) {
      const customer = Object.values(customers).find((c: any) => c.phone === order.payment.customerPhone);
      return (customer as any)?.creditAmount || 0;
    }
    return 0;
  };

  const remainingCredit = getRemainingCredit();
  const settledAmount = order.payment?.amountPaid || 0;
  const totalCreditBeforePayment = settledAmount + remainingCredit;

  // Set dynamic navigation title
  useLayoutEffect(() => {
    if (order) {
      const isCreditSettlement = 
        order.tableId?.startsWith('credit-') || 
        order.items.some((item: any) => item.name === 'Credit Settlement') ||
        order.items.some((item: any) => item.menuItemId === 'CREDIT-SETTLEMENT') ||
        (order.items.length === 1 && order.items[0].name.includes('Credit'));
      
      console.log('ReceiptDetailScreen - Navigation title detection:', {
        tableId: order.tableId,
        items: order.items,
        isCreditSettlement: isCreditSettlement
      });
      
      navigation.setOptions({
        title: isCreditSettlement ? 'Credit Settlement Receipt' : 'Receipt'
      });
    }
  }, [order, navigation]);

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
    // Check if this is a credit settlement receipt - multiple detection methods
    const isCreditSettlement = 
      order.tableId?.startsWith('credit-') || 
      order.items.some((item: any) => item.name === 'Credit Settlement') ||
      order.items.some((item: any) => item.menuItemId === 'CREDIT-SETTLEMENT') ||
      (order.items.length === 1 && order.items[0].name.includes('Credit'));
    
    console.log('ReceiptDetailScreen - Credit settlement detection:', {
      tableId: order.tableId,
      items: order.items,
      isCreditSettlement: isCreditSettlement
    });
    
    if (isCreditSettlement) {
      console.log('ReceiptDetailScreen - Generating credit settlement format');
      // Generate credit settlement format
      const splitTextCs = (order.payment?.method === 'Split' && Array.isArray((order.payment as any)?.splitPayments) && (order.payment as any).splitPayments.length > 0)
        ? `\nSplit Breakdown:\n${(order.payment as any).splitPayments.map((sp: any) => ` - ${sp.method}: Rs. ${Number(sp.amount || 0).toFixed(2)}`).join('\n')}`
        : '';
      const content = `
ARBI POS
Credit Settlement Receipt

Receipt: SET-${Date.now()}
Date: ${new Date(order.createdAt).toLocaleDateString()}
Time: ${new Date(order.createdAt).toLocaleTimeString()}
Credit Settlement Date: ${new Date(order.createdAt).toLocaleDateString()}
Credit Settlement Time: ${new Date(order.createdAt).toLocaleTimeString()}
Customer: ${order.payment?.customerName || 'N/A'}
${order.payment?.customerPhone ? `Phone: ${order.payment.customerPhone}` : ''}
Payment Method: ${order.payment?.method || 'N/A'}
${splitTextCs}

Credit Amount: Rs. ${(order.payment?.amountPaid || 0).toFixed(2)}
Settled Amount: Rs. ${(order.payment?.amountPaid || 0).toFixed(2)}
Remaining Credit: Rs. ${(order.payment?.remainingCredit || 0).toFixed(2)}

Thank you!
====================
Generated by ARBI POS System
      `.trim();
      
      console.log('ReceiptDetailScreen - Credit settlement content:', content);
      setReceiptContent(content);
      return;
    }

    console.log('ReceiptDetailScreen - Generating regular receipt format');
    // Regular receipt format for non-credit settlements
    const splitText = Array.isArray((order.payment as any)?.splitPayments) && (order.payment as any).splitPayments.length > 0
      ? `Split Breakdown:\n${(order.payment as any).splitPayments.map((sp: any) => ` - ${sp.method}: Rs. ${Number(sp.amount || 0).toFixed(2)}`).join('\n')}`
      : '';
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
${splitText}
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
      // Check if this is a credit settlement receipt - same robust detection
      const isCreditSettlement = 
        order.tableId?.startsWith('credit-') || 
        order.items.some((item: any) => item.name === 'Credit Settlement') ||
        order.items.some((item: any) => item.menuItemId === 'CREDIT-SETTLEMENT') ||
        (order.items.length === 1 && order.items[0].name.includes('Credit'));
      
      console.log('ReceiptDetailScreen - Print detection:', {
        tableId: order.tableId,
        items: order.items,
        isCreditSettlement: isCreditSettlement
      });
      
      if (isCreditSettlement) {
        console.log('ReceiptDetailScreen - Printing credit settlement format');
        // Print credit settlement format
        const { blePrinter } = await import('../../services/blePrinter');
        const now = new Date();
        
        // Section 1: Header and Basic Info
        await blePrinter.printText(`ARBI POS\n`);
        await blePrinter.printText(`Credit Settlement Receipt\n`);
        await blePrinter.printText(`\n`);
        await blePrinter.printText(`Receipt: SET-${Date.now()}\n`);
        await blePrinter.printText(`Date: ${now.toLocaleDateString()}\n`);
        await blePrinter.printText(`Time: ${now.toLocaleTimeString()}\n`);
        await blePrinter.printText(`Credit Settlement Date: ${now.toLocaleDateString()}\n`);
        await blePrinter.printText(`Credit Settlement Time: ${now.toLocaleTimeString()}\n`);
        await blePrinter.printText(`\n`);
        
        // Section 2: Customer and Payment Info
        await blePrinter.printText(`Customer: ${order.payment?.customerName || 'N/A'}\n`);
        if (order.payment?.customerPhone) {
          await blePrinter.printText(`Phone: ${order.payment.customerPhone}\n`);
        }
        await blePrinter.printText(`Payment Method: ${order.payment?.method || 'N/A'}\n`);
        if (order.payment?.method === 'Split' && Array.isArray((order.payment as any)?.splitPayments) && (order.payment as any).splitPayments.length > 0) {
          await blePrinter.printText(`Split Breakdown:\n`);
          for (const sp of (order.payment as any).splitPayments) {
            await blePrinter.printText(` - ${sp.method}: Rs. ${Number(sp.amount || 0).toFixed(2)}\n`);
          }
          await blePrinter.printText(`\n`);
        }
        await blePrinter.printText(`\n`);
        
        // Section 3: Credit Amounts
        await blePrinter.printText(`Credit Amount: Rs. ${totalCreditBeforePayment.toFixed(2)}\n`);
        await blePrinter.printText(`Settled Amount: Rs. ${settledAmount.toFixed(2)}\n`);
        await blePrinter.printText(`Remaining Credit: Rs. ${remainingCredit.toFixed(2)}\n`);
        await blePrinter.printText(`\n`);
        await blePrinter.printText(`Thank you!\n`);
        await blePrinter.printText(`Generated by ARBI POS System\n`);
        await blePrinter.printText(`\n\n`);
        
        Alert.alert('Success!', 'Credit settlement receipt printed successfully');
      } else {
        console.log('ReceiptDetailScreen - Printing regular receipt format');
        // Import PrintService for regular receipts
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

  // Check if this is a credit settlement receipt
  const isCreditSettlement = 
    order.tableId?.startsWith('credit-') || 
    order.items.some((item: any) => item.name === 'Credit Settlement') ||
    order.items.some((item: any) => item.menuItemId === 'CREDIT-SETTLEMENT') ||
    (order.items.length === 1 && order.items[0].name.includes('Credit'));

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.content} 
        contentContainerStyle={[
          styles.scrollContent, 
          { 
            paddingTop: 0,
            // Make container height only as necessary for credit settlements
            minHeight: isCreditSettlement ? 'auto' : '100%'
          }
        ]}
        showsVerticalScrollIndicator={true}
        bounces={true}
        alwaysBounceVertical={true}
        nestedScrollEnabled={true}
        scrollEnabled={true}
      >
        {/* Receipt Paper */}
        <View style={styles.receiptPaper}>
          {isCreditSettlement ? (
            // Credit Settlement Format
            <>
              {/* Section 1: Header and Basic Info */}
              <View style={styles.creditSection}>
                {/* Header Row with Print Button */}
                <View style={styles.headerRow}>
                  <View style={styles.restaurantHeader}>
                    <Text style={styles.restaurantName}>ARBI POS</Text>
                    <Text style={styles.restaurantTagline}>Credit Settlement Receipt</Text>
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

                {/* Basic Receipt Info */}
                <View style={styles.receiptInfo}>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Receipt:</Text>
                    <Text style={styles.infoValue}>SET-{Date.now()}</Text>
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
                    <Text style={styles.infoLabel}>Credit Settlement Date:</Text>
                    <Text style={styles.infoValue}>{new Date(order.createdAt).toLocaleDateString()}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Credit Settlement Time:</Text>
                    <Text style={styles.infoValue}>{new Date(order.createdAt).toLocaleTimeString()}</Text>
                  </View>
                </View>
              </View>

              {/* Divider */}
              <View style={styles.divider} />

              {/* Section 2: Customer and Payment Info */}
              <View style={styles.creditSection}>
                <View style={styles.receiptInfo}>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Customer:</Text>
                    <Text style={styles.infoValue}>{order.payment?.customerName || 'N/A'}</Text>
                  </View>
                  {order.payment?.customerPhone && (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Phone:</Text>
                      <Text style={styles.infoValue}>{order.payment.customerPhone}</Text>
                    </View>
                  )}
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Payment Method:</Text>
                    <Text style={styles.infoValue}>{order.payment?.method || 'N/A'}</Text>
                  </View>
                  {(order.payment?.method === 'Split' && Array.isArray((order.payment as any)?.splitPayments) && (order.payment as any).splitPayments.length > 0) && (
                    <View style={{ marginTop: 8 }}>
                      <Text style={[styles.infoLabel, { textAlign: 'center' }]}>Split Breakdown</Text>
                      {((order.payment as any).splitPayments as any[]).map((sp: any, idx: number) => (
                        <View key={`cs-split-${sp.method}-${sp.amount}-${idx}`} style={styles.paymentRow}>
                          <Text style={styles.paymentLabel}>{sp.method}:</Text>
                          <Text style={styles.paymentValue}>Rs {Number(sp.amount || 0).toFixed(2)}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </View>

              {/* Divider */}
              <View style={styles.divider} />

              {/* Section 3: Credit Amounts */}
              <View style={styles.creditSection}>
                <View style={styles.billSummary}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Credit Amount:</Text>
                    <Text style={styles.summaryValue}>Rs {totalCreditBeforePayment.toFixed(2)}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Settled Amount:</Text>
                    <Text style={styles.summaryValue}>Rs {settledAmount.toFixed(2)}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Remaining Credit:</Text>
                    <Text style={styles.summaryValue}>Rs {remainingCredit.toFixed(2)}</Text>
                  </View>
                </View>

                {/* Footer */}
                <View style={styles.footer}>
                  <Text style={styles.footerText}>Thank you!</Text>
                  <Text style={styles.footerText}>Generated by ARBI POS System</Text>
                </View>
              </View>
            </>
          ) : (
            // Regular Receipt Format
            <>
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
                  <View key={`${item.menuItemId || item.name}-${index}`} style={styles.itemRow}>
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
                {order.serviceChargePercentage > 0 && (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Service Charge ({order.serviceChargePercentage}%):</Text>
                    <Text style={styles.summaryValue}>{formatCurrency(serviceCharge)}</Text>
                  </View>
                )}
                {order.taxPercentage > 0 && (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Tax ({order.taxPercentage}%):</Text>
                    <Text style={styles.summaryValue}>{formatCurrency(tax)}</Text>
                  </View>
                )}
                {order.discountPercentage > 0 && (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Discount ({order.discountPercentage}%):</Text>
                    <Text style={styles.summaryValue}>-{formatCurrency(discount)}</Text>
                  </View>
                )}
                <View style={[styles.summaryRow, styles.totalRow]}>
                  <Text style={styles.totalLabel}>TOTAL:</Text>
                  <Text style={styles.totalValue}>{formatCurrency(total)}</Text>
                </View>
              </View>

              {/* Divider */}
              <View style={styles.divider} />

              {/* Payment Info */}
              {order.payment && (
                <>
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
                    {(order.payment.method === 'Split' && Array.isArray((order.payment as any)?.splitPayments) && (order.payment as any).splitPayments.length > 0) && (
                      <View style={{ marginTop: 8 }}>
                        <Text style={[styles.paymentLabel, { textAlign: 'center' }]}>Split Breakdown</Text>
                        {((order.payment as any).splitPayments as any[]).map((sp: any, idx: number) => (
                          <View key={`split-line-${sp.method}-${sp.amount}-${idx}`} style={styles.paymentRow}>
                            <Text style={styles.paymentLabel}>{sp.method}:</Text>
                            <Text style={styles.paymentValue}>Rs {Number(sp.amount || 0).toFixed(2)}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>

                  {/* Divider */}
                  <View style={styles.divider} />
                </>
              )}

              {/* Footer */}
              <View style={styles.footer}>
                <Text style={styles.footerText}>Thank you for dining with us!</Text>
                <Text style={styles.footerText}>Generated by Restaurant POS System</Text>
              </View>
            </>
          )}
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
  creditSection: {
    marginBottom: 20,
  },
});

export default ReceiptDetailScreen;
