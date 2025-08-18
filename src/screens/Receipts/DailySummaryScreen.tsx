import React, { useState, useMemo } from "react";
import { View, Text, TextInput, FlatList, TouchableOpacity, ScrollView, Alert } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSelector } from "react-redux";
import { useNavigation } from "@react-navigation/native";
import { RootState } from "../../redux/store";
import { Order, PaymentInfo } from "../../utils/types";
import { DrawerNavigationProp } from "@react-navigation/drawer";
import { SafeAreaView } from "react-native-safe-area-context";
import ReceiptSortingFilter, { SortOption } from "../../components/ReceiptSortingFilter";
import { filterReceiptsByDate, getDateRangeLabel } from "../../utils/receiptFilters";

type DrawerParamList = {
  Dashboard: undefined;
  Orders: { screen: string; params?: any };
  Receipts: { screen: string; params?: any };
  Staff: undefined;
  Inventory: undefined;
  Printer: undefined;
  Reports: undefined;
  Settings: undefined;
};

type DrawerNavigation = DrawerNavigationProp<DrawerParamList>;

interface ReceiptData {
  id: string;
  orderId: string;
  amount: string;
  customer: string;
  table: string;
  initial: string;
  paymentMethod: string;
  time: string;
  date: string;
  timestamp: number; // Store actual timestamp for date calculations
  orderItems: any[];
  subtotal: number;
  tax: number;
  serviceCharge: number;
  discount: number;
}

