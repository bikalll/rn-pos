import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  FlatList,
  Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../redux/store';
import { selectActiveTables } from '../../redux/slices/tablesSlice';
import { addItem, removeItem, updateItemQuantity, createOrder } from '../../redux/slices/ordersSlice';
import { MenuItem } from '../../redux/slices/menuSlice';
import { colors, spacing, radius, shadow } from '../../theme';

interface RouteParams {
  tableId: string;
  orderId: string;
}

const OrderTakingScreen: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  
  const navigation = useNavigation();
  const route = useRoute();
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  
  const { tableId, orderId } = route.params as RouteParams;
  const [selectedTableId, setSelectedTableId] = useState(tableId);
  const order = useSelector((state: RootState) => state.orders.ordersById[orderId]);
  const menuItems = useSelector((state: RootState) => Object.values(state.menu.itemsById)) as MenuItem[];
  const activeTables = useSelector(selectActiveTables);
  
  // Get the selected table and check if it's merged
  const selectedTable = activeTables.find(t => t.id === selectedTableId);
  const isMergedTable = selectedTable?.isMerged;
  const mergedTableNames = selectedTable?.mergedTableNames || [];

  const categories = useMemo(() => ['All', ...Array.from(new Set(menuItems.map((i: MenuItem) => i.category)))], [menuItems]);
  
  // Debug: Log table information
  console.log('=== TABLE DEBUG INFO ===');
  console.log('Active tables count:', activeTables.length);
  console.log('Active tables:', activeTables.map((t: any) => ({ id: t.id, name: t.name, isActive: t.isActive })));
  console.log('=== END DEBUG INFO ===');

  const filteredItems = useMemo(() => (
    (menuItems || []).filter(item => 
      (categoryFilter === 'All' || item.category === categoryFilter) &&
      (searchQuery === '' || 
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase()))
    )
  ), [menuItems, searchQuery, categoryFilter]);

  const handleAddItem = (item: MenuItem) => {
    let targetOrderId = orderId;
    if (orderId === 'new') {
      const mergedTableIds = isMergedTable ? selectedTable?.mergedTables : undefined;
      const action: any = dispatch(createOrder(selectedTableId, mergedTableIds));
      targetOrderId = action.payload.id;
      navigation.setParams({ tableId: selectedTableId, orderId: targetOrderId } as any);
    }
    dispatch(addItem({
      orderId: targetOrderId,
      item: {
        menuItemId: item.id,
        name: item.name,
        description: item.description,
        price: item.price,
        quantity: 1,
        modifiers: [],
        orderType: item.orderType // Include the orderType from menu item
      }
    }));
  };

  const handleUpdateQuantity = (menuItemId: string, quantity: number) => {
    if (quantity <= 0) {
      dispatch(removeItem({ orderId, menuItemId }));
    } else {
      dispatch(updateItemQuantity({ orderId, menuItemId, quantity }));
    }
  };

  const calculateTotal = () => {
    return order?.items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0) || 0;
  };

  const totalItemsCount = () => (order?.items || []).reduce((sum: number, i: any) => sum + i.quantity, 0);

  const renderMenuItem = ({ item }: { item: any }) => {
    // Check if this item is already in the order
    const orderItem = order?.items.find((orderItem: any) => orderItem.menuItemId === item.id);
    const currentQuantity = orderItem?.quantity || 0;

    return (
             <TouchableOpacity
         style={styles.menuItem}
         onPress={() => handleAddItem(item)}
         activeOpacity={1}
       >
        {/* Image Placeholder */}
        <View style={styles.menuItemImage}>
          {item.image ? (
            <Image source={{ uri: item.image }} style={styles.menuItemImageActual} />
          ) : (
            <View style={styles.menuItemImagePlaceholder}>
              <Text style={styles.menuItemImagePlaceholderText}>48 x 48</Text>
            </View>
          )}
        </View>

        {/* Item Details */}
        <View style={styles.menuItemDetails}>
          <Text style={styles.menuItemName}>{item.name}</Text>
          <Text style={styles.menuItemPrice}>Rs {item.price.toFixed(2)}</Text>
        </View>

        {/* Action Button */}
        {currentQuantity > 0 ? (
          // Show quantity controls if item is in order
          <View style={styles.quantityControls}>
                         <TouchableOpacity
               style={styles.quantityButton}
               onPress={() => handleUpdateQuantity(item.id, currentQuantity - 1)}
               activeOpacity={0.7}
             >
               <Ionicons name="remove" size={16} color={colors.textSecondary} />
             </TouchableOpacity>
            
            <View style={styles.quantityDisplay}>
              <Text style={styles.quantityText}>{currentQuantity}</Text>
            </View>
            
                         <TouchableOpacity
               style={styles.quantityButton}
               onPress={() => handleUpdateQuantity(item.id, currentQuantity + 1)}
               activeOpacity={0.7}
             >
               <Ionicons name="add" size={16} color={colors.textSecondary} />
             </TouchableOpacity>
          </View>
        ) : (
          // Show add button if item is not in order
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => handleAddItem(item)}
            activeOpacity={0.8}
          >
            <Text style={styles.addButtonText}>ADD</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top','bottom','left','right']}>
      <View style={styles.header}>
        <Text style={styles.title}>Add Items to Order</Text>
        <Text style={styles.subtitle}>Add items to the order for {selectedTable?.name || `Table ${selectedTableId?.slice(-6)}`}</Text>
        
        {/* Show merged table information */}
        {isMergedTable && mergedTableNames.length > 0 && (
          <View style={styles.mergedTableInfo}>
            <Text style={styles.mergedTableLabel}>Merged Tables:</Text>
            <Text style={styles.mergedTableNames}>
              {mergedTableNames.join(' + ')}
            </Text>
            <Text style={styles.mergedTableSeats}>
              Total Seats: {selectedTable?.totalSeats || selectedTable?.seats}
            </Text>
          </View>
        )}
      </View>



      <View style={styles.searchSection}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search menu..."
          placeholderTextColor={colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryFilter}>
          {categories.map(c => (
            <TouchableOpacity 
              key={c} 
              style={[styles.categoryChip, categoryFilter === c && styles.categoryChipActive]} 
              onPress={() => setCategoryFilter(c)}
            >
              <Text style={[styles.categoryText, categoryFilter === c && styles.categoryTextActive]}>
                {c}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={filteredItems}
        renderItem={renderMenuItem}
        keyExtractor={(item) => item.id}
        style={styles.menuList}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing.lg }}
        ListEmptyComponent={() => (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No items found.</Text>
          </View>
        )}
      />

      {order && order.items.length > 0 && (
        <View style={[styles.footer, { paddingBottom: spacing.md + insets.bottom }] }>
          <View style={styles.footerSummary}>
            <Text style={styles.footerSummaryText}>
              {selectedTable?.name || `Table ${selectedTableId.slice(-6)}`} • {totalItemsCount()} items
            </Text>
            <Text style={styles.footerSummaryTotal}>Rs. {calculateTotal().toFixed(2)}</Text>
          </View>
          <View style={styles.footerActions}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.reviewButton}
              onPress={() => {
                // @ts-ignore
                navigation.navigate('Orders', { 
                  screen: 'OrderConfirmation', 
                  params: { orderId, tableId: selectedTableId } 
                });
              }}
            >
              <Ionicons name="cart" size={18} color="white" style={styles.buttonIcon} />
              <Text style={styles.reviewButtonText}>Review Order</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.outline,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
  },

  searchSection: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.outline,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 16,
    backgroundColor: colors.surface2,
    color: colors.textPrimary,
  },
  categoryFilter: {
    marginTop: spacing.sm,
    paddingVertical: spacing.xs,
  },
  categoryChip: {
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: colors.outline,
  },
  categoryChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  categoryTextActive: {
    color: 'white',
  },
  menuList: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  menuRow: {
    justifyContent: 'space-between',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.outline,
    backgroundColor: colors.background,
  },
  menuItemImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: spacing.md,
    overflow: 'hidden',
  },
  menuItemImageActual: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
  },
  menuItemImagePlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.outline,
  },
  menuItemImagePlaceholderText: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  menuItemDetails: {
    flex: 1,
    marginRight: spacing.md,
  },
  menuItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  menuItemPrice: {
    fontSize: 14,
    color: colors.success,
    fontWeight: '600',
  },
  addButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  addButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.xs,
  },
  quantityButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.outline,
  },
  quantityDisplay: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginHorizontal: spacing.sm,
    minWidth: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.outline,
  },
  quantityText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.outline,
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  footerSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  footerSummaryText: {
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: 16,
  },
  footerSummaryTotal: {
    color: colors.textPrimary,
    fontWeight: '800',
    fontSize: 16,
  },
  footerActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  backButton: {
    flex: 1,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.outline,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  backButtonText: {
    color: colors.textPrimary,
    fontWeight: '700',
    fontSize: 16,
  },
  reviewButton: {
    flex: 2,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  reviewButtonText: {
    color: 'white',
    fontWeight: '800',
    fontSize: 16,
  },
  buttonIcon: {
    marginRight: spacing.sm,
  },
  emptyState: {
    padding: spacing.md,
    alignItems: 'center',
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 16,
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

export default OrderTakingScreen;
