import React, { useMemo, useState, useEffect, useLayoutEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  TextInput, 
  ScrollView, 
  Modal,
  Alert,
  Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector, useDispatch } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useNavigationContainerRef } from '@react-navigation/native';
import { colors, spacing, radius } from '../../theme';
import { RootState } from '../../redux/store';
import { MenuItem } from '../../redux/slices/menuSlice';
import { addItem, createOrder } from '../../redux/slices/ordersSlice';
import { CommonActions } from '@react-navigation/native';
import Toast from '../../components/Toast';
import { PrintService } from '../../services/printing';

type MenuNavigationProp = any;

interface Table {
  id: string;
  name: string; // Add name property
  number: number;
  capacity: number;
  status: 'available' | 'occupied' | 'reserved' | 'cleaning';
}

const MenuScreen: React.FC = () => {
  console.log('🔥🔥🔥 MENU SCREEN RENDERED!');
  const dispatch = useDispatch();
  const navigation = useNavigation<MenuNavigationProp>();
  const menuItemsById = useSelector((s: RootState) => s.menu.itemsById);
  const items: MenuItem[] = useMemo(() => Object.values(menuItemsById) as MenuItem[], [menuItemsById]);
  const ongoingOrderIds = useSelector((s: RootState) => s.orders.ongoingOrderIds || []);
  const ordersById = useSelector((s: RootState) => s.orders.ordersById || {});

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [showTableModal, setShowTableModal] = useState(false);
  
  // Multi-selection state
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  
  // Print modal state
  const [printModalVisible, setPrintModalVisible] = useState(false);
  const [pendingOrderInfo, setPendingOrderInfo] = useState<{ 
    orderId: string; 
    tableId: string; 
    isMulti: boolean; 
    itemName?: string;
    itemCount?: number;
  } | null>(null);
  
  // Toast notification state
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info' | 'warning'>('success');
  const [showViewOrderLink, setShowViewOrderLink] = useState(false);
  const [currentOrderInfo, setCurrentOrderInfo] = useState<{ orderId: string; tableId: string } | null>(null);

  // Get tables from Redux store
  const tablesById = useSelector((state: RootState) => state.tables.tablesById || {});
  const tableIds = useSelector((state: RootState) => state.tables.tableIds || []);

  // Dynamic tables based on actual table configuration and existing orders
  const tables = useMemo(() => {
    // Use actual tables from Redux store, fallback to default if none exist
    if (tableIds.length > 0) {
      return tableIds.map((tableId: string) => {
        const table = tablesById[tableId];
        if (!table) return null;
        
        // Extract table number from name (e.g., "Table 1" -> 1)
        const tableNumber = parseInt(table.name.replace(/\D/g, '')) || 1;
        const capacity = tableNumber <= 4 ? 2 : tableNumber <= 8 ? 4 : 6;
        
        // Check if table has active order
        const hasActiveOrder = ongoingOrderIds.some((orderId: string) => 
          ordersById[orderId]?.tableId === table.id
        );
        
        console.log(`Table ${table.id}: hasActiveOrder = ${hasActiveOrder}, ongoingOrderIds =`, ongoingOrderIds);
        
        return {
          id: table.id,
          name: table.name, // Include the actual table name
          number: tableNumber,
          capacity,
          status: hasActiveOrder ? 'occupied' as const : 'available' as const
        };
      }).filter(Boolean) as Table[];
    } else {
      // Fallback to default tables if none configured
      const defaultTables = Array.from({ length: 4 }, (_, index) => ({
        id: `table-${index + 1}`,
        name: `Table ${index + 1}`, // Include name for fallback tables
        number: index + 1,
        capacity: index < 2 ? 2 : 4,
        status: 'available' as const,
      }));

      // Update table status based on existing orders
      return defaultTables.map(table => {
        const hasActiveOrder = ongoingOrderIds.some((orderId: string) => 
          ordersById[orderId]?.tableId === table.id
        );
        
        console.log(`Table ${table.id}: hasActiveOrder = ${hasActiveOrder}, ongoingOrderIds =`, ongoingOrderIds);
        
        return {
          ...table,
          status: hasActiveOrder ? 'occupied' as const : 'available' as const
        };
      });
    }
  }, [tableIds, tablesById, ongoingOrderIds, ordersById]);

  // Debug: Monitor Redux state changes
  useEffect(() => {
    console.log('🔄 Redux State Updated:');
    console.log('Table IDs from Redux:', tableIds);
    console.log('Tables by ID from Redux:', tablesById);
    console.log('Ongoing Order IDs:', ongoingOrderIds);
    console.log('Orders by ID:', ordersById);
    console.log('Processed Tables:', tables);
  }, [tableIds, tablesById, ongoingOrderIds, ordersById, tables]);

  // Basic test - should run when component mounts
  useEffect(() => {
    console.log('🔥🔥🔥 MENU SCREEN MOUNTED!');
    console.log('🔥🔥🔥 This should definitely show up!');
  }, []);

  // Set navigation header dynamically based on multi-select mode
  useLayoutEffect(() => {
    if (isMultiSelectMode) {
      navigation.setOptions({
        headerRight: () => (
          <TouchableOpacity onPress={handleMultiOrder} style={styles.navOrderButton}>
            <Text style={styles.navOrderText}>Order({selectedItems.size})</Text>
          </TouchableOpacity>
        ),
      });
    } else {
      navigation.setOptions({
        headerRight: undefined,
      });
    }
  }, [isMultiSelectMode, selectedItems.size, navigation]);

  // Helper function to show toast notifications
  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'success', orderInfo?: { orderId: string; tableId: string }) => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
    
    if (orderInfo) {
      setShowViewOrderLink(true);
      setCurrentOrderInfo(orderInfo);
    } else {
      setShowViewOrderLink(false);
      setCurrentOrderInfo(null);
    }
  };

  const categories = useMemo(() => ['All', ...Array.from(new Set(items.map((i: MenuItem) => i.category)))], [items]);
  const filtered: MenuItem[] = items.filter((i: MenuItem) => 
    (categoryFilter === 'All' || i.category === categoryFilter) && 
    (search === '' || i.name.toLowerCase().includes(search.toLowerCase()))
  );

  const handleMenuItemPress = (item: MenuItem) => {
    console.log('🔥🔥🔥 MENU ITEM PRESSED!', item.name);
    if (!item.isAvailable) {
      showToast('This item is currently not available', 'warning');
      return;
    }
    setSelectedItem(item);
    setShowTableModal(true);
    console.log('🔥🔥🔥 MODAL SHOULD OPEN NOW!');
  };

  const handleViewOrder = () => {
    if (currentOrderInfo) {
      navigation.dispatch(
        CommonActions.navigate({
          name: 'Orders',
          params: {
            screen: 'OrderConfirmation',
            params: { 
              orderId: currentOrderInfo.orderId,
              tableId: currentOrderInfo.tableId
            }
          }
        })
      );
      setToastVisible(false);
    }
  };

  // Multi-selection functions
  const handleLongPress = (item: MenuItem) => {
    if (!item.isAvailable) {
      showToast('This item is currently not available', 'warning');
      return;
    }
    
    setIsMultiSelectMode(true);
    setSelectedItems(new Set([item.id]));
  };

  const handleMultiSelect = (item: MenuItem) => {
    if (!item.isAvailable) return;
    
    const newSelectedItems = new Set(selectedItems);
    if (newSelectedItems.has(item.id)) {
      newSelectedItems.delete(item.id);
    } else {
      newSelectedItems.add(item.id);
    }
    
    setSelectedItems(newSelectedItems);
    
    if (newSelectedItems.size === 0) {
      setIsMultiSelectMode(false);
    }
  };

  const handleMultiOrder = () => {
    if (selectedItems.size === 0) return;
    setShowTableModal(true);
  };

    const handleMultiTableSelect = (table: Table) => {
    console.log('🔥🔥🔥 MULTI TABLE SELECTED!', table.id);
    setShowTableModal(false);

    // Check if table already has an order
    const existingOrderId = ongoingOrderIds.find((id: string) => {
      const order = ordersById[id];
      return order?.tableId === table.id;
    });

    const selectedItemsList = Array.from(selectedItems).map(id => items.find(item => item.id === id)).filter(Boolean) as MenuItem[];
    
    // Check if only one item is selected - treat as single order
    const isSingleItem = selectedItemsList.length === 1;
    
    if (existingOrderId) {
      // Add all selected items to existing order
      selectedItemsList.forEach(item => {
        dispatch(addItem({
          orderId: existingOrderId,
          item: {
            menuItemId: item.id,
            name: item.name,
            description: item.description,
            price: item.price,
            quantity: 1,
            modifiers: [],
            orderType: item.orderType // Include the orderType
          }
        }));
      });
      
      // Show print modal instead of direct toast
      setPendingOrderInfo({ 
        orderId: existingOrderId, 
        tableId: table.id, 
        isMulti: !isSingleItem,
        itemCount: selectedItemsList.length,
        itemName: isSingleItem ? selectedItemsList[0]?.name : undefined
      });
      setPrintModalVisible(true);
    } else {
      // Create new order with all selected items
      try {
        const action: any = dispatch(createOrder(table.id));
        const newOrderId = action.payload.id;
        
        selectedItemsList.forEach(item => {
          dispatch(addItem({
            orderId: newOrderId,
            item: {
              menuItemId: item.id,
              name: item.name,
              description: item.description,
              price: item.price,
              quantity: 1,
              modifiers: [],
              orderType: item.orderType // Include the orderType
            }
          }));
        });
        
        // Show print modal instead of direct toast
        setPendingOrderInfo({ 
          orderId: newOrderId, 
          tableId: table.id, 
          isMulti: !isSingleItem,
          itemCount: selectedItemsList.length,
          itemName: isSingleItem ? selectedItemsList[0]?.name : undefined
        });
        setPrintModalVisible(true);
      } catch (error) {
        console.error('❌ Multi-order creation failed:', error);
      }
    }
    
    // Reset multi-selection
    setIsMultiSelectMode(false);
    setSelectedItems(new Set());
  };

  const cancelMultiSelect = () => {
    setIsMultiSelectMode(false);
    setSelectedItems(new Set());
  };

  // Print modal handlers
  const handlePrint = async () => {
    if (!pendingOrderInfo) return;
    
    try {
      setPrintModalVisible(false);
      
      // Get the order and table data
      const order = ordersById[pendingOrderInfo.orderId];
      const table = tablesById[pendingOrderInfo.tableId];
      
      if (!order) {
        showToast('Order not found', 'error');
        return;
      }
      
      // Show printing status
      showToast('Printing tickets...', 'info');
      
      // Print KOT/BOT tickets
      const result = await PrintService.printCombinedTicketsFromOrder(order, table);
      
      if (result.success) {
        const tableName = table?.name || `Table ${pendingOrderInfo.tableId.slice(-6)}`;
        const message = pendingOrderInfo.isMulti 
          ? `Placed ${pendingOrderInfo.itemCount} items in ${tableName} - Tickets printed!`
          : `${pendingOrderInfo.itemName} added to ${tableName} - Tickets printed!`;
        
        showToast(message, 'success', { 
          orderId: pendingOrderInfo.orderId, 
          tableId: pendingOrderInfo.tableId 
        });
      } else {
        showToast(`Tickets printed but with issues: ${result.message}`, 'warning');
      }
    } catch (error: any) {
      console.error('Print error:', error);
      showToast(`Failed to print tickets: ${error.message}`, 'error');
    } finally {
      setPendingOrderInfo(null);
    }
  };

  const handleCancelPrint = () => {
    setPrintModalVisible(false);
    if (pendingOrderInfo) {
      const tableName = tablesById[pendingOrderInfo.tableId]?.name || `Table ${pendingOrderInfo.tableId.slice(-6)}`;
      const message = pendingOrderInfo.isMulti 
        ? `Placed ${pendingOrderInfo.itemCount} items in ${tableName} (no tickets printed)`
        : `${pendingOrderInfo.itemName} added to ${tableName} (no tickets printed)`;
      
      showToast(message, 'success', { 
        orderId: pendingOrderInfo.orderId, 
        tableId: pendingOrderInfo.tableId 
      });
    }
    setPendingOrderInfo(null);
  };

  const handleTableSelect = (table: Table) => {
    console.log('🔥🔥🔥 TABLE CLICKED! Function called!', table.id, table.status);
    setShowTableModal(false);
    setSelectedItem(null);

    // Check if table already has an order
    const existingOrderId = ongoingOrderIds.find((id: string) => {
      const order = ordersById[id];
      const matches = order?.tableId === table.id;
      console.log(`Checking order ${id}: order.tableId = ${order?.tableId}, table.id = ${table.id}, matches = ${matches}`);
      return matches;
    });
    
    console.log('=== TABLE SELECTION DEBUG ===');
    console.log('Table clicked:', table.id, 'Status:', table.status);
    console.log('Ongoing orders:', ongoingOrderIds);
    console.log('Orders by ID:', ordersById);
    console.log('Existing order ID:', existingOrderId);
    console.log('Selected item:', selectedItem);
    
    if (existingOrderId) {
      // Table has ongoing order - add item to existing order
      console.log('🚀 ADDING ITEM TO EXISTING ORDER:', existingOrderId);
      try {
        if (!selectedItem) {
          console.log('❌ No selected item, cannot add to order');
          return;
        }
        
        // Add item to existing order
        dispatch(addItem({
          orderId: existingOrderId,
          item: {
            menuItemId: selectedItem.id,
            name: selectedItem.name,
            description: selectedItem.description,
            price: selectedItem.price,
            quantity: 1,
            modifiers: [],
            orderType: selectedItem.orderType // Include the orderType
          }
        }));
        
        // Show print modal instead of direct toast
        setPendingOrderInfo({ 
          orderId: existingOrderId, 
          tableId: table.id, 
          isMulti: false,
          itemName: selectedItem?.name
        });
        setPrintModalVisible(true);
        
        console.log('✅ Item added to existing order successfully');
      } catch (error) {
        console.error('❌ Failed to add item to existing order:', error);
      }
    } else {
      // Table is available - create new order and add selected item
      if (!selectedItem) {
        console.log('❌ No selected item, cannot create order');
        return;
      }
      
      console.log('🚀 CREATING NEW ORDER for table:', table.id);
      try {
        const action: any = dispatch(createOrder(table.id));
        const newOrderId = action.payload.id;
        console.log('✅ New order created:', newOrderId);
        
        // Add item to new order
        dispatch(addItem({
          orderId: newOrderId,
          item: {
            menuItemId: selectedItem.id,
            name: selectedItem.name,
            description: selectedItem.description,
            price: selectedItem.price,
            quantity: 1,
            modifiers: [],
            orderType: selectedItem.orderType // Include the orderType
          }
        }));
        
        // Show print modal instead of direct toast
        setPendingOrderInfo({ 
          orderId: newOrderId, 
          tableId: table.id, 
          isMulti: false,
          itemName: selectedItem?.name
        });
        setPrintModalVisible(true);
        
        console.log('✅ New order created successfully');
      } catch (error) {
        console.error('❌ Order creation failed:', error);
      }
    }
  };

  const renderMenuItem = ({ item }: { item: MenuItem }) => {
    const isSelected = selectedItems.has(item.id);
    
    return (
      <TouchableOpacity 
        style={[
          styles.menuItem,
          isSelected && styles.selectedMenuItem
        ]}
        onPress={() => isMultiSelectMode ? handleMultiSelect(item) : handleMenuItemPress(item)}
        onLongPress={() => handleLongPress(item)}
        activeOpacity={0.8}
      >
        {/* Selection Indicator */}
        {isMultiSelectMode && (
          <View style={[styles.selectionIndicator, isSelected && styles.selectionIndicatorSelected]}>
            {isSelected && <Ionicons name="checkmark" size={16} color="white" />}
          </View>
        )}

        {/* Image */}
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
          <Text style={styles.menuItemName} numberOfLines={2}>{item.name}</Text>
          {item.description && (
            <Text style={styles.menuItemDescription} numberOfLines={2}>
              {item.description}
            </Text>
          )}
          <View style={styles.itemFooter}>
            <View style={[styles.availabilityBadge, { backgroundColor: item.isAvailable ? colors.success : colors.danger }]}>
              <Text style={styles.availabilityText}>
                {item.isAvailable ? 'Available' : 'Unavailable'}
              </Text>
            </View>
            <Text style={styles.itemPrice}>Rs {item.price.toFixed(2)}</Text>
          </View>
        </View>

        {/* Order Button - Only show when not in multi-select mode */}
        {!isMultiSelectMode && (
          <View style={styles.orderButton}>
            <Ionicons name="add-circle" size={24} color="white" />
            <Text style={styles.orderButtonText}>Order</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderTable = ({ item: table }: { item: Table }) => (
    <TouchableOpacity 
      style={[styles.tableCard, table.status !== 'available' && styles.tableCardOccupied]}
      onPress={() => {
        console.log('🔥🔥🔥 TOUCHABLE PRESSED!', table.id);
        handleTableSelect(table);
      }}
    >
      <Text style={styles.tableNumber}>{table.name}</Text>
      <Text style={styles.tableCapacity}>{table.capacity} seats</Text>
      <View style={[styles.tableStatus, { backgroundColor: table.status === 'available' ? colors.success : colors.warning }]}>
        <Text style={styles.tableStatusText}>
          {table.status === 'available' ? 'Available' : 'Occupied'}
        </Text>
      </View>
      {/* Visual indicator for occupied tables */}
      {table.status === 'occupied' && (
        <View style={styles.occupiedIndicator}>
          <Ionicons name="add-circle" size={16} color={colors.primary} />
          <Text style={styles.occupiedIndicatorText}>Add Items</Text>
        </View>
      )}
      {/* Updated debug info */}
      <Text style={styles.debugText}>
        {table.status === 'occupied' ? 'Click to add items to order' : 'Click to create new order'}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Menu</Text>
        <Text style={styles.subtitle}>Browse and order from our menu</Text>
      </View>

      <View style={styles.filters}>
        <TextInput 
          placeholder="Search dishes..." 
          placeholderTextColor={colors.textSecondary} 
          value={search} 
          onChangeText={setSearch} 
          style={styles.search} 
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
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
        data={filtered} 
        keyExtractor={(i) => i.id} 
        renderItem={renderMenuItem} 
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      {/* Table Selection Modal */}
      <Modal
        visible={showTableModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowTableModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Table</Text>
              <Text style={styles.modalSubtitle}>
                {isMultiSelectMode 
                  ? `Choose a table to add ${selectedItems.size} items to an existing order or create a new one`
                  : `Choose a table to add ${selectedItem?.name} to an existing order or create a new one`
                }
              </Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setShowTableModal(false)}
              >
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={tables}
              renderItem={({ item: table }) => (
                <TouchableOpacity 
                  style={[styles.tableCard, table.status !== 'available' && styles.tableCardOccupied]}
                  onPress={() => {
                    console.log('🔥🔥🔥 TABLE SELECTED!', table.id);
                    if (isMultiSelectMode) {
                      handleMultiTableSelect(table);
                    } else {
                      handleTableSelect(table);
                    }
                  }}
                >
                  <Text style={styles.tableNumber}>{table.name}</Text>
                  <Text style={styles.tableCapacity}>{table.capacity} seats</Text>
                  <View style={[styles.tableStatus, { backgroundColor: table.status === 'available' ? colors.success : colors.warning }]}>
                    <Text style={styles.tableStatusText}>
                      {table.status === 'available' ? 'Available' : 'Occupied'}
                    </Text>
                  </View>
                  {table.status === 'occupied' && (
                    <View style={styles.occupiedIndicator}>
                      <Ionicons name="add-circle" size={16} color={colors.primary} />
                      <Text style={styles.occupiedIndicatorText}>Add Items</Text>
                    </View>
                  )}
                  <Text style={styles.debugText}>
                    {table.status === 'occupied' ? 'Click to add items to order' : 'Click to create new order'}
                  </Text>
                </TouchableOpacity>
              )}
              keyExtractor={(table) => table.id}
              numColumns={2}
              columnWrapperStyle={styles.tableRow}
              contentContainerStyle={styles.tableListContent}
            />
          </View>
                 </View>
       </Modal>

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
              Print KOT (Kitchen) and/or BOT (Bar) tickets for the kitchen staff.
            </Text>
            
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.printButton} onPress={handlePrint}>
                <Text style={styles.printButtonText}>Print</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={handleCancelPrint}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Toast Notification */}
      <Toast
        visible={toastVisible}
        message={toastMessage}
        type={toastType}
        onHide={() => setToastVisible(false)}
        showViewOrderLink={showViewOrderLink}
        onViewOrder={handleViewOrder}
      />
     </SafeAreaView>
   );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: colors.background 
  },
  header: { 
    padding: spacing.md, 
    paddingTop: 0,
    borderBottomWidth: 1, 
    borderBottomColor: colors.outline 
  },

  navOrderButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  navOrderText: {
    color: colors.success,
    fontSize: 16,
    fontWeight: 'bold',
  },
  title: { 
    fontSize: 24, 
    fontWeight: 'bold', 
    color: colors.textPrimary, 
    marginBottom: 4 
  },
  subtitle: { 
    color: colors.textSecondary 
  },
  filters: { 
    paddingHorizontal: spacing.md, 
    paddingVertical: spacing.sm, 
    borderBottomWidth: 1, 
    borderBottomColor: colors.outline 
  },
  search: { 
    borderWidth: 1, 
    borderColor: colors.outline, 
    borderRadius: radius.md, 
    padding: spacing.md, 
    color: colors.textPrimary, 
    backgroundColor: colors.surface2, 
    marginBottom: spacing.sm 
  },
  categoryChip: { 
    paddingHorizontal: spacing.md, 
    paddingVertical: 8, 
    borderRadius: 999, 
    borderWidth: 1, 
    borderColor: colors.outline, 
    marginRight: spacing.sm, 
    backgroundColor: colors.surface 
  },
  categoryChipActive: { 
    backgroundColor: colors.primary, 
    borderColor: colors.primary 
  },
  categoryText: { 
    color: colors.textSecondary, 
    fontWeight: '600' 
  },
  categoryTextActive: { 
    color: 'white' 
  },
  listContent: { 
    padding: spacing.md, 
    paddingBottom: 100 
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
  selectedMenuItem: {
    backgroundColor: colors.surface2,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  selectionIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.outline,
    marginRight: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionIndicatorSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
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
    color: colors.textPrimary, 
    fontWeight: '700', 
    fontSize: 16,
    marginBottom: 4,
    lineHeight: 20,
  },
  menuItemDescription: {
    color: colors.textSecondary,
    fontSize: 14,
    marginBottom: spacing.sm,
    lineHeight: 18,
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  availabilityBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  availabilityText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
  },
  itemPrice: { 
    color: colors.success, 
    fontWeight: 'bold', 
    fontSize: 14 
  },
  orderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    minWidth: 80,
  },
  orderButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
    marginLeft: spacing.xs,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    width: '90%',
    maxHeight: '80%',
    padding: spacing.md,
  },
  modalHeader: {
    marginBottom: spacing.lg,
    alignItems: 'center',
    position: 'relative',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  modalSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  closeButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    padding: spacing.sm,
  },
  tableListContent: {
    paddingBottom: spacing.lg,
  },
  tableRow: {
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  tableCard: {
    width: '48%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    minHeight: 100,
  },
  tableCardOccupied: {
    backgroundColor: colors.surface2,
    borderColor: colors.warning,
    borderWidth: 2,
  },
  tableNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  tableCapacity: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  tableStatus: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  tableStatusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  debugText: {
    fontSize: 10,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    fontStyle: 'italic',
  },
  occupiedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.outline,
  },
  occupiedIndicatorText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
    marginLeft: spacing.xs,
  },
  // Print modal styles
  modalDescription: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  printButton: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  printButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: colors.surface2,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.outline,
  },
  cancelButtonText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default MenuScreen;
