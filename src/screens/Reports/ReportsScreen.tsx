import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { RootState } from '../../redux/store';
import { colors, spacing, radius, shadow } from '../../theme';

interface ReportData {
  id: string;
  title: string;
  value: string;
  change: string;
  changeType: 'positive' | 'negative' | 'neutral';
  icon: string;
}

interface SalesData {
  date: string;
  revenue: number;
  orders: number;
  averageOrder: number;
}

const ReportsScreen: React.FC = () => {
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month' | 'year'>('week');
  const [refreshing, setRefreshing] = useState(false);
  const [reportData, setReportData] = useState<ReportData[]>([]);
  const [salesData, setSalesData] = useState<SalesData[]>([]);
  
  const completedOrders = useSelector((state: RootState) => state.orders.completedOrderIds);
  const ordersById = useSelector((state: RootState) => state.orders.ordersById);

  useEffect(() => {
    generateReportData();
    generateSalesData();
  }, [selectedPeriod, completedOrders]);

  const generateReportData = () => {
    const startDate = getStartDate(selectedPeriod);
    const endDate = new Date();
    
    const periodOrders = completedOrders
      .map(id => ordersById[id])
      .filter(order => order && order.createdAt >= startDate.getTime() && order.createdAt <= endDate.getTime());

    const totalRevenue = periodOrders.reduce((sum, order) => {
      const subtotal = order.items.reduce((itemSum, item) => itemSum + (item.price * item.quantity), 0);
      const tax = subtotal * order.taxPercentage / 100;
      const serviceCharge = subtotal * order.serviceChargePercentage / 100;
      const discount = subtotal * order.discountPercentage / 100;
      return sum + subtotal + tax + serviceCharge - discount;
    }, 0);

    const totalOrders = periodOrders.length;
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const totalItems = periodOrders.reduce((sum, order) => 
      sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0
    );

    // Calculate change from previous period
    const previousStartDate = new Date(startDate);
    const previousEndDate = new Date(startDate);
    previousStartDate.setDate(previousStartDate.getDate() - getPeriodDays(selectedPeriod));
    
    const previousOrders = completedOrders
      .map(id => ordersById[id])
      .filter(order => order && order.createdAt >= previousStartDate.getTime() && order.createdAt < startDate.getTime());

    const previousRevenue = previousOrders.reduce((sum, order) => {
      const subtotal = order.items.reduce((itemSum, item) => itemSum + (item.price * item.quantity), 0);
      const tax = subtotal * order.taxPercentage / 100;
      const serviceCharge = subtotal * order.serviceChargePercentage / 100;
      const discount = subtotal * order.discountPercentage / 100;
      return sum + subtotal + tax + serviceCharge - discount;
    }, 0);

    const revenueChange = previousRevenue > 0 ? ((totalRevenue - previousRevenue) / previousRevenue) * 100 : 0;
    const ordersChange = previousOrders.length > 0 ? ((totalOrders - previousOrders.length) / previousOrders.length) * 100 : 0;

    setReportData([
      {
        id: '1',
        title: 'Total Revenue',
        value: `$${totalRevenue.toFixed(2)}`,
        change: `${revenueChange >= 0 ? '+' : ''}${revenueChange.toFixed(1)}%`,
        changeType: revenueChange > 0 ? 'positive' : revenueChange < 0 ? 'negative' : 'neutral',
        icon: '💰',
      },
      {
        id: '2',
        title: 'Total Orders',
        value: totalOrders.toString(),
        change: `${ordersChange >= 0 ? '+' : ''}${ordersChange.toFixed(1)}%`,
        changeType: ordersChange > 0 ? 'positive' : ordersChange < 0 ? 'negative' : 'neutral',
        icon: '📋',
      },
      {
        id: '3',
        title: 'Average Order Value',
        value: `$${averageOrderValue.toFixed(2)}`,
        change: 'vs previous period',
        changeType: 'neutral',
        icon: '📊',
      },
      {
        id: '4',
        title: 'Items Sold',
        value: totalItems.toString(),
        change: 'Total quantity',
        changeType: 'neutral',
        icon: '🛍️',
      },
    ]);
  };

  const generateSalesData = () => {
    const days = getPeriodDays(selectedPeriod);
    const data: SalesData[] = [];
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);
      
      const dayOrders = completedOrders
        .map(id => ordersById[id])
        .filter(order => order && order.createdAt >= dayStart.getTime() && order.createdAt <= dayEnd.getTime());

      const dayRevenue = dayOrders.reduce((sum, order) => {
        const subtotal = order.items.reduce((itemSum, item) => itemSum + (item.price * item.quantity), 0);
        const tax = subtotal * order.taxPercentage / 100;
        const serviceCharge = subtotal * order.serviceChargePercentage / 100;
        const discount = subtotal * order.discountPercentage / 100;
        return sum + subtotal + tax + serviceCharge - discount;
      }, 0);

      const dayAverageOrder = dayOrders.length > 0 ? dayRevenue / dayOrders.length : 0;

      data.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        revenue: dayRevenue,
        orders: dayOrders.length,
        averageOrder: dayAverageOrder,
      });
    }
    
    setSalesData(data);
  };

  const getStartDate = (period: string) => {
    const date = new Date();
    switch (period) {
      case 'today':
        date.setHours(0, 0, 0, 0);
        break;
      case 'week':
        date.setDate(date.getDate() - 7);
        break;
      case 'month':
        date.setMonth(date.getMonth() - 1);
        break;
      case 'year':
        date.setFullYear(date.getFullYear() - 1);
        break;
    }
    return date;
  };

  const getPeriodDays = (period: string) => {
    switch (period) {
      case 'today': return 1;
      case 'week': return 7;
      case 'month': return 30;
      case 'year': return 365;
      default: return 7;
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    generateReportData();
    generateSalesData();
    setTimeout(() => setRefreshing(false), 1000);
  };

  const renderReportCard = ({ item }: { item: ReportData }) => (
    <View style={styles.reportCard}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardIcon}>{item.icon}</Text>
        <View style={[
          styles.changeBadge,
          { backgroundColor: getChangeColor(item.changeType) }
        ]}>
          <Text style={styles.changeText}>{item.change}</Text>
        </View>
      </View>
      
      <Text style={styles.cardTitle}>{item.title}</Text>
      <Text style={styles.cardValue}>{item.value}</Text>
    </View>
  );

  const renderSalesData = ({ item }: { item: SalesData }) => (
    <View style={styles.salesDataRow}>
      <Text style={styles.salesDate}>{item.date}</Text>
      <Text style={styles.salesRevenue}>${item.revenue.toFixed(2)}</Text>
      <Text style={styles.salesOrders}>{item.orders} orders</Text>
      <Text style={styles.salesAverage}>${item.averageOrder.toFixed(2)}</Text>
    </View>
  );

  const getChangeColor = (changeType: string) => {
    switch (changeType) {
      case 'positive': return '#27ae60';
      case 'negative': return '#e74c3c';
      default: return '#7f8c8d';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Reports & Analytics</Text>
        <Text style={styles.subtitle}>Business performance insights</Text>
      </View>

      {/* Period Selector */}
      <View style={styles.periodSelector}>
        {(['today', 'week', 'month', 'year'] as const).map((period) => (
          <TouchableOpacity
            key={period}
            style={[
              styles.periodButton,
              selectedPeriod === period && styles.periodButtonActive
            ]}
            onPress={() => setSelectedPeriod(period)}
          >
            <Text style={[
              styles.periodButtonText,
              selectedPeriod === period && styles.periodButtonTextActive
            ]}>
              {period.charAt(0).toUpperCase() + period.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Key Metrics */}
        <View style={styles.metricsSection}>
          <Text style={styles.sectionTitle}>Key Metrics</Text>
          <FlatList
            data={reportData}
            renderItem={renderReportCard}
            keyExtractor={(item) => item.id}
            numColumns={2}
            scrollEnabled={false}
            columnWrapperStyle={styles.metricsRow}
          />
        </View>

        {/* Sales Trend */}
        <View style={styles.salesSection}>
          <Text style={styles.sectionTitle}>Sales Trend</Text>
          <View style={styles.salesHeader}>
            <Text style={styles.salesHeaderText}>Date</Text>
            <Text style={styles.salesHeaderText}>Revenue</Text>
            <Text style={styles.salesHeaderText}>Orders</Text>
            <Text style={styles.salesHeaderText}>Avg Order</Text>
          </View>
          
          <FlatList
            data={salesData}
            renderItem={renderSalesData}
            keyExtractor={(item, index) => index.toString()}
            scrollEnabled={false}
          />
        </View>

        {/* Top Performing Items */}
        <View style={styles.topItemsSection}>
          <Text style={styles.sectionTitle}>Top Performing Items</Text>
          <View style={styles.topItem}>
            <Text style={styles.topItemRank}>#1</Text>
            <Text style={styles.topItemName}>Margherita Pizza</Text>
            <Text style={styles.topItemSales}>45 sold</Text>
            <Text style={styles.topItemRevenue}>$673.55</Text>
          </View>
          <View style={styles.topItem}>
            <Text style={styles.topItemRank}>#2</Text>
            <Text style={styles.topItemName}>Chicken Caesar Salad</Text>
            <Text style={styles.topItemSales}>32 sold</Text>
            <Text style={styles.topItemRevenue}>$415.68</Text>
          </View>
          <View style={styles.topItem}>
            <Text style={styles.topItemRank}>#3</Text>
            <Text style={styles.topItemName}>Beef Burger</Text>
            <Text style={styles.topItemSales}>28 sold</Text>
            <Text style={styles.topItemRevenue}>$391.72</Text>
          </View>
        </View>

        {/* Payment Methods Analysis */}
        <View style={styles.paymentSection}>
          <Text style={styles.sectionTitle}>Payment Methods</Text>
          <View style={styles.paymentMethod}>
            <Text style={styles.paymentMethodName}>💳 Card</Text>
            <Text style={styles.paymentMethodStats}>65% • $2,847.30</Text>
          </View>
          <View style={styles.paymentMethod}>
            <Text style={styles.paymentMethodName}>💵 Cash</Text>
            <Text style={styles.paymentMethodStats}>25% • $1,095.12</Text>
          </View>
          <View style={styles.paymentMethod}>
            <Text style={styles.paymentMethodName}>📱 UPI</Text>
            <Text style={styles.paymentMethodStats}>10% • $438.05</Text>
          </View>
        </View>

        {/* Business Insights */}
        <View style={styles.insightsSection}>
          <Text style={styles.sectionTitle}>Business Insights</Text>
          <View style={styles.insightCard}>
            <Text style={styles.insightTitle}>📈 Peak Hours</Text>
            <Text style={styles.insightText}>
              Busiest time: 7:00 PM - 9:00 PM with 35% of daily orders
            </Text>
          </View>
          <View style={styles.insightCard}>
            <Text style={styles.insightTitle}>🎯 Customer Behavior</Text>
            <Text style={styles.insightText}>
              Average table occupancy: 2.3 customers, 45-minute dining time
            </Text>
          </View>
          <View style={styles.insightCard}>
            <Text style={styles.insightTitle}>💡 Recommendations</Text>
            <Text style={styles.insightText}>
              Consider adding more vegetarian options - 40% of customers prefer them
            </Text>
          </View>
        </View>
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
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.outline,
    gap: spacing.md,
  },
  periodButton: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.outline,
    alignItems: 'center',
    backgroundColor: colors.surface2,
  },
  periodButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  periodButtonTextActive: {
    color: colors.textPrimary,
  },
  content: {
    flex: 1,
    padding: spacing.md,
  },
  metricsSection: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  metricsRow: {
    gap: spacing.md,
  },
  reportCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.outline,
    ...shadow.card,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  cardIcon: {
    fontSize: 24,
  },
  changeBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  changeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  cardTitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  cardValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  salesSection: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.outline,
    ...shadow.card,
  },
  salesHeader: {
    flexDirection: 'row',
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.outline,
    marginBottom: spacing.md,
  },
  salesHeaderText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  salesDataRow: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.outline,
  },
  salesDate: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
  },
  salesRevenue: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.success,
  },
  salesOrders: {
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary,
  },
  salesAverage: {
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary,
  },
  topItemsSection: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.outline,
    ...shadow.card,
  },
  topItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.outline,
  },
  topItemRank: {
    width: 40,
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.primary,
  },
  topItemName: {
    flex: 2,
    fontSize: 16,
    color: colors.textPrimary,
  },
  topItemSales: {
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  topItemRevenue: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.success,
    textAlign: 'right',
  },
  paymentSection: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.outline,
    ...shadow.card,
  },
  paymentMethod: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.outline,
  },
  paymentMethodName: {
    fontSize: 16,
    color: colors.textPrimary,
  },
  paymentMethodStats: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  insightsSection: {
    marginBottom: spacing.xl,
  },
  insightCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.outline,
    ...shadow.card,
  },
  insightTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  insightText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});

export default ReportsScreen;
