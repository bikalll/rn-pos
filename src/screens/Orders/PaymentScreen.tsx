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
import { setPayment, completeOrder, setOrderCustomer } from '../../redux/slices/ordersSlice';
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
  const [assignCustomerModalVisible, setAssignCustomerModalVisible] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [hasCompletedPayment, setHasCompletedPayment] = useState(false);

  const navigation = useNavigation();
  const route = useRoute();
  const dispatch = useDispatch();
  
  const { orderId, tableId, totalAmount } = route.params as RouteParams;
  const order = useSelector((state: RootState) => state.orders.ordersById[orderId]) as Order;
  const customers = useSelector((state: RootState) => state.customers.customersById);
  const tables = useSelector((state: RootState) => state.tables.tablesById);
  const assignedName = (order as any)?.customerName || '';
  const assignedPhone = (order as any)?.customerPhone || '';
  const hasAssignedCustomer = Boolean(assignedName || assignedPhone);

  useEffect(() => {
    // Prefill from assigned customer on order; hide form if already assigned
    if (hasAssignedCustomer) {
      const byPhone = assignedPhone ? (Object.values(customers).find((c: any) => c.phone === assignedPhone) as Customer | undefined) : undefined;
      if (byPhone) {
        setExistingCustomer(byPhone);
        setCustomerName(byPhone.name);
        setCustomerPhone(byPhone.phone || '');
      } else {
        setCustomerName(assignedName);
        setCustomerPhone(assignedPhone);
      }
      setShowCustomerForm(false);
    }
  }, [hasAssignedCustomer, assignedName, assignedPhone, customers]);

  // Ensure split state is reverted when the split modal is dismissed without confirming
  useEffect(() => {
    if (!showSplitModal && !splitPaymentProcessed) {
      setIsSplitPayment(false);
      setSplitPayments([]);
    }
  }, [showSplitModal, splitPaymentProcessed]);

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
        const nextName = name || current.name;
        const nextPhone = phone || current.phone;
        const nameChanged = Boolean(name && current.name !== nextName);
        const phoneChanged = Boolean(phone && current.phone !== nextPhone);
        if (nameChanged || phoneChanged) {
          const payload: Partial<Customer> & { id: string } = { id: current.id } as any;
          if (nameChanged) payload.name = nextName;
          if (phoneChanged) payload.phone = nextPhone;
          dispatch(updateCustomer(payload));
        }
      } else if (currentId) {
        // Fallback if not yet visible in state
        dispatch(addOrUpdateCustomer({ id: currentId, name: name || phone, phone: phone || undefined } as Customer));
      }
    }
  }, [customerName, customerPhone, customers, dispatch]);

  const handlePaymentMethodSelect = (method: 'Cash' | 'Card' | 'UPI' | 'Bank Card' | 'Bank' | 'Fonepay' | 'Credit') => {
    setPaymentMethod(method);
    if (method === 'Credit' && !hasAssignedCustomer) {
      setAssignCustomerModalVisible(true);
    }
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
    
    // Keep number and string in sync; allow typing '.' by preserving string
    if (field === 'amountPaid') {
      const parsed = parseFloat(value);
      newSplitPayments[index].amount = isNaN(parsed) ? 0 : parsed;
    }
    if (field === 'amount') {
      newSplitPayments[index].amountPaid = value.toString();
    }
    // If switching method to Credit and there is no assigned customer yet, prompt to assign one
    if (field === 'method' && value === 'Credit' && !hasAssignedCustomer) {
      setAssignCustomerModalVisible(true);
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
    return Math.abs(splitTotal - totalAmount) < 0.01; // must equal exactly (within epsilon)
  };

  const handleConfirmSplit = () => {
    if (!validateSplitPayments()) {
      Alert.alert('Split Total Mismatch', 'Split total must equal the order total exactly.');
      return;
    }
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

  const handleCloseSplitModal = () => {
    // Exit split mode fully when closing via X
    setShowSplitModal(false);
    setIsSplitPayment(false);
    setSplitPaymentProcessed(false);
    setSplitPayments([]);
  };

  const handleRemoveCustomer = () => {
    // Check if there are any credit payments in the split
    const hasCreditInSplit = splitPayments.some((sp) => sp.method === 'Credit');
    
    if (hasCreditInSplit) {
      Alert.alert(
        'Cannot Remove Customer',
        'Customer cannot be removed while credit payments are present in the split. Please change all credit payments to other methods first.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    // Allow removal only if no credit payments
    try { 
      dispatch(setOrderCustomer({ orderId, customerName: undefined, customerPhone: undefined }) as any); 
    } catch (error) {
      console.error('Error removing customer:', error);
    }
  };

  const handleProcessPayment = () => {
    if (isProcessingPayment || hasCompletedPayment) return;
    setIsProcessingPayment(true);
    if (isSplitPayment) {
      if (!validateSplitPayments()) {
        setIsProcessingPayment(false);
        Alert.alert('Split Total Mismatch', 'Allocate the full amount across split payments before processing.');
        return;
      }
      processSplitPayments();
    } else {
      // Handle single payment - fixed to exact total
      processSinglePayment(totalAmount);
    }
  };

  const processSinglePayment = (amount: number) => {
    // Create or update customer if details are provided (for Credit, require customer NAME)
    let customerId: string | undefined;
    const nameTrim = customerName.trim();
    const phoneTrim = customerPhone.trim();
    const requiresCustomerName = paymentMethod === 'Credit';

    if (requiresCustomerName && !nameTrim) {
      Alert.alert('Customer Required', 'Enter customer name to assign credit.');
      return;
    }

    if (nameTrim || phoneTrim) {
      // Prefer existing by phone
      let existingCustomer: Customer | undefined = phoneTrim
        ? (Object.values(customers).find((c: any) => c.phone === phoneTrim) as Customer | undefined)
        : undefined;

      // Or previously created in this session via typing
      if (!existingCustomer && createdCustomerIdRef.current) {
        const existingByRef = (customers as any)[createdCustomerIdRef.current] as Customer | undefined;
        if (existingByRef) existingCustomer = existingByRef;
      }

      if (existingCustomer) {
        dispatch(incrementVisitCount(existingCustomer.id));
        if (nameTrim && existingCustomer.name !== nameTrim) {
          dispatch(updateCustomer({ id: existingCustomer.id, name: nameTrim }));
        }
        if (phoneTrim && existingCustomer.phone !== phoneTrim) {
          dispatch(updateCustomer({ id: existingCustomer.id, phone: phoneTrim } as any));
        }
        customerId = existingCustomer.id;
      } else {
        // Create or reuse typed customer id
        const id = createdCustomerIdRef.current || `CUST-${Date.now()}`;
        createdCustomerIdRef.current = id;
        const newCustomer: Customer = {
          id,
          name: nameTrim || phoneTrim,
          phone: phoneTrim || undefined,
          visitCount: 1,
          createdAt: Date.now(),
          lastVisit: Date.now(),
          creditAmount: 0,
          loyaltyPoints: 0,
        };
        dispatch(addOrUpdateCustomer(newCustomer));
        customerId = id;
      }
    }

    // Create payment info
    const displayName = nameTrim || phoneTrim || '';
    const paymentInfo: PaymentInfo = {
      method: paymentMethod,
      amount: totalAmount,
      amountPaid: amount,
      change: 0,
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
      'Payment processed successfully!',
      [
        {
          text: 'Done',
          onPress: () => {
            (navigation as any).navigate('Dashboard', { screen: 'TablesDashboard' });
            setIsProcessingPayment(false);
            setHasCompletedPayment(true);
          },
        },
        {
          text: 'Print & Done',
          onPress: () => {
            // Print receipt again and then navigate
            printReceipt(paymentInfo);
            (navigation as any).navigate('Dashboard', { screen: 'TablesDashboard' });
            setIsProcessingPayment(false);
            setHasCompletedPayment(true);
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

    if (creditPortion > 0 && !hasAssignedCustomer) {
      Alert.alert('Customer Required', 'A customer must be assigned when processing credit payments.');
      return;
    }

    if (hasAssignedCustomer) {
      // Use the assigned customer
      const byPhone = assignedPhone ? (Object.values(customers).find((c: any) => c.phone === assignedPhone) as Customer | undefined) : undefined;
      if (byPhone) {
        customerId = byPhone.id;
        dispatch(incrementVisitCount(byPhone.id));
      } else {
        // Create customer record for the assigned customer
        const id = `CUST-${Date.now()}`;
        const newCustomer: Customer = {
          id,
          name: assignedName || 'Customer',
          phone: assignedPhone || undefined,
          visitCount: 1,
          createdAt: Date.now(),
          lastVisit: Date.now(),
          creditAmount: 0,
          loyaltyPoints: 0,
        };
        dispatch(addOrUpdateCustomer(newCustomer));
        customerId = id;
      }
    } else if (nameTrim || phoneTrim) {
      let existingCustomer: Customer | undefined = phoneTrim
        ? (Object.values(customers).find((c: any) => c.phone === phoneTrim) as Customer | undefined)
        : undefined;
      if (!existingCustomer && createdCustomerIdRef.current) {
        const byRef = (customers as any)[createdCustomerIdRef.current] as Customer | undefined;
        if (byRef) existingCustomer = byRef;
      }
      if (existingCustomer) {
        dispatch(incrementVisitCount(existingCustomer.id));
        if (nameTrim && existingCustomer.name !== nameTrim) {
          dispatch(updateCustomer({ id: existingCustomer.id, name: nameTrim }));
        }
        if (phoneTrim && existingCustomer.phone !== phoneTrim) {
          dispatch(updateCustomer({ id: existingCustomer.id, phone: phoneTrim } as any));
        }
        customerId = existingCustomer.id;
      } else {
        const id = createdCustomerIdRef.current || `CUST-${Date.now()}`;
        createdCustomerIdRef.current = id;
        const newCustomer: Customer = {
          id,
          name: nameTrim || phoneTrim,
          phone: phoneTrim || undefined,
          visitCount: 1,
          createdAt: Date.now(),
          lastVisit: Date.now(),
          creditAmount: 0,
          loyaltyPoints: 0,
        };
        dispatch(addOrUpdateCustomer(newCustomer));
        customerId = id;
      }
    }

    // Create combined payment info with enhanced split payment details
    const displayName = hasAssignedCustomer ? (assignedName || assignedPhone || '') : (nameTrim || phoneTrim || '');
    const splitSum = getSplitTotal();
    const cashPortion = splitPayments
      .filter((sp) => sp.method !== 'Credit')
      .reduce((sum, sp) => sum + (typeof sp.amount === 'number' ? sp.amount : parseFloat(sp.amountPaid) || 0), 0);
    
    const paymentInfo: any = {
      method: 'Split',
      amount: totalAmount, // This is the order total amount
      amountPaid: cashPortion, // Only count non-credit payments as "paid"
      change: 0,
      customerName: displayName,
      customerPhone: hasAssignedCustomer ? assignedPhone : phoneTrim || '',
      timestamp: Date.now(),
      splitPayments: splitPayments.map(sp => ({ method: sp.method, amount: sp.amount })),
      // Add credit-specific information
      creditAmount: creditPortion,
      totalPaid: cashPortion,
      // Add total split amount for reference
      totalSplitAmount: splitSum,
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
            (navigation as any).navigate('Dashboard', { screen: 'TablesDashboard' });
            setIsProcessingPayment(false);
            setHasCompletedPayment(true);
          },
        },
        {
          text: 'Print & Done',
          onPress: () => {
            printReceipt(paymentInfo);
            (navigation as any).navigate('Dashboard', { screen: 'TablesDashboard' });
            setIsProcessingPayment(false);
            setHasCompletedPayment(true);
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

  // Change is not supported; amounts must equal total exactly

  const hasCreditInSplit = splitPayments.some((sp) => sp.method === 'Credit');

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
            {order.items.map((item: any, index: number) => (
              <View key={`${item.menuItemId}-${index}`} style={styles.itemRow}>
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
            {!hasAssignedCustomer && (
              <TouchableOpacity onPress={() => setAssignCustomerModalVisible(true)}>
                <Ionicons name="person-add-outline" size={20} color={colors.primary} />
              </TouchableOpacity>
            )}
          </View>

          {hasAssignedCustomer ? (
            <View style={styles.customerForm}>
              <View style={[styles.inputGroup, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                <View>
                  <Text style={styles.inputLabel}>Assigned Customer</Text>
                  <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '600' }}>
                    {assignedName || 'Customer'}{assignedPhone ? ` (${assignedPhone})` : ''}
                  </Text>
                </View>
                <TouchableOpacity 
                  onPress={handleRemoveCustomer}
                  style={{ 
                    paddingVertical: spacing.xs, 
                    paddingHorizontal: spacing.md, 
                    borderRadius: radius.md, 
                    borderWidth: 1, 
                    borderColor: colors.outline, 
                    backgroundColor: colors.surface2 
                  }}
                >
                  <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>Remove</Text>
                </TouchableOpacity>
              </View>
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                Customer was assigned in Order Confirmation
              </Text>
            </View>
          ) : (
            <>
              <TouchableOpacity 
                style={styles.addCustomerButton}
                onPress={() => setAssignCustomerModalVisible(true)}
              >
                <Ionicons name="person-add-outline" size={20} color={colors.primary} />
                <Text style={styles.addCustomerButtonText}>Assign Customer</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Split Payment Information (after confirming split) */}
        {splitPaymentProcessed && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Split Payment Details</Text>
            <View style={styles.splitInfoCard}>
              {splitPayments.map((payment, index) => (
                <View key={`split-info-${payment.method}-${payment.amount}-${index}`} style={styles.splitInfoRow}>
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
            </View>
          </View>
        )}

        {/* Process Payment Button */}
        <TouchableOpacity
          style={[styles.processPaymentButton, (isProcessingPayment || hasCompletedPayment) && styles.processPaymentButtonDisabled]}
          onPress={handleProcessPayment}
          disabled={isProcessingPayment || hasCompletedPayment}
        >
          <Ionicons name="checkmark-circle-outline" size={24} color="white" />
          <Text style={styles.processPaymentButtonText}>
            {isSplitPayment ? 'Process Split Payment' : 'Process Payment'}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Assign Customer Modal */}
      <Modal
        visible={assignCustomerModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setAssignCustomerModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Assign Customer</Text>
              <TouchableOpacity onPress={() => setAssignCustomerModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ padding: spacing.md }}>
              <Text style={styles.modalDescription}>Search Customers</Text>
              <TextInput
                style={{ borderWidth: 1, borderColor: colors.outline, borderRadius: radius.md, padding: spacing.md, color: colors.textPrimary, backgroundColor: colors.background, marginBottom: spacing.md }}
                placeholder="Search by name or phone"
                placeholderTextColor={colors.textSecondary}
                value={customerSearch}
                onChangeText={setCustomerSearch}
              />
              <View style={{ maxHeight: 320 }}>
                {Object.values(customers as any).length === 0 ? (
                  <Text style={{ color: colors.textSecondary }}>No customers found. Add customers in the Customers section first.</Text>
                ) : (
                  Object.values(customers as any)
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
                    })
                )}
              </View>
            </ScrollView>
            <View style={{ padding: spacing.md }}>
              <TouchableOpacity
                style={[styles.primaryActionButton, !selectedCustomerId && { opacity: 0.6 }]}
                disabled={!selectedCustomerId}
                onPress={() => {
                  if (!selectedCustomerId) return;
                  const customer: any = (customers as any)[selectedCustomerId];
                  if (!customer) { Alert.alert('Error', 'Customer not found'); return; }
                  try { dispatch(setOrderCustomer({ orderId, customerName: customer.name, customerPhone: customer.phone }) as any); } catch {}
                  setAssignCustomerModalVisible(false);
                  setCustomerSearch('');
                  setSelectedCustomerId(null);
                }}
              >
                <Text style={styles.primaryActionButtonText}>Assign</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryActionButton} onPress={() => { setAssignCustomerModalVisible(false); setCustomerSearch(''); setSelectedCustomerId(null); }}>
                <Text style={styles.secondaryActionButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Split Payment Modal */}
      <Modal
        visible={showSplitModal}
        animationType="slide"
        transparent={true}
        onRequestClose={handleCloseSplitModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Split Bill</Text>
              <TouchableOpacity onPress={handleCloseSplitModal}>
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
              {hasCreditInSplit && (
                <View style={{ marginBottom: spacing.md }}>
                  {hasAssignedCustomer ? (
                    <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>
                      Credit portion will be assigned to: {assignedName || assignedPhone}
                    </Text>
                  ) : (
                    <TouchableOpacity
                      style={[styles.addCustomerButton, { marginTop: spacing.sm }]}
                      onPress={() => setAssignCustomerModalVisible(true)}
                    >
                      <Ionicons name="person-add-outline" size={20} color={colors.primary} />
                      <Text style={styles.addCustomerButtonText}>Assign Customer for Credit</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
              
              {splitPayments.map((payment, index) => (
                <View key={`split-payment-row-${payment.method}-${payment.amount}-${index}`} style={styles.splitPaymentRow}>
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
                          updateSplitPayment(index, 'amountPaid', value);
                        }}
                        keyboardType="decimal-pad"
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
                {Math.abs(getSplitTotal() - totalAmount) >= 0.01 && (
                  <Text style={{ color: colors.danger, textAlign: 'center', marginTop: spacing.sm }}>
                    {getSplitTotal() < totalAmount
                      ? `Remaining to allocate: Rs. ${(totalAmount - getSplitTotal()).toFixed(2)}`
                      : `Excess amount: Rs. ${(getSplitTotal() - totalAmount).toFixed(2)}`}
                  </Text>
                )}
              </View>
              
              <TouchableOpacity
                style={[
                  styles.confirmSplitButton,
                  ((hasCreditInSplit && !hasAssignedCustomer) || !validateSplitPayments()) && styles.confirmSplitButtonDisabled,
                ]}
                onPress={handleConfirmSplit}
                disabled={(hasCreditInSplit && !hasAssignedCustomer) || !validateSplitPayments()}
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
  modalDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.md,
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
  primaryActionButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  primaryActionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryActionButton: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.outline,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  secondaryActionButtonText: {
    color: colors.textPrimary,
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
