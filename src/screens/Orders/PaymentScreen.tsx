import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, shadow } from '../../theme';
import { RootState } from '../../redux/store';
import { setPayment, completeOrder } from '../../redux/slices/ordersSlice';
import { addOrUpdateCustomer, incrementVisitCount, updateCustomer, updateCreditAmount } from '../../redux/slices/customersSlice';
import { unmergeTables } from '../../redux/slices/tablesSlice';
import { PaymentInfo, Customer, Order } from '../../utils/types';
import { PrintService } from '../../services/printing';

interface RouteParams {
  orderId: string;
  tableId: string;
  totalAmount: number;
}

interface SplitPayment {
  method: PaymentInfo['method'];
  amount: number;
  amountPaid: string;
}

const PaymentScreen: React.FC = () => {
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Card' | 'UPI' | 'Bank Card' | 'Bank' | 'Fonepay' | 'Credit'>('Cash');
  const [amountPaid, setAmountPaid] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [existingCustomer, setExistingCustomer] = useState<Customer | null>(null);
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [splitPayments, setSplitPayments] = useState<SplitPayment[]>([]);
  const [isSplitPayment, setIsSplitPayment] = useState(false);
  const [splitPaymentProcessed, setSplitPaymentProcessed] = useState(false);
  const createdCustomerIdRef = useRef<string | null>(null);

  const navigation = useNavigation();
  const route = useRoute();
  const dispatch = useDispatch();
  
  const { orderId, tableId, totalAmount } = route.params as RouteParams;
  const order = useSelector((state: RootState) => state.orders.ordersById[orderId]) as Order;
  const customers = useSelector((state: RootState) => state.customers.customersById);
  const tables = useSelector((state: RootState) => state.tables.tablesById);

  useEffect(() => {
    // Prefill from assigned customer on order, or from payment info if available
    const assignedName = (order as any)?.customerName || order?.payment?.customerName || '';
    const assignedPhone = (order as any)?.customerPhone || order?.payment?.customerPhone || '';
    if (assignedName || assignedPhone) {
      // Try match existing customer by phone first
      const byPhone = assignedPhone ? (Object.values(customers).find((c: any) => c.phone === assignedPhone) as Customer | undefined) : undefined;
      if (byPhone) {
        setExistingCustomer(byPhone);
        setCustomerName(byPhone.name);
        setCustomerPhone(byPhone.phone || '');
      } else {
        setCustomerName(assignedName);
        setCustomerPhone(assignedPhone);
      }
      setShowCustomerForm(true);
    }
  }, [order, customers]);

  // Auto-populate Customers list when either customer name or phone is provided during payment
  useEffect(() => {
    const name = customerName.trim();
    const phone = customerPhone.trim();
    if (!name && !phone) return;

    // Prefer matching by phone when available
    if (phone) {
      const existing = Object.values(customers).find((c: any) => c.phone === phone) as Customer | undefined;
      if (existing) {
        createdCustomerIdRef.current = existing.id;
        // Update name if provided and changed
        if (name && existing.name !== name) {
          dispatch(updateCustomer({ id: existing.id, name }));
        }
        return;
      }
    }

    // Create once to avoid duplicates while typing (works with name-only or phone-only)
    if (!createdCustomerIdRef.current) {
      const newId = `CUST-${Date.now()}`;
      createdCustomerIdRef.current = newId;
      const newCustomer: Customer = {
        id: newId,
        name: name || phone,
        phone: phone || undefined,
        creditAmount: 0,
        loyaltyPoints: 0,
        visitCount: 0,
        createdAt: Date.now(),
      };
      dispatch(addOrUpdateCustomer(newCustomer));
    } else {
      // Keep the record updated as user edits without overwriting other fields
      const currentId = createdCustomerIdRef.current;
      const current = currentId ? (customers as any)[currentId] as Customer | undefined : undefined;
      if (current) {
        const payload: Partial<Customer> & { id: string } = { id: current.id } as any;
        if (name) payload.name = name;
        if (phone) payload.phone = phone;
        dispatch(updateCustomer(payload));
      } else if (currentId) {
        // Fallback if not yet visible in state
        dispatch(addOrUpdateCustomer({ id: currentId, name: name || phone, phone: phone || undefined } as Customer));
      }
    }
  }, [customerName, customerPhone, customers, dispatch]);

  const handlePaymentMethodSelect = (method: PaymentInfo['method']) => {
    setPaymentMethod(method);
  };

  const handleCustomerDataChange = () => {
    setShowCustomerForm(true);
    setExistingCustomer(null);
  };

  const handleSplitBill = () => {
    setShowSplitModal(true);
    setIsSplitPayment(true);
    
    // If we already have split payments, don't reset them
    if (splitPayments.length === 0) {
      // Initialize with equal split only if no previous data
      const splitCount = 2; // Start with 2 splits
      const amountPerSplit = totalAmount / splitCount;
      setSplitPayments([
        {
          method: paymentMethod,
          amount: amountPerSplit,
          amountPaid: amountPerSplit.toFixed(2)
        },
        {
          method: 'Cash',
          amount: amountPerSplit,
          amountPaid: amountPerSplit.toFixed(2)
        }
      ]);
    }
  };

  const addSplitPayment = () => {
    setSplitPayments([...splitPayments, {
      method: 'Cash',
      amount: 0,
      amountPaid: '0'
    }]);
  };

  const updateSplitPayment = (index: number, field: keyof SplitPayment, value: any) => {
    const newSplitPayments = [...splitPayments];
    newSplitPayments[index] = { ...newSplitPayments[index], [field]: value };
    
    // If updating amount, also update amountPaid
    if (field === 'amount') {
      newSplitPayments[index].amountPaid = value.toString();
    }
    
    setSplitPayments(newSplitPayments);
  };

  const removeSplitPayment = (index: number) => {
    if (splitPayments.length > 1) {
      const newSplitPayments = splitPayments.filter((_, i) => i !== index);
      setSplitPayments(newSplitPayments);
    }
  };

  const getSplitTotal = () => {
    return splitPayments.reduce((sum, payment) => sum + payment.amount, 0);
  };

  const validateSplitPayments = () => {
    const splitTotal = getSplitTotal();
    return Math.abs(splitTotal - totalAmount) < 0.01;
  };

  const handleConfirmSplit = () => {
    // If only one payment method, treat it as normal payment
    if (splitPayments.length === 1) {
      setIsSplitPayment(false);
      setShowSplitModal(false);
      setSplitPaymentProcessed(false); // Don't show split info
      return;
    }
    
    // Set split payment as processed and close modal
    setSplitPaymentProcessed(true);
    setShowSplitModal(false);
  };

  const handleProcessPayment = () => {
    if (isSplitPayment) {
      // Handle split payment - no validation needed
      processSplitPayments();
    } else {
      // Handle single payment - always allow processing
      processSinglePayment(totalAmount);
    }
  };

  const processSinglePayment = (amount: number) => {
    // Create or update customer if details are provided (for Credit, require at least name or phone)
    let customerId: string | undefined;
    const nameTrim = customerName.trim();
    const phoneTrim = customerPhone.trim();
    const requiresCustomer = paymentMethod === 'Credit';

    if (requiresCustomer && !nameTrim && !phoneTrim) {
      Alert.alert('Customer Required', 'Enter customer name or phone to assign credit.');
      return;
    }

    if (nameTrim || phoneTrim) {
      let existingCustomer: Customer | undefined;
      if (phoneTrim) {
        existingCustomer = Object.values(customers).find((c: any) => c.phone === phoneTrim) as Customer | undefined;
      }

      if (existingCustomer) {
        dispatch(incrementVisitCount(existingCustomer.id));
        // Update name if changed
        if (nameTrim && existingCustomer.name !== nameTrim) {
          dispatch(updateCustomer({ id: existingCustomer.id, name: nameTrim }));
        }
        customerId = existingCustomer.id;
      } else {
        // Create new minimal customer record
        const newCustomer: Customer = {
          id: `CUST-${Date.now()}`,
          name: nameTrim || phoneTrim,
          phone: phoneTrim || undefined,
          visitCount: 1,
          createdAt: Date.now(),
          lastVisit: Date.now(),
          creditAmount: 0,
          loyaltyPoints: 0,
        };
        dispatch(addOrUpdateCustomer(newCustomer));
        customerId = newCustomer.id;
      }
    }

    // Create payment info
    const displayName = nameTrim || phoneTrim || '';
    const paymentInfo: PaymentInfo = {
      method: paymentMethod,
      amount: totalAmount,
      amountPaid: amount,
      change: amount - totalAmount,
      customerName: displayName,
      customerPhone: phoneTrim || '',
      timestamp: Date.now(),
    };

    // Set payment
    dispatch(setPayment({ orderId, payment: paymentInfo }));

    // If paid with Credit and we have a customer, add to their credit balance
    if (paymentMethod === 'Credit' && customerId) {
      dispatch(updateCreditAmount({ id: customerId, amount: totalAmount }));
    }

    // Complete order
    dispatch(completeOrder({ orderId }));

    // Unmerge tables if this was a merged order
    if (order.isMergedOrder && order.tableId) {
      // Check if the tableId is actually a merged table
      const table = tables[order.tableId];
      if (table?.isMerged) {
        dispatch(unmergeTables({ mergedTableId: order.tableId }));
      }
    }

    // Don't print automatically - only print when user clicks "Print & Done"
    // printReceipt(paymentInfo);

    Alert.alert(
      'Payment Successful',
      `Payment processed successfully!\nChange: Rs. ${(amount - totalAmount).toFixed(2)}`,
      [
        {
          text: 'Done',
          onPress: () => {
            // Navigate back to tables dashboard directly
            (navigation as any).navigate('Dashboard', { screen: 'TablesDashboard' });
          },
        },
        {
          text: 'Print & Done',
          onPress: () => {
            // Print receipt again and then navigate
            printReceipt(paymentInfo);
            (navigation as any).navigate('Dashboard', { screen: 'TablesDashboard' });
          },
        },
      ]
    );
  };

  const processSplitPayments = () => {
    // Create or update customer if any details are provided (required when any Credit portion exists)
    let customerId: string | undefined;
    const nameTrim = customerName.trim();
    const phoneTrim = customerPhone.trim();
    const creditPortion = splitPayments
      .filter((sp) => sp.method === 'Credit')
      .reduce((sum, sp) => sum + (typeof sp.amount === 'number' ? sp.amount : parseFloat(sp.amountPaid) || 0), 0);

    if (creditPortion > 0 && !nameTrim && !phoneTrim) {
      Alert.alert('Customer Required', 'Enter customer name or phone to assign credit.');
      return;
    }

    if (nameTrim || phoneTrim) {
      let existingCustomer: Customer | undefined;
      if (phoneTrim) {
        existingCustomer = Object.values(customers).find((c: any) => c.phone === phoneTrim) as Customer | undefined;
      }
      if (existingCustomer) {
        dispatch(incrementVisitCount(existingCustomer.id));
        if (nameTrim && existingCustomer.name !== nameTrim) {
          dispatch(updateCustomer({ id: existingCustomer.id, name: nameTrim }));
        }
        customerId = existingCustomer.id;
      } else {
        const newCustomer: Customer = {
          id: `CUST-${Date.now()}`,
          name: nameTrim || phoneTrim,
          phone: phoneTrim || undefined,
          visitCount: 1,
          createdAt: Date.now(),
          lastVisit: Date.now(),
          creditAmount: 0,
          loyaltyPoints: 0,
        };
        dispatch(addOrUpdateCustomer(newCustomer));
        customerId = newCustomer.id;
      }
    }

    // Create combined payment info
    const displayName = nameTrim || phoneTrim || '';
    const paymentInfo: any = {
      method: 'Credit',
      amount: totalAmount,
      amountPaid: totalAmount,
      change: 0,
      customerName: displayName,
      customerPhone: phoneTrim || '',
      timestamp: Date.now(),
      splitPayments: splitPayments,
    };

    // Set payment
    dispatch(setPayment({ orderId, payment: paymentInfo }));

    // Add any Credit portions from split payments to the customer's credit
    if (customerId && creditPortion > 0) {
      dispatch(updateCreditAmount({ id: customerId, amount: creditPortion }));
    }

    // Complete order
    dispatch(completeOrder({ orderId }));

    // Unmerge tables if this was a merged order
    if (order.isMergedOrder && order.tableId) {
      // Check if the tableId is actually a merged table
      const table = tables[order.tableId];
      if (table?.isMerged) {
        dispatch(unmergeTables({ mergedTableId: order.tableId }));
      }
    }

    // Don't print automatically - only print when user clicks "Print & Done"
    // printReceipt(paymentInfo);

    // Set split payment as processed and close modal
    setSplitPaymentProcessed(true);
    setShowSplitModal(false);

    Alert.alert(
      'Payment Successful',
      'Payment processed successfully with multiple payment methods!',
      [
                 {
           text: 'Done',
           onPress: () => {
             // Navigate back to tables dashboard directly
             (navigation as any).navigate('Dashboard', { screen: 'TablesDashboard' });
           },
         },
         {
           text: 'Print & Done',
           onPress: () => {
             // Print receipt again and then navigate
             printReceipt(paymentInfo);
             (navigation as any).navigate('Dashboard', { screen: 'TablesDashboard' });
           },
         },
      ]
    );
  };

  const printReceipt = async (paymentInfo: PaymentInfo) => {
    try {
      // Use PrintService.printReceiptFromOrder for proper thermal printer support
      const result = await PrintService.printReceiptFromOrder(order, tables[tableId]);
      
      if (result.success) {
        console.log('Receipt printed successfully to thermal printer');
        Alert.alert('Success', 'Receipt printed successfully to thermal printer!');
      } else {
        console.log('Receipt print failed:', result.message);
        if (result.fallback) {
          console.log('Fallback option:', result.fallback);
        }
        Alert.alert('Print Warning', `Receipt print failed: ${result.message}`);
      }
    } catch (error) {
      console.error('Receipt print error:', error);
    }
  };

  const calculateChange = () => {
    const amount = parseFloat(amountPaid);
    if (isNaN(amount)) return 0;
    return Math.max(0, amount - totalAmount);
  };

  const calculateSplitChange = () => {
    if (!isSplitPayment) return 0;
    const splitTotal = getSplitTotal();
    return Math.max(0, splitTotal - totalAmount);
  };

  const paymentMethods = [
    { method: 'Cash' as const, icon: 'cash-outline', label: 'Cash' },
    { method: 'Bank' as const, icon: 'business-outline', label: 'Bank' },
    { method: 'Card' as const, icon: 'card-outline', label: 'Card' },
    { method: 'Fonepay' as const, icon: 'wallet-outline', label: 'Fonepay' },
    { method: 'Credit' as const, icon: 'receipt-outline', label: 'Credit' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Order Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Summary</Text>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Order ID:</Text>
              <Text style={styles.summaryValue}>{orderId}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Table:</Text>
              <Text style={styles.summaryValue}>{tables[tableId]?.name || tableId}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Amount:</Text>
              <Text style={[styles.summaryValue, styles.totalAmount]}>
                Rs. {totalAmount.toFixed(2)}
              </Text>
            </View>
          </View>
        </View>

        {/* Order Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Items</Text>
          <View style={styles.itemsCard}>
            {order.items.map((item: any) => (
              <View key={item.menuItemId} style={styles.itemRow}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemQuantity}>x{item.quantity}</Text>
                </View>
                <Text style={styles.itemPrice}>Rs. {(item.price * item.quantity).toFixed(2)}</Text>
              </View>
            ))}
            <View style={styles.itemsTotal}>
              <Text style={styles.itemsTotalLabel}>Total:</Text>
              <Text style={styles.itemsTotalAmount}>Rs. {totalAmount.toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {/* Payment Method Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Method</Text>
          <View style={styles.paymentMethodsGrid}>
            {paymentMethods.map(({ method, icon, label }) => (
              <TouchableOpacity
                key={method}
                style={[
                  styles.paymentMethodCard,
                  paymentMethod === method && styles.paymentMethodSelected,
                  isSplitPayment && styles.paymentMethodDisabled
                ]}
                onPress={() => !isSplitPayment && handlePaymentMethodSelect(method)}
                disabled={isSplitPayment}
              >
                <Ionicons 
                  name={icon as any} 
                  size={24} 
                  color={paymentMethod === method ? colors.primary : colors.textSecondary} 
                />
                <Text style={[
                  styles.paymentMethodLabel,
                  paymentMethod === method && styles.paymentMethodLabelSelected,
                  isSplitPayment && styles.paymentMethodLabelDisabled
                ]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Customer Information */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Customer Information</Text>
            <TouchableOpacity onPress={handleCustomerDataChange}>
              <Ionicons name="create-outline" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>
          
          {showCustomerForm ? (
            <View style={styles.customerForm}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Customer Name</Text>
                <TextInput
                  style={styles.input}
                  value={customerName}
                  onChangeText={setCustomerName}
                  placeholder="Enter customer name"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Phone Number</Text>
                <TextInput
                  style={styles.input}
                  value={customerPhone}
                  onChangeText={setCustomerPhone}
                  placeholder="Enter phone number"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="phone-pad"
                />
              </View>

              {existingCustomer && (
                <View style={styles.existingCustomerInfo}>
                  <Ionicons name="information-circle-outline" size={16} color={colors.info} />
                  <Text style={styles.existingCustomerText}>
                    Existing customer: {existingCustomer.visitCount || 0} visits
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <TouchableOpacity 
              style={styles.addCustomerButton}
              onPress={() => setShowCustomerForm(true)}
            >
              <Ionicons name="person-add-outline" size={20} color={colors.primary} />
              <Text style={styles.addCustomerButtonText}>Add Customer Information</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Split Payment Information (after confirming split) */}
        {splitPaymentProcessed && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Split Payment Details</Text>
            <View style={styles.splitInfoCard}>
              {splitPayments.map((payment, index) => (
                <View key={index} style={styles.splitInfoRow}>
                  <View style={styles.splitInfoLeft}>
                    <Text style={styles.splitInfoLabel}>Payment {index + 1}</Text>
                    <Text style={styles.splitInfoMethod}>{payment.method}</Text>
                  </View>
                  <Text style={styles.splitInfoAmount}>Rs. {payment.amount.toFixed(2)}</Text>
                </View>
              ))}
              <View style={styles.splitInfoTotal}>
                <Text style={styles.splitInfoTotalLabel}>Total Split Amount:</Text>
                <Text style={styles.splitInfoTotalAmount}>Rs. {totalAmount.toFixed(2)}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Split Bill Option */}
        <View style={styles.section}>
          <TouchableOpacity 
            style={styles.splitBillButton}
            onPress={handleSplitBill}
          >
            <Ionicons name="list-outline" size={20} color={colors.primary} />
            <Text style={styles.splitBillButtonText}>Split Bill</Text>
          </TouchableOpacity>
        </View>

        {/* Payment Amount (Single Payment) */}
        {!isSplitPayment && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment Amount</Text>
            <View style={styles.amountCard}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Amount Paid</Text>
                <View style={styles.fixedAmountDisplay}>
                  <Text style={styles.fixedAmountText}>Rs. {totalAmount.toFixed(2)}</Text>
                </View>
              </View>
              
              <View style={styles.changeRow}>
                <Text style={styles.changeLabel}>Change:</Text>
                <Text style={styles.changeAmount}>Rs. {calculateChange().toFixed(2)}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Split Payment Amount Display */}
        {isSplitPayment && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment Amount</Text>
            <View style={styles.amountCard}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Total Amount (Fixed)</Text>
                <View style={styles.fixedAmountDisplay}>
                  <Text style={styles.fixedAmountText}>Rs. {totalAmount.toFixed(2)}</Text>
                </View>
              </View>
              
              <View style={styles.changeRow}>
                <Text style={styles.changeLabel}>Change:</Text>
                <Text style={styles.changeAmount}>Rs. {calculateSplitChange().toFixed(2)}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Process Payment Button */}
        <TouchableOpacity
          style={styles.processPaymentButton}
          onPress={handleProcessPayment}
        >
          <Ionicons name="checkmark-circle-outline" size={24} color="white" />
          <Text style={styles.processPaymentButtonText}>
            {isSplitPayment ? 'Process Split Payment' : 'Process Payment'}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Split Payment Modal */}
      <Modal
        visible={showSplitModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowSplitModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Split Bill</Text>
              <TouchableOpacity onPress={() => setShowSplitModal(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            
            <ScrollView 
              style={styles.splitModalContent} 
              showsVerticalScrollIndicator={true}
              contentContainerStyle={styles.splitModalContentContainer}
            >
              <Text style={styles.splitDescription}>
                Split the bill into multiple payment methods. Total: Rs. {totalAmount.toFixed(2)}
              </Text>
              
              {splitPayments.map((payment, index) => (
                <View key={index} style={styles.splitPaymentRow}>
                  <View style={styles.splitPaymentHeader}>
                    <Text style={styles.splitPaymentTitle}>Payment {index + 1}</Text>
                    {splitPayments.length > 1 && (
                      <TouchableOpacity onPress={() => removeSplitPayment(index)}>
                        <Ionicons name="trash-outline" size={20} color={colors.danger} />
                      </TouchableOpacity>
                    )}
                  </View>
                  
                  <View style={styles.splitPaymentInputs}>
                    <View style={styles.splitMethodSelect}>
                      <Text style={styles.splitInputLabel}>Payment Method:</Text>
                      <View style={styles.splitMethodButtons}>
                        {paymentMethods.map(({ method, icon, label }) => (
                          <TouchableOpacity
                            key={method}
                            style={[
                              styles.splitMethodButton,
                              payment.method === method && styles.splitMethodButtonSelected
                            ]}
                            onPress={() => updateSplitPayment(index, 'method', method)}
                          >
                            <Ionicons name={icon as any} size={16} color={payment.method === method ? 'white' : colors.textSecondary} />
                            <Text style={[
                              styles.splitMethodButtonText,
                              payment.method === method && styles.splitMethodButtonTextSelected
                            ]}>
                              {label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                    
                    <View style={styles.splitAmountInput}>
                      <Text style={styles.splitInputLabel}>Amount (Rs.):</Text>
                      <TextInput
                        style={styles.splitAmountTextInput}
                        value={payment.amountPaid}
                        onChangeText={(value) => {
                          const numValue = parseFloat(value) || 0;
                          updateSplitPayment(index, 'amount', numValue);
                        }}
                        keyboardType="numeric"
                        placeholder="0.00"
                        placeholderTextColor={colors.textSecondary}
                      />
                    </View>
                  </View>
                </View>
              ))}
              
              <TouchableOpacity style={styles.addSplitPaymentButton} onPress={addSplitPayment}>
                <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
                <Text style={styles.addSplitPaymentButtonText}>Add Another Payment Method</Text>
              </TouchableOpacity>
              
              <View style={styles.splitSummarySection}>
                <View style={styles.splitTotalRow}>
                  <Text style={styles.splitTotalLabel}>Split Total:</Text>
                  <Text style={[styles.splitTotalAmount, { 
                    color: colors.primary
                  }]}>
                    Rs. {getSplitTotal().toFixed(2)}
                  </Text>
                </View>
                
                <View style={styles.splitChangeRow}>
                  <Text style={styles.splitChangeLabel}>Change:</Text>
                  <Text style={[styles.splitChangeAmount, { 
                    color: getSplitTotal() > totalAmount ? colors.success : colors.textSecondary 
                  }]}>
                    Rs. {Math.max(0, getSplitTotal() - totalAmount).toFixed(2)}
                  </Text>
                </View>
              </View>
              
              <TouchableOpacity
                style={styles.confirmSplitButton}
                onPress={handleConfirmSplit}
              >
                <Text style={styles.confirmSplitButtonText}>Proceed Payment</Text>
              </TouchableOpacity>
            </ScrollView>
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
    padding: spacing.lg,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    ...shadow.card,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.outline,
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  summaryValue: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primary,
  },
  itemsCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    ...shadow.card,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.outline,
  },
  itemInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
    flex: 1,
  },
  itemQuantity: {
    fontSize: 12,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  itemsTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.outline,
  },
  itemsTotalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  itemsTotalAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primary,
  },
  paymentMethodsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  paymentMethodCard: {
    width: '30%',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.sm,
    marginHorizontal: '1.5%',
    borderWidth: 2,
    borderColor: colors.outline,
    ...shadow.card,
  },
  paymentMethodSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  paymentMethodDisabled: {
    opacity: 0.5,
    backgroundColor: colors.surface,
    borderColor: colors.outline,
  },
  paymentMethodLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  paymentMethodLabelSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  paymentMethodLabelDisabled: {
    color: colors.textMuted,
    fontWeight: '500',
  },
  customerForm: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    ...shadow.card,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 16,
    color: colors.textPrimary,
    backgroundColor: colors.background,
  },
  existingCustomerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.info + '10',
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  existingCustomerText: {
    fontSize: 12,
    color: colors.info,
    marginLeft: spacing.xs,
  },
  addCustomerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 2,
    borderColor: colors.outline,
    borderStyle: 'dashed',
  },
  addCustomerButtonText: {
    fontSize: 14,
    color: colors.primary,
    marginLeft: spacing.xs,
  },
  splitBillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
  },
  splitBillButtonText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '600',
    marginLeft: spacing.sm,
  },
  amountCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    ...shadow.card,
  },
  amountInput: {
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 20,
    color: colors.textPrimary,
    backgroundColor: colors.background,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  changeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.outline,
  },
  changeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  changeAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.success,
  },
  processPaymentButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    borderRadius: radius.md,
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
    ...shadow.card,
  },
  processPaymentButtonDisabled: {
    backgroundColor: colors.textMuted,
  },
  processPaymentButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: spacing.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    width: '90%',
    maxHeight: '80%',
    ...shadow.card,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.outline,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  splitModalContent: {
    padding: spacing.lg,
  },
  splitModalContentContainer: {
    flexGrow: 1,
    paddingBottom: spacing.xl,
  },
  splitDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  splitPaymentRow: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.outline,
  },
  splitPaymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  splitPaymentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  splitPaymentInputs: {
    gap: spacing.lg,
  },
  splitMethodSelect: {
    gap: spacing.sm,
  },
  splitInputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  splitMethodButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  splitMethodButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.background,
    minWidth: 80,
    justifyContent: 'center',
  },
  splitMethodButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  splitMethodButtonText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
    fontWeight: '500',
  },
  splitMethodButtonTextSelected: {
    color: 'white',
    fontWeight: '600',
  },
  splitAmountInput: {
    gap: spacing.sm,
  },
  splitAmountTextInput: {
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.background,
    fontSize: 18,
    color: colors.textPrimary,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  addSplitPaymentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary + '10',
    borderRadius: radius.md,
    padding: spacing.md,
    marginVertical: spacing.lg,
    borderWidth: 1,
    borderColor: colors.primary,
    borderStyle: 'dashed',
  },
  addSplitPaymentButtonText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
    marginLeft: spacing.sm,
  },
  splitSummarySection: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.outline,
  },
  splitTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.outline,
  },
  splitTotalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  splitTotalAmount: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  confirmSplitButton: {
    backgroundColor: colors.primary,
    padding: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  confirmSplitButtonDisabled: {
    backgroundColor: colors.textMuted,
  },
  confirmSplitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  splitInfoCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    ...shadow.card,
  },
  splitInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.outline,
  },
  splitInfoLeft: {
    flex: 1,
  },
  splitInfoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  splitInfoMethod: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  splitInfoAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  splitInfoTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.outline,
  },
  splitInfoTotalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  splitInfoTotalAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primary,
  },
  fixedAmountDisplay: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.outline,
  },
  fixedAmountText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  splitChangeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.outline,
  },
  splitChangeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  splitChangeAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.success,
  },
});

export default PaymentScreen;
