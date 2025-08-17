import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, shadow } from '../theme';
import { Table } from '../redux/slices/tablesSlice';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../redux/store';
import { mergeTables } from '../redux/slices/tablesSlice';

interface MergeTableModalProps {
  visible: boolean;
  onClose: () => void;
}

const MergeTableModal: React.FC<MergeTableModalProps> = ({ visible, onClose }) => {
  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set());
  const [mergedName, setMergedName] = useState('');
  
  const dispatch = useDispatch();
  const tables = useSelector((state: RootState) => state.tables.tablesById);
  const tableIds = useSelector((state: RootState) => state.tables.tableIds);
  
  // Get only active, non-merged tables
  const availableTables = tableIds
    .map(id => tables[id])
    .filter(table => table && table.isActive && !table.isMerged);

  const toggleTableSelection = (tableId: string) => {
    const newSelection = new Set(selectedTables);
    if (newSelection.has(tableId)) {
      newSelection.delete(tableId);
    } else {
      newSelection.add(tableId);
    }
    setSelectedTables(newSelection);
  };

  const handleMergeTables = () => {
    if (selectedTables.size < 2) {
      Alert.alert('Error', 'Please select at least 2 tables to merge');
      return;
    }

    const selectedTableIds = Array.from(selectedTables);
    const selectedTableNames = selectedTableIds.map(id => tables[id]?.name || id);
    
    // Check if any selected tables have active orders
    const hasActiveOrders = selectedTableIds.some(tableId => {
      // This would need to be implemented based on your orders state
      // For now, we'll assume no active orders
      return false;
    });

    if (hasActiveOrders) {
      Alert.alert('Error', 'Cannot merge tables with active orders. Please complete or cancel existing orders first.');
      return;
    }

    const name = mergedName.trim() || `Merged (${selectedTableNames.join(' + ')})`;
    
    dispatch(mergeTables({
      tableIds: selectedTableIds,
      mergedName: name,
    }));

    Alert.alert('Success', `Tables merged successfully into "${name}"`);
    setSelectedTables(new Set());
    setMergedName('');
    onClose();
  };

  const getTotalSeats = () => {
    return Array.from(selectedTables).reduce((total, tableId) => {
      const table = tables[tableId];
      return total + (table?.seats || 0);
    }, 0);
  };

  const resetForm = () => {
    setSelectedTables(new Set());
    setMergedName('');
  };

  useEffect(() => {
    if (!visible) {
      resetForm();
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Merge Tables</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.description}>
              Select multiple tables to merge them into a single table group. 
              This is useful for large parties or events.
            </Text>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Available Tables</Text>
              <Text style={styles.sectionSubtitle}>
                Select tables to merge (minimum 2)
              </Text>
            </View>

            <View style={styles.tablesGrid}>
              {availableTables.map((table) => (
                <TouchableOpacity
                  key={table.id}
                  style={[
                    styles.tableCard,
                    selectedTables.has(table.id) && styles.tableCardSelected
                  ]}
                  onPress={() => toggleTableSelection(table.id)}
                >
                  <View style={styles.tableCardHeader}>
                    <Text style={[
                      styles.tableName,
                      selectedTables.has(table.id) && styles.tableNameSelected
                    ]}>
                      {table.name}
                    </Text>
                    {selectedTables.has(table.id) && (
                      <Ionicons 
                        name="checkmark-circle" 
                        size={20} 
                        color={colors.primary} 
                      />
                    )}
                  </View>
                  <Text style={[
                    styles.tableSeats,
                    selectedTables.has(table.id) && styles.tableSeatsSelected
                  ]}>
                    {table.seats} seats
                  </Text>
                  {table.description && (
                    <Text style={[
                      styles.tableDescription,
                      selectedTables.has(table.id) && styles.tableDescriptionSelected
                    ]}>
                      {table.description}
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {selectedTables.size > 0 && (
              <View style={styles.selectionSummary}>
                <Text style={styles.summaryTitle}>Selection Summary</Text>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Selected Tables:</Text>
                  <Text style={styles.summaryValue}>
                    {Array.from(selectedTables).map(id => tables[id]?.name).join(', ')}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Total Seats:</Text>
                  <Text style={styles.summaryValue}>{getTotalSeats()} seats</Text>
                </View>
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Merged Table Name (Optional)</Text>
              <TextInput
                style={styles.input}
                value={mergedName}
                onChangeText={setMergedName}
                placeholder="e.g., Party Table, Large Group"
                placeholderTextColor={colors.textSecondary}
              />
              <Text style={styles.inputHint}>
                Leave empty to use auto-generated name
              </Text>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalButtonCancel}
                onPress={onClose}
              >
                <Text style={styles.modalButtonCancelText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.modalButtonConfirm,
                  selectedTables.size < 2 && styles.modalButtonDisabled
                ]}
                onPress={handleMergeTables}
                disabled={selectedTables.size < 2}
              >
                <Text style={styles.modalButtonConfirmText}>Merge Tables</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
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
    ...shadow.lg,
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
  description: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  section: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  tablesGrid: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  tableCard: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 2,
    borderColor: colors.outline,
  },
  tableCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  tableCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  tableName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  tableNameSelected: {
    color: colors.primary,
  },
  tableSeats: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  tableSeatsSelected: {
    color: colors.primary,
  },
  tableDescription: {
    fontSize: 12,
    color: colors.textMuted,
  },
  tableDescriptionSelected: {
    color: colors.primary + '80',
  },
  selectionSummary: {
    backgroundColor: colors.primary + '10',
    borderRadius: radius.md,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  summaryLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  summaryValue: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  inputGroup: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
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
  inputHint: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: spacing.xs,
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
  modalButtonDisabled: {
    backgroundColor: colors.textMuted,
  },
});

export default MergeTableModal;
