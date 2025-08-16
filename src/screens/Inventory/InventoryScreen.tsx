import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  TextInput,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius, shadow } from '../../theme';

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  price: number;
  stockQuantity: number;
  minStockLevel: number;
  unit: string;
  supplier: string;
  lastUpdated: number;
  isActive: boolean;
}

const InventoryScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  
  const [newItem, setNewItem] = useState({
    name: '',
    category: '',
    price: '',
    stockQuantity: '',
    minStockLevel: '',
    unit: '',
    supplier: '',
  });

  useEffect(() => {
    loadInventoryData();
  }, []);

  const loadInventoryData = () => {
    const mockItems: InventoryItem[] = [
      {
        id: '1',
        name: 'Tomatoes',
        category: 'Vegetables',
        price: 2.99,
        stockQuantity: 50,
        minStockLevel: 20,
        unit: 'kg',
        supplier: 'Fresh Farms Co.',
        lastUpdated: Date.now() - 24 * 60 * 60 * 1000,
        isActive: true,
      },
      {
        id: '2',
        name: 'Chicken Breast',
        category: 'Meat',
        price: 12.99,
        stockQuantity: 15,
        minStockLevel: 25,
        unit: 'kg',
        supplier: 'Quality Meats Ltd.',
        lastUpdated: Date.now() - 12 * 60 * 60 * 1000,
        isActive: true,
      },
      {
        id: '3',
        name: 'Olive Oil',
        category: 'Pantry',
        price: 8.99,
        stockQuantity: 30,
        minStockLevel: 15,
        unit: 'L',
        supplier: 'Mediterranean Imports',
        lastUpdated: Date.now() - 48 * 60 * 60 * 1000,
        isActive: true,
      },
      {
        id: '4',
        name: 'Cheese',
        category: 'Dairy',
        price: 6.99,
        stockQuantity: 8,
        minStockLevel: 20,
        unit: 'kg',
        supplier: 'Dairy Delights',
        lastUpdated: Date.now() - 6 * 60 * 60 * 1000,
        isActive: true,
      },
      {
        id: '5',
        name: 'Flour',
        category: 'Baking',
        price: 3.99,
        stockQuantity: 45,
        minStockLevel: 30,
        unit: 'kg',
        supplier: 'Bakers Supply Co.',
        lastUpdated: Date.now() - 72 * 60 * 60 * 1000,
        isActive: true,
      },
    ];
    setInventoryItems(mockItems);
  };

  const categories = ['All', ...Array.from(new Set(inventoryItems.map(item => item.category)))];
  const filteredItems = inventoryItems.filter(item => 
    (selectedCategory === 'All' || item.category === selectedCategory) &&
    (searchQuery === '' || item.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const lowStockItems = inventoryItems.filter(item => item.stockQuantity <= item.minStockLevel);
  const totalValue = inventoryItems.reduce((sum, item) => sum + (item.price * item.stockQuantity), 0);

  const handleAddItem = () => {
    if (!newItem.name || !newItem.category || !newItem.price || !newItem.stockQuantity) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    const item: InventoryItem = {
      id: Date.now().toString(),
      name: newItem.name,
      category: newItem.category,
      price: parseFloat(newItem.price),
      stockQuantity: parseInt(newItem.stockQuantity),
      minStockLevel: parseInt(newItem.minStockLevel) || 0,
      unit: newItem.unit || 'pcs',
      supplier: newItem.supplier || 'Unknown',
      lastUpdated: Date.now(),
      isActive: true,
    };

    setInventoryItems(prev => [item, ...prev]);
    setShowAddModal(false);
    resetNewItem();
  };

  const handleEditItem = (item: InventoryItem) => {
    setEditingItem(item);
    setNewItem({
      name: item.name,
      category: item.category,
      price: item.price.toString(),
      stockQuantity: item.stockQuantity.toString(),
      minStockLevel: item.minStockLevel.toString(),
      unit: item.unit,
      supplier: item.supplier,
    });
    setShowAddModal(true);
  };
  const handleUpdateItem = () => {
    if (!editingItem) return;

    const updatedItems = inventoryItems.map(item => 
      item.id === editingItem.id ? {
        ...item,
        name: newItem.name,
        category: newItem.category,
        price: parseFloat(newItem.price),
        stockQuantity: parseInt(newItem.stockQuantity),
        minStockLevel: parseInt(newItem.minStockLevel) || 0,
        unit: newItem.unit || 'pcs',
        supplier: newItem.supplier || 'Unknown',
        lastUpdated: Date.now(),
      } : item
    );

    setInventoryItems(updatedItems);
    setShowAddModal(false);
    setEditingItem(null);
    resetNewItem();
  };

  const handleDeleteItem = (itemId: string) => {
    Alert.alert(
      'Delete Item',
      'Are you sure you want to delete this item?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setInventoryItems(prev => prev.filter(item => item.id !== itemId));
          },
        },
      ]
    );
  };

  const handleStockAdjustment = (itemId: string, adjustment: number) => {
    const updatedItems = inventoryItems.map(item => 
      item.id === itemId ? {
        ...item,
        stockQuantity: Math.max(0, item.stockQuantity + adjustment),
        lastUpdated: Date.now(),
      } : item
    );
    setInventoryItems(updatedItems);
  };

  const resetNewItem = () => {
    setNewItem({
      name: '',
      category: '',
      price: '',
      stockQuantity: '',
      minStockLevel: '',
      unit: '',
      supplier: '',
    });
  };

  const getStockStatusColor = (item: InventoryItem) => {
    if (item.stockQuantity === 0) return '#e74c3c';
    if (item.stockQuantity <= item.minStockLevel) return '#f39c12';
    return '#27ae60';
  };

  const getStockStatusText = (item: InventoryItem) => {
    if (item.stockQuantity === 0) return 'Out of Stock';
    if (item.stockQuantity <= item.minStockLevel) return 'Low Stock';
    return 'In Stock';
  };

  const renderInventoryItem = ({ item }: { item: InventoryItem }) => (
    <View style={styles.inventoryCard}>
      <View style={styles.itemHeader}>
        <View style={styles.itemInfo}>
          <Text style={styles.itemName}>{item.name}</Text>
          <Text style={styles.itemCategory}>{item.category}</Text>
        </View>
        <View style={[
          styles.stockStatus,
          { backgroundColor: getStockStatusColor(item) }
        ]}>
          <Text style={styles.stockStatusText}>
            {getStockStatusText(item)}
          </Text>
        </View>
      </View>

      <View style={styles.itemDetails}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Price:</Text>
          <Text style={styles.detailValue}>${item.price.toFixed(2)}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Stock:</Text>
          <Text style={styles.detailValue}>
            {item.stockQuantity} {item.unit}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Min Level:</Text>
          <Text style={styles.detailValue}>
            {item.minStockLevel} {item.unit}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Supplier:</Text>
          <Text style={styles.detailValue}>{item.supplier}</Text>
        </View>
      </View>

      <View style={styles.itemActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.adjustButton]}
          onPress={() => handleStockAdjustment(item.id, 1)}
        >
          <Text style={styles.actionButtonText}>+1</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.actionButton, styles.adjustButton]}
          onPress={() => handleStockAdjustment(item.id, -1)}
        >
          <Text style={styles.actionButtonText}>-1</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.actionButton, styles.editButton]}
          onPress={() => handleEditItem(item)}
        >
          <Text style={styles.actionButtonText}>Edit</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => handleDeleteItem(item.id)}
        >
          <Text style={styles.actionButtonText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={filteredItems}
        renderItem={renderInventoryItem}
        keyExtractor={(item) => item.id}
        style={styles.inventoryList}
        contentContainerStyle={styles.inventoryListContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <Text style={styles.title}>Inventory</Text>
              <Text style={styles.subtitle}>Track stock levels and manage inventory</Text>
            </View>

            <View style={styles.searchSection}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search inventory items..."
                placeholderTextColor={colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesContainer}>
                {categories.map((category) => (
                  <TouchableOpacity
                    key={category}
                    style={[styles.categoryButton, selectedCategory === category && styles.categoryButtonActive]}
                    onPress={() => setSelectedCategory(category)}
                  >
                    <Text style={[styles.categoryButtonText, selectedCategory === category && styles.categoryButtonTextActive]}>
                      {category}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.statsContainer}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{inventoryItems.length}</Text>
                <Text style={styles.statLabel}>Total Items</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{lowStockItems.length}</Text>
                <Text style={styles.statLabel}>Low Stock</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>${totalValue.toFixed(2)}</Text>
                <Text style={styles.statLabel}>Total Value</Text>
              </View>
            </View>

            {lowStockItems.length > 0 && (
              <View style={styles.alertSection}>
                <Text style={styles.alertTitle}>⚠️ Low Stock Alerts</Text>
                <Text style={styles.alertText}>{lowStockItems.length} item{lowStockItems.length !== 1 ? 's' : ''} need{lowStockItems.length !== 1 ? '' : 's'} restocking</Text>
              </View>
            )}
          </View>
        }
      />

      <TouchableOpacity style={styles.addButton} onPress={() => setShowAddModal(true)}>
        <Text style={styles.addButtonText}>+ Add Item</Text>
      </TouchableOpacity>

      <Modal visible={showAddModal} animationType="slide" transparent={true} onRequestClose={() => setShowAddModal(false)}>
        <KeyboardAvoidingView 
          style={styles.modalOverlay} 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editingItem ? 'Edit Item' : 'Add New Item'}</Text>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScrollContent}>
              <TextInput 
                style={styles.modalInput} 
                placeholder="Item Name" 
                placeholderTextColor={colors.textSecondary}
                value={newItem.name} 
                onChangeText={(text) => setNewItem(prev => ({ ...prev, name: text }))} 
              />
              <TextInput 
                style={styles.modalInput} 
                placeholder="Category" 
                placeholderTextColor={colors.textSecondary}
                value={newItem.category} 
                onChangeText={(text) => setNewItem(prev => ({ ...prev, category: text }))} 
              />
              <TextInput 
                style={styles.modalInput} 
                placeholder="Price" 
                placeholderTextColor={colors.textSecondary}
                value={newItem.price} 
                onChangeText={(text) => setNewItem(prev => ({ ...prev, price: text }))} 
                keyboardType="numeric" 
              />
              <TextInput 
                style={styles.modalInput} 
                placeholder="Stock Quantity" 
                placeholderTextColor={colors.textSecondary}
                value={newItem.stockQuantity} 
                onChangeText={(text) => setNewItem(prev => ({ ...prev, stockQuantity: text }))} 
                keyboardType="numeric" 
              />
              <TextInput 
                style={styles.modalInput} 
                placeholder="Minimum Stock Level" 
                placeholderTextColor={colors.textSecondary}
                value={newItem.minStockLevel} 
                onChangeText={(text) => setNewItem(prev => ({ ...prev, minStockLevel: text }))} 
                keyboardType="numeric" 
              />
              <TextInput 
                style={styles.modalInput} 
                placeholder="Unit (kg, L, pcs)" 
                placeholderTextColor={colors.textSecondary}
                value={newItem.unit} 
                onChangeText={(text) => setNewItem(prev => ({ ...prev, unit: text }))} 
              />
              <TextInput 
                style={styles.modalInput} 
                placeholder="Supplier" 
                placeholderTextColor={colors.textSecondary}
                value={newItem.supplier} 
                onChangeText={(text) => setNewItem(prev => ({ ...prev, supplier: text }))} 
              />
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalButton, styles.modalButtonCancel]} onPress={() => { setShowAddModal(false); setEditingItem(null); resetNewItem(); }}>
                <Text style={styles.modalButtonCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.modalButtonConfirm]} onPress={editingItem ? handleUpdateItem : handleAddItem}>
                <Text style={styles.modalButtonConfirmText}>{editingItem ? 'Update' : 'Add'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    backgroundColor: colors.background,
    padding: spacing.md,
    paddingTop: 0,
    borderBottomWidth: 1,
    borderBottomColor: colors.outline,
  },
  title: { fontSize: 28, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 4 },
  subtitle: { fontSize: 14, color: colors.textSecondary },
  searchSection: { backgroundColor: colors.surface, padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.outline },
  searchInput: { borderWidth: 1, borderColor: colors.outline, borderRadius: radius.md, padding: spacing.md, fontSize: 16, backgroundColor: colors.surface2, color: colors.textPrimary, marginBottom: spacing.md },
  categoriesContainer: {
    flexDirection: 'row',
  },
  categoryButton: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.outline, marginRight: spacing.sm, backgroundColor: colors.surface },
  categoryButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  categoryButtonText: { color: colors.textSecondary, fontSize: 14, fontWeight: '500' },
  categoryButtonTextActive: { color: colors.textPrimary },
  statsContainer: { flexDirection: 'row', padding: spacing.md, gap: spacing.md },
  statCard: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: colors.outline, ...shadow.card },
  statValue: { fontSize: 20, fontWeight: 'bold', color: colors.primary, marginBottom: 4 },
  statLabel: { fontSize: 12, color: colors.textSecondary, textAlign: 'center' },
  alertSection: { backgroundColor: colors.surface, borderColor: colors.outline, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, margin: spacing.md },
  alertTitle: { fontSize: 16, fontWeight: 'bold', color: colors.warning, marginBottom: 4 },
  alertText: { fontSize: 14, color: colors.textSecondary },
  inventoryList: {
    flex: 1,
  },
  inventoryListContent: {
    padding: 16,
    paddingBottom: 100,
  },
  inventoryCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.outline, ...shadow.card },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: { fontSize: 18, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 4 },
  itemCategory: { fontSize: 14, color: colors.textSecondary },
  stockStatus: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  stockStatusText: { color: 'white', fontSize: 12, fontWeight: '600' },
  itemDetails: {
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailLabel: { fontSize: 14, color: colors.textSecondary },
  detailValue: { fontSize: 14, color: colors.textPrimary, fontWeight: '500' },
  itemActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: { flex: 1, padding: spacing.sm, borderRadius: radius.md, alignItems: 'center' },
  adjustButton: { backgroundColor: colors.primary },
  editButton: { backgroundColor: colors.warning },
  deleteButton: { backgroundColor: colors.danger },
  actionButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  addButton: { 
    position: 'absolute', 
    bottom: 60, 
    right: 20, 
    backgroundColor: colors.success, 
    paddingHorizontal: 20, 
    paddingVertical: 16, 
    borderRadius: 30, 
    ...shadow.card 
  },
  addButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, width: '90%', maxWidth: 420, maxHeight: '80%', borderWidth: 1, borderColor: colors.outline },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: colors.textPrimary, marginBottom: spacing.lg, textAlign: 'center' },
  modalScrollContent: { paddingBottom: spacing.md },
  modalInput: { borderWidth: 1, borderColor: colors.outline, borderRadius: radius.md, padding: spacing.md, fontSize: 16, marginBottom: spacing.md, backgroundColor: colors.surface2, color: colors.textPrimary },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  modalButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonCancel: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.outline },
  modalButtonConfirm: { backgroundColor: colors.success },
  modalButtonCancelText: { fontSize: 16, fontWeight: '600', color: colors.textSecondary },
  modalButtonConfirmText: { fontSize: 16, fontWeight: '600', color: 'white' },
});
export default InventoryScreen;