export default function ReceiptsScreen() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPaymentFilter, setSelectedPaymentFilter] = useState<string | null>(null);
  const [selectedSortOption, setSelectedSortOption] = useState<SortOption>('today');
  
  const navigation = useNavigation<DrawerNavigation>();
  
  // Get orders data from Redux store
  const completedOrders = useSelector((state: RootState) => state.orders.completedOrderIds);
  const ordersById = useSelector((state: RootState) => state.orders.ordersById);
  const tables = useSelector((state: RootState) => state.tables.tablesById);

  console.log('DailySummaryScreen - completedOrders:', completedOrders);
  console.log('DailySummaryScreen - ordersById keys:', Object.keys(ordersById));
  console.log('DailySummaryScreen - ordersById data:', ordersById);
  console.log('DailySummaryScreen - tables:', tables);

  // Convert completed orders to receipts format
  const receipts = useMemo((): ReceiptData[] => {
    const validOrders = completedOrders
      .map((orderId: string) => ordersById[orderId])
      .filter((order: Order | undefined): order is Order => 
        order !== undefined && 
        order.payment !== undefined && 
        order.payment.amount !== undefined &&
        order.payment.amount > 0
      );

    const receiptsData = validOrders.map((order: Order): ReceiptData => {
      const table = tables[order.tableId];
      const payment = order.payment as PaymentInfo;
      
      // Map payment methods to display names
      const getPaymentMethodDisplay = (method: string) => {
        switch (method) {
          case 'Cash': return 'Cash';
          case 'Card': return 'Card';
          case 'Bank Card': return 'Card';
          case 'Bank': return 'Bank';
          case 'UPI': return 'F.Pay';
          case 'Fonepay': return 'Fonepay';
          case 'Credit': return 'Credit';
          default: return method;
        }
      };
      
      // Ensure payment amount is valid
      const paymentAmount = payment.amount || 0;
      
      // Generate shorter receipt ID
      const getShortReceiptId = (id: string) => {
        const shortId = id.slice(-3);
        const date = new Date().getDate().toString().padStart(2, '0');
        const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
        return `R${month}${date}-${shortId}`;
      };
      
      const receipt = {
        id: getShortReceiptId(order.id),
        orderId: order.id,
        amount: `Rs ${paymentAmount.toFixed(2)}`,
        customer: payment.customerName || "Walk-in Customer",
        table: table?.name || order.tableId,
        initial: (payment.customerName || "W")[0].toUpperCase(),
        paymentMethod: getPaymentMethodDisplay(payment.method),
        time: new Date(payment.timestamp).toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: true 
        }),
        date: new Date(payment.timestamp).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        }),
        // Store the actual timestamp for date calculations
        timestamp: payment.timestamp,
        orderItems: order.items,
        subtotal: order.items.reduce((sum: number, item: any) => sum + ((item.price || 0) * (item.quantity || 0)), 0),
        tax: order.items.reduce((sum: number, item: any) => sum + ((item.price || 0) * (item.quantity || 0)), 0) * ((order.taxPercentage || 0) / 100),
        serviceCharge: order.items.reduce((sum: number, item: any) => sum + ((item.price || 0) * (item.quantity || 0)), 0) * ((order.serviceChargePercentage || 0) / 100),
        discount: order.items.reduce((sum: number, item: any) => sum + ((item.price || 0) * (item.quantity || 0)), 0) * ((order.discountPercentage || 0) / 100),
      };
      
      return receipt;
    });

    return receiptsData.sort((a: ReceiptData, b: ReceiptData) => b.timestamp - a.timestamp);
  }, [completedOrders, ordersById, tables]);

  // Calculate payment summary from actual orders
  const summary = useMemo(() => {
    // Use filtered receipts based on date range
    const dateFilteredReceipts = filterReceiptsByDate(receipts, selectedSortOption);

    const cashTotal = dateFilteredReceipts
      .filter((receipt: ReceiptData) => receipt.paymentMethod === "Cash")
      .reduce((sum: number, receipt: ReceiptData) => {
        const amountStr = receipt.amount.replace('Rs ', '');
        const amount = parseFloat(amountStr) || 0;
        return sum + amount;
      }, 0);

    const cardTotal = dateFilteredReceipts
      .filter((receipt: ReceiptData) => receipt.paymentMethod === "Card")
      .reduce((sum: number, receipt: ReceiptData) => {
        const amountStr = receipt.amount.replace('Rs ', '');
        const amount = parseFloat(amountStr) || 0;
        return sum + amount;
      }, 0);

    const bankTotal = dateFilteredReceipts
      .filter((receipt: ReceiptData) => receipt.paymentMethod === "Bank")
      .reduce((sum: number, receipt: ReceiptData) => {
        const amountStr = receipt.amount.replace('Rs ', '');
        const amount = parseFloat(amountStr) || 0;
        return sum + amount;
      }, 0);

    const fpayTotal = dateFilteredReceipts
      .filter((receipt: ReceiptData) => receipt.paymentMethod === "Fonepay")
      .reduce((sum: number, receipt: ReceiptData) => {
        const amountStr = receipt.amount.replace('Rs ', '');
        const amount = parseFloat(amountStr) || 0;
        return sum + amount;
      }, 0);

    const creditTotal = dateFilteredReceipts
      .filter((receipt: ReceiptData) => receipt.paymentMethod === "Credit")
      .reduce((sum: number, receipt: ReceiptData) => {
        const amountStr = receipt.amount.replace('Rs ', '');
        const amount = parseFloat(amountStr) || 0;
        return sum + amount;
      }, 0);

    return [
      { label: "Cash", amount: `Rs ${cashTotal.toFixed(2)}`, icon: "wallet" as const, key: "Cash" },
      { label: "Card", amount: `Rs ${cardTotal.toFixed(2)}`, icon: "credit-card" as const, key: "Card" },
      { label: "Bank", amount: `Rs ${bankTotal.toFixed(2)}`, icon: "bank" as const, key: "Bank" },
      { label: "Fonepay", amount: `Rs ${fpayTotal.toFixed(2)}`, icon: "cellphone" as const, key: "Fonepay" },
      { label: "Credit", amount: `Rs ${creditTotal.toFixed(2)}`, icon: "currency-usd" as const, key: "Credit" },
    ];
  }, [receipts, selectedSortOption]);

  // Filter and search receipts
  const filteredReceipts = useMemo(() => {
    let filtered = receipts;

    // Filter by date range
    filtered = filterReceiptsByDate(filtered, selectedSortOption);

    // Filter by payment method
    if (selectedPaymentFilter) {
      filtered = filtered.filter((receipt: ReceiptData) => receipt.paymentMethod === selectedPaymentFilter);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((receipt: ReceiptData) => 
        receipt.id.toLowerCase().includes(query) ||
        receipt.customer.toLowerCase().includes(query) ||
        receipt.table.toLowerCase().includes(query) ||
        receipt.orderId.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [searchQuery, selectedPaymentFilter, selectedSortOption, receipts]);

  // Calculate filtered summary based on selected payment method
  const filteredSummary = useMemo(() => {
    if (!selectedPaymentFilter) {
      // When no filter is applied, show the original summary with actual totals
      return summary;
    }
    
    // When filter is applied, show filtered totals but keep other methods visible
    const dateFilteredReceipts = filterReceiptsByDate(receipts, selectedSortOption);
    const filteredReceiptsForSummary = dateFilteredReceipts.filter(receipt => 
      receipt.paymentMethod === selectedPaymentFilter
    );
    
    const totalAmount = filteredReceiptsForSummary.reduce((sum: number, receipt: ReceiptData) => {
      const amountStr = receipt.amount.replace('Rs ', '');
      const amount = parseFloat(amountStr) || 0;
      return sum + amount;
    }, 0);
    
    return summary.map(item => {
      if (item.key === selectedPaymentFilter) {
        return { ...item, amount: `Rs ${totalAmount.toFixed(2)}` };
      }
      // Keep other payment methods visible with their original amounts
      return item;
    });
  }, [selectedPaymentFilter, selectedSortOption, summary, receipts]);

  const renderSummaryCard = (item: any, index: number) => (
    <TouchableOpacity
      key={index}
      style={{
        flex: 1,
        backgroundColor: selectedPaymentFilter === item.key ? "#333" : "#1e1e1e",
        padding: 12,
        borderRadius: 10,
        margin: 3,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        borderWidth: selectedPaymentFilter === item.key ? 2 : 0,
        borderColor: selectedPaymentFilter === item.key ? "#666" : "transparent",
      }}
      onPress={() => setSelectedPaymentFilter(selectedPaymentFilter === item.key ? null : item.key)}
    >
      <View style={{ alignItems: "center" }}>
        <MaterialCommunityIcons 
          name={item.icon} 
          size={20} 
          color={selectedPaymentFilter === item.key ? "#fff" : "#fff"} 
          style={{ marginBottom: 6 }} 
        />
        <Text style={{ color: "#fff", fontSize: 12, marginBottom: 3 }}>{item.label}</Text>
        <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 14 }}>{item.amount}</Text>
      </View>
    </TouchableOpacity>
  );

  const handlePrintDailySummary = async () => {
    try {
      const dateFilteredReceipts = filterReceiptsByDate(receipts, selectedSortOption);
      const grossSales = dateFilteredReceipts.reduce((sum, r) => sum + (r.subtotal + r.tax + r.serviceCharge), 0);
      const discounts = dateFilteredReceipts.reduce((sum, r) => sum + (r.discount || 0), 0);
      const serviceCharge = dateFilteredReceipts.reduce((sum, r) => sum + (r.serviceCharge || 0), 0);
      const complementary = 0;
      const netSales = dateFilteredReceipts.reduce((sum, r) => sum + parseFloat(r.amount.replace('Rs ', '')), 0);

      const types = ['Card', 'Cash', 'Credit'];
      const salesByType = types.map(type => ({
        type,
        count: dateFilteredReceipts.filter(r => r.paymentMethod === type).length,
        amount: dateFilteredReceipts
          .filter(r => r.paymentMethod === type)
          .reduce((s, r) => s + parseFloat(r.amount.replace('Rs ', '')), 0),
      }));
      const totalCount = salesByType.reduce((s, t) => s + t.count, 0);
      const totalAmount = salesByType.reduce((s, t) => s + t.amount, 0);
      salesByType.push({ type: 'Total', count: totalCount, amount: totalAmount });

      const paymentsNet = ['Credit', 'Cash', 'Card'].map(type => ({
        type,
        amount: dateFilteredReceipts
          .filter(r => r.paymentMethod === type)
          .reduce((s, r) => s + parseFloat(r.amount.replace('Rs ', '')), 0),
      }));

      const first = dateFilteredReceipts[dateFilteredReceipts.length - 1];
      const last = dateFilteredReceipts[0];

      const now = new Date();
      const data = {
        printTime: now.toLocaleString(),
        date: getDateRangeLabel(selectedSortOption),
        grossSales,
        serviceCharge,
        discounts,
        complementary,
        netSales,
        salesByType,
        paymentsNet,
        audit: { preReceiptCount: 0, receiptReprintCount: 0, voidReceiptCount: 0, totalVoidItemCount: 0 },
        firstReceipt: first ? {
          reference: first.id,
          sequence: first.orderId?.slice(-5),
          time: new Date(first.timestamp).toLocaleTimeString(),
          netAmount: parseFloat(first.amount.replace('Rs ', '')),
        } : undefined,
        lastReceipt: last ? {
          reference: last.id,
          sequence: last.orderId?.slice(-5),
          time: new Date(last.timestamp).toLocaleTimeString(),
          netAmount: parseFloat(last.amount.replace('Rs ', '')),
        } : undefined,
      };

      const { blePrinter } = await import('../../services/blePrinter');
      await blePrinter.printDailySummary(data as any);
      Alert.alert('Success', 'Daily summary sent to printer');
    } catch (e: any) {
      Alert.alert('Print Failed', e.message || String(e));
    }
  };

  const handleViewOrders = () => {
    // Navigate to Orders drawer screen -> OngoingOrders stack screen
    navigation.navigate('Orders', { screen: 'OngoingOrders' });
  };

  const handleViewReceipt = (receipt: ReceiptData) => {
    console.log('Navigating to ReceiptDetail with orderId:', receipt.orderId);
    console.log('Receipt data:', receipt);
    console.log('Navigation object:', navigation);
    
    try {
      // Navigate to Receipts drawer screen -> ReceiptDetail stack screen
      navigation.navigate('Receipts', { 
        screen: 'ReceiptDetail',
        params: { orderId: receipt.orderId }
      });
      console.log('Navigation call completed successfully');
    } catch (error) {
      console.error('Navigation error:', error);
    }
  };

  const handlePrintReceipt = async (receipt: ReceiptData) => {
    try {
      const order = ordersById[receipt.orderId];
      if (!order) {
        Alert.alert('Error', 'Order not found for printing');
        return;
      }
      const table = tables[order.tableId];
      const { PrintService } = await import('../../services/printing');
      const result = await PrintService.printReceiptFromOrder(order, table);
      if (!result.success) {
        Alert.alert('Print Failed', result.message);
      }
    } catch (error: any) {
      Alert.alert('Error', `Failed to print receipt: ${error.message || String(error)}`);
    }
  };

  const renderReceiptItem = ({ item }: { item: ReceiptData }) => (
    <View
      key={item.id}
      style={{
        backgroundColor: "#1e1e1e",
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
      }}
    >
      {/* Receipt Details */}
      <View style={{ marginBottom: 20, paddingTop: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
          <MaterialCommunityIcons name="account" size={16} color="#aaa" style={{ marginRight: 8 }} />
          <Text style={{ color: "#fff", fontSize: 14 }}>Customer: {item.customer}</Text>
        </View>
        
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
          <MaterialCommunityIcons name="tag" size={16} color="#aaa" style={{ marginRight: 8 }} />
          <Text style={{ color: "#fff", fontSize: 14 }}>Table: {item.table}</Text>
        </View>
        
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
          <MaterialCommunityIcons name="credit-card" size={16} color="#aaa" style={{ marginRight: 8 }} />
          <Text style={{ color: "#fff", fontSize: 14 }}>Paid: {item.amount} via </Text>
          <View
            style={{
              backgroundColor: "#333",
              paddingHorizontal: 8,
              paddingVertical: 2,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: "#555",
            }}
          >
            <Text style={{ color: "#fff", fontSize: 12, fontWeight: "500" }}>{item.paymentMethod}</Text>
          </View>
        </View>
        
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
          <MaterialCommunityIcons name="calendar-clock" size={16} color="#aaa" style={{ marginRight: 8 }} />
          <Text style={{ color: "#fff", fontSize: 14 }}>{item.time}</Text>
        </View>
      </View>
      
      {/* Action Buttons */}
      <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 12 }}>
        <TouchableOpacity
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "transparent",
            borderWidth: 1,
            borderColor: "#555",
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: 8,
          }}
          onPress={() => handlePrintReceipt(item)}
        >
          <MaterialCommunityIcons name="printer" size={16} color="#fff" style={{ marginRight: 6 }} />
          <Text style={{ color: "#fff", fontSize: 14, fontWeight: "500" }}>Print</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "transparent",
            borderWidth: 1,
            borderColor: "#555",
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: 8,
          }}
          onPress={() => handleViewReceipt(item)}
        >
          <MaterialCommunityIcons name="file-document" size={16} color="#fff" style={{ marginRight: 6 }} />
          <Text style={{ color: "#fff", fontSize: 14, fontWeight: "500" }}>View</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#111" }}>
      <ScrollView 
        style={{ flex: 1 }} 
        contentContainerStyle={{ padding: 16 }}
        showsVerticalScrollIndicator={false}
      >
          {/* Header */}
          <View style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
              <MaterialCommunityIcons name="file-document" size={22} color="#fff" style={{ marginRight: 8 }} />
              <Text style={{ fontSize: 20, fontWeight: "bold", color: "#fff" }}>Receipts</Text>
            </View>
            <Text style={{ color: "#aaa", fontSize: 13 }}>
              View and manage today's transaction receipts.
            </Text>
          </View>

          {/* Payment Summary */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ fontSize: 18, fontWeight: "600", color: "#fff" }}>
              {getDateRangeLabel(selectedSortOption)} Payment Summary
            </Text>
            <TouchableOpacity
              onPress={handlePrintDailySummary}
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#2a2a2a', borderWidth: 1, borderColor: '#444', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8 }}
              accessibilityLabel="Print daily summary"
            >
              <MaterialCommunityIcons name="printer" size={14} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600', marginLeft: 6 }}>Print</Text>
            </TouchableOpacity>
          </View>

          {/* Payment Method Cards Grid */}
          <View style={{ marginBottom: 20 }}>
            {/* First Row: Cash, Card, Bank */}
            <View style={{ flexDirection: "row", marginBottom: 8 }}>
              {renderSummaryCard(filteredSummary[0], 0)}
              {renderSummaryCard(filteredSummary[1], 1)}
              {renderSummaryCard(filteredSummary[2], 2)}
            </View>
            {/* Second Row: Fonepay, Credit */}
            <View style={{ flexDirection: "row" }}>
              {renderSummaryCard(filteredSummary[3], 3)}
              {renderSummaryCard(filteredSummary[4], 4)}
            </View>
          </View>

          {/* Date Range Filter */}
          <ReceiptSortingFilter
            selectedOption={selectedSortOption}
            onSortChange={setSelectedSortOption}
          />

          {/* Search Bar */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: "#1e1e1e",
              borderRadius: 10,
              paddingHorizontal: 12,
              marginBottom: 16,
            }}
          >
            <MaterialCommunityIcons name="magnify" size={20} color="#aaa" />
            <TextInput
              placeholder="Search by Receipt ID or Customer..."
              placeholderTextColor="#888"
              style={{ flex: 1, padding: 10, color: "#fff" }}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <MaterialCommunityIcons name="close" size={20} color="#aaa" />
              </TouchableOpacity>
            )}
          </View>

          {/* Results Count */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#aaa", fontSize: 14 }}>
                {filteredReceipts.length} receipt{filteredReceipts.length !== 1 ? 's' : ''} found
              </Text>
              <Text style={{ color: "#666", fontSize: 12, marginTop: 2 }}>
                {getDateRangeLabel(selectedSortOption)}
              </Text>
            </View>
            {selectedPaymentFilter && (
              <TouchableOpacity 
                onPress={() => setSelectedPaymentFilter(null)}
                style={{
                  backgroundColor: "#333",
                  paddingHorizontal: 12,
                  paddingVertical: 4,
                  borderRadius: 12,
                }}
              >
                <Text style={{ color: "#fff", fontSize: 12 }}>
                  Clear filter: {selectedPaymentFilter}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Receipt List */}
          {filteredReceipts.map((item) => renderReceiptItem({ item }))}

          {/* Empty State */}
          {filteredReceipts.length === 0 && (
            <View style={{ alignItems: "center", paddingVertical: 40 }}>
              <MaterialCommunityIcons name="file-document" size={48} color="#555" />
              <Text style={{ color: "#555", fontSize: 16, marginTop: 16 }}>
                {searchQuery || selectedPaymentFilter || selectedSortOption !== 'all' ? 'No receipts found' : 'No completed orders yet'}
              </Text>
              {!searchQuery && !selectedPaymentFilter && selectedSortOption === 'all' && (
                <TouchableOpacity 
                  style={{
                    backgroundColor: "#333",
                    paddingHorizontal: 20,
                    paddingVertical: 12,
                    borderRadius: 8,
                    marginTop: 16,
                  }}
                  onPress={handleViewOrders}
                >
                  <Text style={{ color: "#fff", fontSize: 14, fontWeight: "500" }}>
                    View Orders
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
  );
}

