import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type Table = {
  id: string;
  name: string;
  seats: number;
  description?: string;
  isActive: boolean;
  createdAt: number;
  isMerged?: boolean;
  mergedTables?: string[]; // Array of table IDs that are merged
  mergedTableNames?: string[]; // Array of table names for display
  totalSeats?: number; // Total seats when merged
  // Reservation
  isReserved?: boolean;
  reservedAt?: number;
  reservedUntil?: number;
  reservedBy?: string;
  reservedNote?: string;
};

export type TablesState = {
  tablesById: Record<string, Table>;
  tableIds: string[];
  isInitialized: boolean;
  nextTableId: number;
};

const initialState: TablesState = {
  tablesById: {},
  tableIds: [],
  isInitialized: false,
  nextTableId: 5, // Start after default tables
};

const tablesSlice = createSlice({
  name: "tables",
  initialState,
  reducers: {
    addTable: {
      prepare: (name: string, seats: number = 4, description?: string) => ({ payload: { name, seats, description } }),
      reducer: (state, action: PayloadAction<{ name: string; seats: number; description?: string }>) => {
        const tableId = `table-${state.nextTableId}`;
        const table: Table = {
          id: tableId,
          name: action.payload.name,
          seats: action.payload.seats,
          description: action.payload.description,
          isActive: true,
          createdAt: Date.now(),
        };
        state.tablesById[table.id] = table;
        state.tableIds.push(table.id);
        state.nextTableId += 1;
      },
    },
    updateTable: (state, action: PayloadAction<{ id: string; name: string; seats?: number; description?: string }>) => {
      const table = state.tablesById[action.payload.id];
      if (table) {
        table.name = action.payload.name;
        if (action.payload.seats !== undefined) {
          table.seats = action.payload.seats;
        }
        if (action.payload.description !== undefined) {
          table.description = action.payload.description;
        }
      }
    },
    removeTable: (state, action: PayloadAction<{ id: string }>) => {
      delete state.tablesById[action.payload.id];
      state.tableIds = state.tableIds.filter(id => id !== action.payload.id);
    },
    toggleTableStatus: (state, action: PayloadAction<{ id: string }>) => {
      const table = state.tablesById[action.payload.id];
      if (table) {
        table.isActive = !table.isActive;
      }
    },
    initializeDefaultTables: (state) => {
      // Only initialize if we haven't done it before AND there are no tables
      if (!state.isInitialized && state.tableIds.length === 0) {
        const defaultTables = [
          { id: "table-1", name: "Table 1", seats: 4, description: "Standard 4-seater table", isActive: true, createdAt: Date.now() },
          { id: "table-2", name: "Table 2", seats: 4, description: "Standard 4-seater table", isActive: true, createdAt: Date.now() },
          { id: "table-3", name: "Table 3", seats: 6, description: "Large 6-seater table", isActive: true, createdAt: Date.now() },
          { id: "table-4", name: "Table 4", seats: 6, description: "Large 6-seater table", isActive: true, createdAt: Date.now() },
        ];
        
        defaultTables.forEach(table => {
          state.tablesById[table.id] = table;
          state.tableIds.push(table.id);
        });
        
        state.isInitialized = true;
      }
    },
    resetTables: (state) => {
      state.tablesById = {};
      state.tableIds = [];
      state.isInitialized = false;
      state.nextTableId = 5; // Reset to start after default tables
    },
    clearDuplicates: (state) => {
      // Remove duplicate table IDs
      const uniqueIds = [...new Set(state.tableIds)];
      state.tableIds = uniqueIds;
      
      // Keep only tables that exist in tableIds
      const validTables: Record<string, Table> = {};
      uniqueIds.forEach(id => {
        if (state.tablesById[id]) {
          validTables[id] = state.tablesById[id];
        }
      });
      state.tablesById = validTables;
      
      // Update nextTableId to be after the highest table number
      const highestNumber = Math.max(
        ...uniqueIds
          .map(id => parseInt(id.replace('table-', '')))
          .filter(num => !isNaN(num))
      );
      state.nextTableId = highestNumber + 1;
    },
    reserveTable: (state, action: PayloadAction<{ id: string; reservedBy?: string; reservedUntil?: number; reservedNote?: string }>) => {
      const t = state.tablesById[action.payload.id];
      if (!t) return;
      t.isReserved = true;
      t.reservedAt = Date.now();
      t.reservedBy = action.payload.reservedBy;
      t.reservedUntil = action.payload.reservedUntil;
      t.reservedNote = action.payload.reservedNote;
    },
    unreserveTable: (state, action: PayloadAction<{ id: string }>) => {
      const t = state.tablesById[action.payload.id];
      if (!t) return;
      t.isReserved = false;
      t.reservedAt = undefined;
      t.reservedBy = undefined;
      t.reservedUntil = undefined;
      t.reservedNote = undefined;
    },
    mergeTables: (state, action: PayloadAction<{ tableIds: string[]; mergedName?: string; mergedTableId?: string }>) => {
      const { tableIds, mergedName, mergedTableId } = action.payload;
      if (tableIds.length < 2) return;
      
      // Create merged table
      const newMergedTableId = mergedTableId || `merged-${Date.now()}`;
      const mergedTableNames = tableIds.map(id => state.tablesById[id]?.name || id);
      const totalSeats = tableIds.reduce((sum, id) => sum + (state.tablesById[id]?.seats || 0), 0);
      
      const mergedTable: Table = {
        id: newMergedTableId,
        name: mergedName || `Merged (${mergedTableNames.join(' + ')})`,
        seats: totalSeats,
        description: `Merged tables: ${mergedTableNames.join(', ')}`,
        isActive: true,
        createdAt: Date.now(),
        isMerged: true,
        mergedTables: tableIds,
        mergedTableNames,
        totalSeats,
      };
      
      // Add merged table
      state.tablesById[mergedTable.id] = mergedTable;
      state.tableIds.push(mergedTable.id);
      
      // Mark original tables as inactive
      tableIds.forEach(id => {
        if (state.tablesById[id]) {
          state.tablesById[id].isActive = false;
        }
      });
    },
    unmergeTables: (state, action: PayloadAction<{ mergedTableId: string }>) => {
      const { mergedTableId } = action.payload;
      const mergedTable = state.tablesById[mergedTableId];
      
      if (mergedTable?.isMerged && mergedTable.mergedTables) {
        // Reactivate original tables
        mergedTable.mergedTables.forEach(id => {
          if (state.tablesById[id]) {
            state.tablesById[id].isActive = true;
          }
        });
        
        // Remove merged table
        delete state.tablesById[mergedTableId];
        state.tableIds = state.tableIds.filter(id => id !== mergedTableId);
      }
    },
  },
});

export const {
  addTable,
  updateTable,
  removeTable,
  toggleTableStatus,
  initializeDefaultTables,
  resetTables,
  clearDuplicates,
  mergeTables,
  unmergeTables,
  reserveTable,
  unreserveTable,
} = tablesSlice.actions;

// Selectors
export const selectActiveTables = (state: { tables: TablesState }) => {
  const { tablesById, tableIds } = state.tables;
  return tableIds
    .map(id => tablesById[id])
    .filter(table => table && table.isActive);
};

export const selectVisibleTables = (state: { tables: TablesState }) => {
  const { tablesById, tableIds } = state.tables;
  return tableIds
    .map(id => tablesById[id])
    .filter(table => table && table.isActive && !table.isMerged && !table.isReserved);
};

export const selectMergedTables = (state: { tables: TablesState }) => {
  const { tablesById, tableIds } = state.tables;
  return tableIds
    .map(id => tablesById[id])
    .filter(table => table && table.isMerged);
};

export const selectAllTablesForManagement = (state: { tables: TablesState }) => {
  const { tablesById, tableIds } = state.tables;
  return tableIds
    .map(id => tablesById[id])
    .filter(table => table); // Show all tables including inactive ones for management
};

export default tablesSlice.reducer;

