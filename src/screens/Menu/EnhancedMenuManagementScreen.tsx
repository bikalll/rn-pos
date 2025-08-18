import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { MenuItemForm, MenuItemImage } from '../../components';
import { MenuItem } from '../../components/MenuItemForm';
import { ImageInfo } from '../../services/imageService';
import { RootState } from '../../redux/store';
import { MenuItem as ReduxMenuItem, addMenuItem, updateMenuItem, removeMenuItem, toggleAvailability } from '../../redux/slices/menuSlice';

const EnhancedMenuManagementScreen: React.FC = () => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  
  const dispatch = useDispatch();
  const menuItemsById = useSelector((state: RootState) => state.menu.itemsById);
  
  // Convert itemsById to array for easier handling
  const menuItems: ReduxMenuItem[] = Object.values(menuItemsById);

  const categories = [
    'Appetizers',
    'Main Course',
    'Desserts',
    'Beverages',
    'Salads',
    'Soups',
    'Fast Food',
    'Healthy Options',
  ];

  const handleAddItem = (item: MenuItem) => {
    // Convert component MenuItem to Redux MenuItem
    const reduxMenuItem: ReduxMenuItem = {
      id: Date.now().toString(),
      name: item.name,
      description: item.description || '', // Ensure description is always a string
      price: item.price,
      category: item.category,
      isAvailable: item.isAvailable,
      modifiers: [], // Default empty array for modifiers
      image: undefined, // Redux MenuItem uses image string, not imageInfo
      orderType: item.orderType,
    };
    
    dispatch(addMenuItem(reduxMenuItem));
    
    setShowAddModal(false);
    Alert.alert('Success', 'Menu item added successfully!');
  };

  const handleEditItem = (item: MenuItem) => {
    setEditingItem(item);
  };

  const handleUpdateItem = (updatedItem: MenuItem) => {
    if (editingItem) {
      const reduxMenuItem: ReduxMenuItem = {
        id: editingItem.id || Date.now().toString(),
        name: updatedItem.name,
        description: updatedItem.description || '',
        price: updatedItem.price,
        category: updatedItem.category,
        isAvailable: updatedItem.isAvailable,
        modifiers: [], // Default empty array for modifiers
        image: undefined, // Redux MenuItem uses image string, not imageInfo
        orderType: updatedItem.orderType,
      };
      
      dispatch(updateMenuItem(reduxMenuItem));
    }
    setEditingItem(null);
    Alert.alert('Success', 'Menu item updated successfully!');
  };

  const handleDeleteItem = (itemId: string) => {
    Alert.alert(
      'Delete Item',
      'Are you sure you want to delete this menu item?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            dispatch(removeMenuItem(itemId));
            Alert.alert('Success', 'Menu item deleted successfully!');
          },
        },
      ]
    );
  };

  const handleToggleAvailability = (itemId: string) => {
    dispatch(toggleAvailability(itemId));
  };

  const filteredItems = selectedCategory === 'All' 
    ? menuItems 
    : menuItems.filter(item => item.category === selectedCategory);

  const renderMenuItem = ({ item }: { item: ReduxMenuItem }) => (
    <View style={styles.menuItemCard}>
      <View style={styles.menuItemHeader}>
        <View style={styles.menuItemInfo}>
          <Text style={styles.menuItemName}>{item.name}</Text>
          <Text style={styles.menuItemCategory}>{item.category}</Text>
        </View>
        <View style={styles.menuItemActions}>
          <TouchableOpacity
            style={[
              styles.availabilityToggle,
              item.isAvailable && styles.availabilityToggleActive,
            ]}
            onPress={() => handleToggleAvailability(item.id!)}
          >
            <Text
              style={[
                styles.availabilityText,
                item.isAvailable && styles.availabilityTextActive,
              ]}
            >
              {item.isAvailable ? 'Available' : 'Not Available'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.menuItemContent}>
        <View style={styles.menuItemImage}>
          <MenuItemImage
            imageInfo={null} // Redux MenuItem doesn't have imageInfo, using null
            size="small"
            editable={false}
          />
        </View>
        
        <View style={styles.menuItemDetails}>
          <Text style={styles.menuItemDescription}>{item.description || ''}</Text>
          <View style={styles.menuItemMeta}>
            <Text style={styles.menuItemPrice}>₹{item.price.toFixed(2)}</Text>
            <Text style={styles.menuItemOrderType}>{item.orderType}</Text>
          </View>
        </View>
      </View>

      <View style={styles.menuItemFooter}>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => handleEditItem(item)}
        >
          <Ionicons name="create-outline" size={20} color="#007AFF" />
          <Text style={styles.editButtonText}>Edit</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDeleteItem(item.id!)}
        >
          <Ionicons name="trash-outline" size={20} color="#ff3b30" />
          <Text style={styles.deleteButtonText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderCategoryFilter = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.categoryFilter}
      contentContainerStyle={styles.categoryFilterContent}
    >
      {['All', ...categories].map((category) => (
        <TouchableOpacity
          key={category}
          style={[
            styles.categoryChip,
            selectedCategory === category && styles.categoryChipSelected,
          ]}
          onPress={() => setSelectedCategory(category)}
        >
          <Text
            style={[
              styles.categoryChipText,
              selectedCategory === category && styles.categoryChipTextSelected,
            ]}
          >
            {category}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Menu Management</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowAddModal(true)}
        >
          <Ionicons name="add" size={24} color="#fff" />
          <Text style={styles.addButtonText}>Add Item</Text>
        </TouchableOpacity>
      </View>

      {renderCategoryFilter()}



      <FlatList
        data={filteredItems}
        renderItem={renderMenuItem}
        keyExtractor={(item) => item.id!}
        contentContainerStyle={styles.menuList}
        showsVerticalScrollIndicator={false}
      />

      {/* Add Item Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddModal(false)}
      >
        <MenuItemForm
          onSave={handleAddItem}
          onCancel={() => setShowAddModal(false)}
          categories={categories}
        />
      </Modal>

      {/* Edit Item Modal */}
      <Modal
        visible={!!editingItem}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <MenuItemForm
          item={editingItem!}
          onSave={handleUpdateItem}
          onCancel={() => setEditingItem(null)}
          categories={categories}
        />
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
  },
  categoryFilter: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  categoryFilterContent: {
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  categoryChipSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  categoryChipText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '500',
  },
  categoryChipTextSelected: {
    color: '#fff',
  },
  menuList: {
    padding: 20,
  },
  menuItemCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  menuItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  menuItemInfo: {
    flex: 1,
  },
  menuItemName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  menuItemCategory: {
    fontSize: 14,
    color: '#666',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  menuItemActions: {
    alignItems: 'flex-end',
  },
  availabilityToggle: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  availabilityToggleActive: {
    backgroundColor: '#28a745',
    borderColor: '#28a745',
  },
  availabilityText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  availabilityTextActive: {
    color: '#fff',
  },
  menuItemContent: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  menuItemImage: {
    marginRight: 12,
  },
  menuItemDetails: {
    flex: 1,
  },
  menuItemDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 8,
  },
  menuItemMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  menuItemPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  menuItemTime: {
    fontSize: 12,
    color: '#999',
  },
  menuItemOrderType: {
    fontSize: 12,
    color: '#999',
  },
  menuItemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  editButtonText: {
    color: '#007AFF',
    fontWeight: '500',
    marginLeft: 4,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  deleteButtonText: {
    color: '#ff3b30',
    fontWeight: '500',
    marginLeft: 4,
  },

});

export default EnhancedMenuManagementScreen;
