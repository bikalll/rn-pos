import React, { useState, useEffect } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../redux/store';
import { addTable, updateTable, removeTable, toggleTableStatus, initializeDefaultTables, resetTables, clearDuplicates } from '../../redux/slices/tablesSlice';
import { colors, spacing, radius } from '../../theme';

const TableManagementScreen: React.FC = () => {
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editingTable, setEditingTable] = useState<any>(null);
  const [newTableName, setNewTableName] = useState('');
  const [newTableSeats, setNewTableSeats] = useState('4');
  const [newTableDescription, setNewTableDescription] = useState('');
  const [editTableName, setEditTableName] = useState('');
  const [editTableSeats, setEditTableSeats] = useState('4');
  const [editTableDescription, setEditTableDescription] = useState('');

  const dispatch = useDispatch();
  const tables = useSelector((state: RootState) => state.tables.tablesById);
  const tableIds = useSelector((state: RootState) => state.tables.tableIds);

  useEffect(() => {
    // Initialize default tables only once if not already initialized
    dispatch(initializeDefaultTables());
    
    // Clear any duplicates that might exist
    dispatch(clearDuplicates());
  }, [dispatch]);

  const handleAddTable = () => {
    if (newTableName.trim()) {
      const seats = parseInt(newTableSeats) || 4;
      dispatch(addTable(newTableName.trim(), seats, newTableDescription.trim() || undefined));
      setNewTableName('');
      setNewTableSeats('4');
      setNewTableDescription('');
      setIsAddModalVisible(false);
    }
  };

  const handleEditTable = () => {
    if (editTableName.trim() && editingTable) {
      const seats = parseInt(editTableSeats) || 4;
      dispatch(updateTable({ 
        id: editingTable.id, 
        name: editTableName.trim(),
        seats: seats,
        description: editTableDescription.trim() || undefined
      }));
      setEditTableName('');
      setEditTableSeats('4');
      setEditTableDescription('');
      setEditingTable(null);
      setIsEditModalVisible(false);
    }
  };

  const handleDeleteTable = (tableId: string) => {
    Alert.alert(
      'Delete Table',
      'Are you sure you want to delete this table? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => dispatch(removeTable({ id: tableId }))
        },
      ]
    );
  };

  const openEditModal = (table: any) => {
    console.log('Opening edit modal for table:', table);
    setEditingTable(table);
    setEditTableName(table.name);
    setEditTableSeats((table.seats || 4).toString());
    setEditTableDescription(table.description || '');
    setIsEditModalVisible(true);
  };

  const renderTable = (tableId: string) => {
    const table = tables[tableId];
    if (!table) return null;

    return (
      <View key={table.id} style={styles.tableCard}>
        <View style={styles.tableInfo}>
          <Text style={styles.tableName}>{table.name}</Text>
          <Text style={styles.tableSeats}>{(table.seats || 4)} seats</Text>
          {table.description && (
            <Text style={styles.tableDescription}>{table.description}</Text>
          )}
          <View style={[styles.statusIndicator, { backgroundColor: table.isActive ? colors.success : colors.danger }]}>
            <Text style={styles.statusText}>{table.isActive ? 'Active' : 'Inactive'}</Text>
          </View>
        </View>
        
        <View style={styles.tableActions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.editButton]}
            onPress={() => openEditModal(table)}
          >
            <Ionicons name="pencil" size={16} color={colors.textPrimary} />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionButton, styles.toggleButton]}
            onPress={() => dispatch(toggleTableStatus({ id: table.id }))}
          >
            <Ionicons 
              name={table.isActive ? "pause" : "play"} 
              size={16} 
              color={colors.textPrimary} 
            />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => handleDeleteTable(table.id)}
          >
            <Ionicons name="trash" size={16} color={colors.danger} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.title}>Table Management</Text>
            <Text style={styles.subtitle}>
              Add, edit, and manage your restaurant tables ({tableIds.length} total)
            </Text>
          </View>
          <View style={styles.headerButtons}>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => {
                Alert.alert(
                  'Clear Duplicates',
                  'This will remove any duplicate tables. Are you sure?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { 
                      text: 'Clear', 
                      style: 'default',
                      onPress: () => dispatch(clearDuplicates())
                    },
                  ]
                );
              }}
            >
              <Ionicons name="copy-outline" size={20} color={colors.warning} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.resetButton}
              onPress={() => {
                Alert.alert(
                  'Reset Tables',
                  'This will remove all tables and recreate the default ones. Are you sure?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { 
                      text: 'Reset', 
                      style: 'destructive',
                      onPress: () => dispatch(resetTables())
                    },
                  ]
                );
              }}
            >
              <Ionicons name="refresh" size={20} color={colors.danger} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.addButtonContainer}>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setIsAddModalVisible(true)}
        >
          <Ionicons name="add" size={24} color={colors.textPrimary} />
          <Text style={styles.addButtonText}>Add New Table</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {tableIds.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No tables configured</Text>
            <Text style={styles.emptyStateSubtext}>Add your first table to get started</Text>
          </View>
        ) : (
          <View style={styles.tablesList}>
            {tableIds.map(renderTable)}
          </View>
        )}
      </ScrollView>

      {/* Add Table Modal */}
      <Modal
        visible={isAddModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsAddModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add New Table</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter table name (e.g., Table 1, VIP 1)"
              value={newTableName}
              onChangeText={setNewTableName}
              autoFocus
            />
            <TextInput
              style={styles.input}
              placeholder="Enter number of seats (e.g., 4, 6)"
              value={newTableSeats}
              onChangeText={setNewTableSeats}
              keyboardType="numeric"
            />
            <TextInput
              style={styles.input}
              placeholder="Enter table description (optional)"
              value={newTableDescription}
              onChangeText={setNewTableDescription}
              multiline
              numberOfLines={2}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => setIsAddModalVisible(false)}
              >
                <Text style={styles.modalButtonSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handleAddTable}
              >
                <Text style={styles.modalButtonPrimaryText}>Add Table</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Table Modal */}
      <Modal
        visible={isEditModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Table</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter table name"
              value={editTableName}
              onChangeText={setEditTableName}
              autoFocus
            />
            <TextInput
              style={styles.input}
              placeholder="Enter number of seats (e.g., 4, 6)"
              value={editTableSeats}
              onChangeText={setEditTableSeats}
              keyboardType="numeric"
            />
            <TextInput
              style={styles.input}
              placeholder="Enter table description (optional)"
              value={editTableDescription}
              onChangeText={setEditTableDescription}
              multiline
              numberOfLines={2}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => setIsEditModalVisible(false)}
              >
                <Text style={styles.modalButtonSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handleEditTable}
              >
                <Text style={styles.modalButtonPrimaryText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
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
  header: {
    backgroundColor: colors.background,
    padding: spacing.md,
    paddingTop: 0,
    borderBottomWidth: 1,
    borderBottomColor: colors.outline,
  },
  headerTop: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'flex-start' 
  },
  headerButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  headerButton: {
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.outline,
  },
  resetButton: {
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.outline,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  addButtonContainer: {
    padding: spacing.md,
    paddingBottom: spacing.sm,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  addButtonText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: spacing.xs,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
    padding: spacing.md,
    paddingTop: 0,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl * 2,
  },
  emptyStateText: {
    fontSize: 18,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  tablesList: {
    width: '100%',
  },
  tableCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.outline,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tableInfo: {
    flex: 1,
  },
  tableName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  tableSeats: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  tableDescription: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    fontStyle: 'italic',
  },
  statusIndicator: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 12,
    color: colors.textPrimary,
    fontWeight: 'bold',
  },
  tableActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  actionButton: {
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.outline,
  },
  editButton: {
    backgroundColor: colors.warning,
  },
  toggleButton: {
    backgroundColor: colors.info,
  },
  deleteButton: {
    backgroundColor: colors.surface2,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    padding: spacing.md,
    width: '80%',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  input: {
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 18,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.outline,
    width: '100%',
    marginBottom: spacing.md,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  modalButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    minWidth: 100,
    alignItems: 'center',
  },
  modalButtonSecondary: {
    backgroundColor: colors.outline,
  },
  modalButtonSecondaryText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalButtonPrimary: {
    backgroundColor: colors.primary,
  },
  modalButtonPrimaryText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default TableManagementScreen;
