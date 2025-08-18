import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  FlatList,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, shadow } from '../../theme';
import { RootState } from '../../redux/store';
import { 
  addCustomer, 
  updateCustomer, 
  deleteCustomer, 
  updateLoyaltyPoints, 
  updateCreditAmount 
} from '../../redux/slices/customersSlice';
import { Customer } from '../../utils/types';

const CustomerManagementScreen: React.FC = () => {
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
  });
  const [searchQuery, setSearchQuery] = useState('');

  const dispatch = useDispatch();
  const navigation = useNavigation();
  const customers = useSelector((state: RootState) => state.customers.customersById);
  const [showCreditOnly, setShowCreditOnly] = useState(false);
  const customersList = useMemo(() => {
    let list = Object.values(customers) as Customer[];
    if (showCreditOnly) {
      list = list.filter(c => (c.creditAmount || 0) > 0.0001);
    }
    const q = searchQuery.trim().toLowerCase();
    if (q.length > 0) {
      list = list.filter(c =>
        (c.name || '').toLowerCase().includes(q) || (c.phone || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [customers, showCreditOnly, searchQuery]);

  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      email: '',
      address: '',
    });
  };

  const handleAddCustomer = () => {
    const name = formData.name.trim();
    const phone = formData.phone.trim();
    if (!name && !phone) {
      Alert.alert('Error', 'Enter customer name or phone number');
      return;
    }

    const newCustomer: Customer = {
      id: `CUST-${Date.now()}`,
      name: name || phone,
      phone: phone || undefined,
      email: formData.email.trim() || undefined,
      address: formData.address.trim() || undefined,
      creditAmount: 0,
      loyaltyPoints: 0,
      visitCount: 0,
      createdAt: Date.now(),
    };

    dispatch(addCustomer(newCustomer));
    setAddModalVisible(false);
    resetForm();
    Alert.alert('Success', 'Customer added successfully!');
  };

  const handleEditCustomer = () => {
    if (!selectedCustomer) return;
    const name = formData.name.trim();
    const phone = formData.phone.trim();
    if (!name && !phone) {
      Alert.alert('Error', 'Enter customer name or phone number');
      return;
    }

    const updatedCustomer: Partial<Customer> = {
      name: name || phone,
      phone: phone || undefined,
      email: formData.email.trim() || undefined,
      address: formData.address.trim() || undefined,
    };

    dispatch(updateCustomer({ id: selectedCustomer.id, ...updatedCustomer }));
    setEditModalVisible(false);
    setSelectedCustomer(null);
    resetForm();
    Alert.alert('Success', 'Customer updated successfully!');
  };

  const handleDeleteCustomer = (customer: Customer) => {
    Alert.alert(
      'Delete Customer',
      `Are you sure you want to delete ${customer.name || customer.phone || 'this customer'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            dispatch(deleteCustomer(customer.id));
            Alert.alert('Success', 'Customer deleted successfully!');
          },
        },
      ]
    );
  };

  const openEditModal = (customer: Customer) => {
    setSelectedCustomer(customer);
    setFormData({
      name: customer.name,
      phone: customer.phone || '',
      email: customer.email || '',
      address: customer.address || '',
    });
    setEditModalVisible(true);
  };

  const renderCustomerCard = ({ item }: { item: Customer }) => {
    const isNumeric = (s?: string) => !!s && /^\d+$/.test(s.trim());
    const displayName = (() => {
      const name = (item.name || '').trim();
      const phone = (item.phone || '').trim();
      if (!name) return phone || 'Customer';
      if (isNumeric(name) && phone && phone.length > name.length) return phone;
      return name;
    })();

    return (
    <View style={styles.customerCard}>
      <View style={styles.customerHeader}>
        <Text style={styles.customerName}>{displayName}</Text>
        <TouchableOpacity
          style={styles.moreButton}
          onPress={() => openEditModal(item)}
        >
          <Ionicons name="ellipsis-vertical" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
      
      <View style={styles.customerDetails}>
        {item.phone && (
          <View style={styles.detailRow}>
            <Ionicons name="call-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.detailText}>{item.phone}</Text>
          </View>
        )}
        
        {item.address && (
          <View style={styles.detailRow}>
            <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.detailText}>{item.address}</Text>
          </View>
        )}
        
        <View style={styles.detailRow}>
          <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.detailText}>
            {item.visitCount || 0} visits
          </Text>
        </View>
        
        <View style={styles.detailRow}>
          <Ionicons name="card-outline" size={16} color={colors.textSecondary} />
          <Text style={[styles.detailText, { color: item.creditAmount && item.creditAmount > 0 ? colors.danger : colors.success }]}>
            Credit: {item.creditAmount ? `Rs ${item.creditAmount.toFixed(2)}` : '-'}
          </Text>
        </View>
        
        <View style={styles.detailRow}>
          <Ionicons name="star-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.detailText}>
            {item.loyaltyPoints || 0} pts
          </Text>
        </View>
      </View>
      
      <View style={styles.cardActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.viewProfileButton]}
          onPress={() => {
            (navigation as any).navigate('CustomerProfile', { customerId: item.id });
          }}
        >
          <Ionicons name="person-outline" size={16} color={'white'} />
          <Text style={[styles.actionButtonText, styles.actionButtonTextOnDark]}>View Profile</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.actionButton, styles.editButton]}
          onPress={() => openEditModal(item)}
        >
          <Ionicons name="create-outline" size={16} color={'white'} />
          <Text style={[styles.actionButtonText, styles.actionButtonTextOnDark]}>Edit</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => handleDeleteCustomer(item)}
        >
          <Ionicons name="trash-outline" size={16} color={'white'} />
          <Text style={[styles.actionButtonText, styles.actionButtonTextOnDark]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.searchRow}>
          <Ionicons name="search" size={18} color={colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search name or phone"
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        <View style={styles.filtersRow}>
          <TouchableOpacity
            style={[styles.filterChip, showCreditOnly && styles.filterChipActive]}
            onPress={() => setShowCreditOnly(!showCreditOnly)}
          >
            <Ionicons name="card-outline" size={16} color={showCreditOnly ? 'white' : colors.textSecondary} />
            <Text style={[styles.filterChipText, showCreditOnly && styles.filterChipTextActive]}>Credit Only</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setAddModalVisible(true)}
        >
          <Ionicons name="add" size={20} color="white" />
          <Text style={styles.addButtonText}>Add Customer</Text>
        </TouchableOpacity>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customers</Text>
          <Text style={styles.sectionSubtitle}>List of all customers</Text>
        </View>

        {customersList.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={48} color={colors.textSecondary} />
            <Text style={styles.emptyStateText}>No customers yet</Text>
            <Text style={styles.emptyStateSubtext}>Add your first customer to get started</Text>
          </View>
        ) : (
          <FlatList
            data={customersList}
            renderItem={renderCustomerCard}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContainer}
          />
        )}
      </View>

      {/* Add Customer Modal */}
      <Modal
        visible={addModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setAddModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Customer</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  setAddModalVisible(false);
                  resetForm();
                }}
              >
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Name *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.name}
                  onChangeText={(text) => setFormData({ ...formData, name: text })}
                  placeholder="Enter customer name"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Phone</Text>
                <TextInput
                  style={styles.input}
                  value={formData.phone}
                  onChangeText={(text) => setFormData({ ...formData, phone: text })}
                  placeholder="Enter phone number"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email</Text>
                <TextInput
                  style={styles.input}
                  value={formData.email}
                  onChangeText={(text) => setFormData({ ...formData, email: text })}
                  placeholder="Enter email address"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Address</Text>
                <TextInput
                  style={styles.input}
                  value={formData.address}
                  onChangeText={(text) => setFormData({ ...formData, address: text })}
                  placeholder="Enter address"
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  numberOfLines={2}
                />
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalButtonCancel}
                  onPress={() => {
                    setAddModalVisible(false);
                    resetForm();
                  }}
                >
                  <Text style={styles.modalButtonCancelText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.modalButtonConfirm}
                  onPress={handleAddCustomer}
                >
                  <Text style={styles.modalButtonConfirmText}>Add Customer</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Edit Customer Modal */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Customer</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  setEditModalVisible(false);
                  setSelectedCustomer(null);
                  resetForm();
                }}
              >
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Name *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.name}
                  onChangeText={(text) => setFormData({ ...formData, name: text })}
                  placeholder="Enter customer name"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Phone</Text>
                <TextInput
                  style={styles.input}
                  value={formData.phone}
                  onChangeText={(text) => setFormData({ ...formData, phone: text })}
                  placeholder="Enter phone number"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email</Text>
                <TextInput
                  style={styles.input}
                  value={formData.email}
                  onChangeText={(text) => setFormData({ ...formData, email: text })}
                  placeholder="Enter email address"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Address</Text>
                <TextInput
                  style={styles.input}
                  value={formData.address}
                  onChangeText={(text) => setFormData({ ...formData, address: text })}
                  placeholder="Enter address"
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  numberOfLines={2}
                />
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalButtonCancel}
                  onPress={() => {
                    setEditModalVisible(false);
                    setSelectedCustomer(null);
                    resetForm();
                  }}
                >
                  <Text style={styles.modalButtonCancelText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.modalButtonConfirm}
                  onPress={handleEditCustomer}
                >
                  <Text style={styles.modalButtonConfirmText}>Update Customer</Text>
                </TouchableOpacity>
              </View>
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
  addButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
    ...shadow.card,
  },
  addButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: spacing.sm,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  listContainer: {
    paddingBottom: spacing.lg,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface2,
    marginBottom: spacing.md,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 14,
    paddingVertical: spacing.xs,
  },
  filtersRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.surface2,
    gap: spacing.xs,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: 'white',
  },
  customerCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadow.card,
  },
  customerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  customerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  moreButton: {
    padding: spacing.xs,
  },
  customerDetails: {
    marginBottom: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  detailText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
    flex: 1,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.outline,
    paddingTop: spacing.md,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.surface2,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: spacing.xs,
  },
  actionButtonTextOnDark: {
    color: 'white',
  },
  deleteButton: {
    backgroundColor: colors.danger,
  },
  editButton: {
    backgroundColor: colors.primary,
  },
  viewProfileButton: {
    backgroundColor: colors.info,
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
  closeButton: {
    padding: spacing.xs,
  },
  inputGroup: {
    marginBottom: spacing.md,
    paddingHorizontal: spacing.lg,
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
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.outline,
  },
  modalButtonCancel: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.outline,
    marginRight: spacing.sm,
    alignItems: 'center',
  },
  modalButtonCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  modalButtonConfirm: {
    flex: 1,
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: radius.md,
    marginLeft: spacing.sm,
    alignItems: 'center',
  },
  modalButtonConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});

export default CustomerManagementScreen;
