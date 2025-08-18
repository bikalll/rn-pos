import { createSlice, PayloadAction, nanoid } from "@reduxjs/toolkit";
import { Order, OrderItem, PaymentInfo } from "../../utils/types";

export type OrdersState = {
  ordersById: Record<string, Order>;
  ongoingOrderIds: string[];
  completedOrderIds: string[];
};

const initialState: OrdersState = {
  ordersById: {},
  ongoingOrderIds: [],
  completedOrderIds: [],
};

const ordersSlice = createSlice({
  name: "orders",
  initialState,
  reducers: {
    createOrder: {
      prepare: (tableId: string, mergedTableIds?: string[]) => ({
        payload: { id: nanoid(), tableId, mergedTableIds },
      }),
      reducer: (
        state,
        action: PayloadAction<{ id: string; tableId: string; mergedTableIds?: string[] }>
      ) => {
        const order: Order = {
          id: action.payload.id,
          tableId: action.payload.tableId,
          status: "ongoing",
          items: [],
          discountPercentage: 0,
          serviceChargePercentage: 0,
          taxPercentage: 0,
          mergedTableIds: action.payload.mergedTableIds,
          isMergedOrder: !!action.payload.mergedTableIds,
          createdAt: Date.now(),
        };
        state.ordersById[order.id] = order;
        state.ongoingOrderIds.unshift(order.id);
      },
    },
    addItem: (state, action: PayloadAction<{ orderId: string; item: OrderItem }>) => {
      const order = state.ordersById[action.payload.orderId];
      if (!order) return;
      const existing = order.items.find((i) => i.menuItemId === action.payload.item.menuItemId);
      if (existing) {
        existing.quantity += action.payload.item.quantity;
        existing.modifiers = action.payload.item.modifiers;
      } else {
        order.items.push(action.payload.item);
      }
    },
    removeItem: (state, action: PayloadAction<{ orderId: string; menuItemId: string }>) => {
      const order = state.ordersById[action.payload.orderId];
      if (!order) return;
      order.items = order.items.filter((i) => i.menuItemId !== action.payload.menuItemId);
    },
    updateItemQuantity: (
      state,
      action: PayloadAction<{ orderId: string; menuItemId: string; quantity: number }>
    ) => {
      const order = state.ordersById[action.payload.orderId];
      if (!order) return;
      const existing = order.items.find((i) => i.menuItemId === action.payload.menuItemId);
      if (existing) existing.quantity = action.payload.quantity;
    },
    applyDiscount: (
      state,
      action: PayloadAction<{ orderId: string; discountPercentage: number }>
    ) => {
      const order = state.ordersById[action.payload.orderId];
      if (!order) return;
      order.discountPercentage = action.payload.discountPercentage;
    },
    setPayment: (state, action: PayloadAction<{ orderId: string; payment: PaymentInfo }>) => {
      const order = state.ordersById[action.payload.orderId];
      if (!order) return;
      order.payment = action.payload.payment;
    },
    setOrderCustomer: (state, action: PayloadAction<{ orderId: string; customerName?: string; customerPhone?: string }>) => {
      const order = state.ordersById[action.payload.orderId];
      if (!order) return;
      (order as any).customerName = action.payload.customerName;
      (order as any).customerPhone = action.payload.customerPhone;
    },
    completeOrder: (state, action: PayloadAction<{ orderId: string }>) => {
      const order = state.ordersById[action.payload.orderId];
      if (!order) return;
      order.status = "completed";
      state.ongoingOrderIds = state.ongoingOrderIds.filter((id) => id !== order.id);
      state.completedOrderIds.unshift(order.id);
    },
    cancelOrder: (state, action: PayloadAction<{ orderId: string }>) => {
      delete state.ordersById[action.payload.orderId];
      state.ongoingOrderIds = state.ongoingOrderIds.filter(
        (id) => id !== action.payload.orderId
      );
      state.completedOrderIds = state.completedOrderIds.filter(
        (id) => id !== action.payload.orderId
      );
    },
    changeOrderTable: (state, action: PayloadAction<{ orderId: string; newTableId: string }>) => {
      const { orderId, newTableId } = action.payload;
      const order = state.ordersById[orderId];
      if (!order) return;
      order.tableId = newTableId;
    },
    markOrderSaved: (state, action: PayloadAction<{ orderId: string }>) => {
      const order = state.ordersById[action.payload.orderId];
      if (order) (order as any).isSaved = true;
    },
    snapshotSavedQuantities: (state, action: PayloadAction<{ orderId: string }>) => {
      const order = state.ordersById[action.payload.orderId];
      if (!order) return;
      const snapshot: Record<string, number> = {};
      for (const item of order.items) {
        snapshot[item.menuItemId] = item.quantity;
      }
      (order as any).savedQuantities = snapshot;
    },
    mergeOrders: (
      state,
      action: PayloadAction<{
        tableIds: string[];
        mergedTableId: string;
        mergedTableName: string;
      }>
    ) => {
      const { tableIds, mergedTableId, mergedTableName } = action.payload;

      // Find all ongoing orders for the tables being merged
      const ordersToMerge = state.ongoingOrderIds
        .map((id) => state.ordersById[id])
        .filter((order) => order && tableIds.includes(order.tableId));

      if (ordersToMerge.length === 0) return;

      // Create a new merged order
      const mergedOrder: Order = {
        id: nanoid(),
        tableId: mergedTableId,
        mergedTableIds: tableIds,
        isMergedOrder: true,
        status: "ongoing",
        items: [],
        discountPercentage: 0,
        serviceChargePercentage: 0,
        taxPercentage: 0,
        createdAt: Date.now(),
      };

      // Consolidate all items from existing orders
      ordersToMerge.forEach((order) => {
        order.items.forEach((item) => {
          const existingItem = mergedOrder.items.find(
            (i) => i.menuItemId === item.menuItemId
          );
          if (existingItem) {
            existingItem.quantity += item.quantity;
            // Merge modifiers if they exist
            if (item.modifiers && existingItem.modifiers) {
              existingItem.modifiers = [
                ...new Set([...existingItem.modifiers, ...item.modifiers]),
              ];
            }
          } else {
            mergedOrder.items.push({ ...item });
          }
        });
      });

      // Add the merged order
      state.ordersById[mergedOrder.id] = mergedOrder;
      state.ongoingOrderIds.unshift(mergedOrder.id);

      // Remove the original orders
      ordersToMerge.forEach((order) => {
        delete state.ordersById[order.id];
        state.ongoingOrderIds = state.ongoingOrderIds.filter((id) => id !== order.id);
      });
    },
    unmergeOrders: (
      state,
      action: PayloadAction<{ mergedTableId: string; originalTableIds: string[] }>
    ) => {
      const { mergedTableId, originalTableIds } = action.payload;

      // Find the merged order
      const mergedOrder = state.ordersById[mergedTableId];
      if (!mergedOrder || !mergedOrder.isMergedOrder) return;

      // Remove the merged order
      delete state.ordersById[mergedTableId];
      state.ongoingOrderIds = state.ongoingOrderIds.filter((id) => id !== mergedTableId);

      // Create individual orders for each original table
      originalTableIds.forEach((tableId) => {
        const newOrder: Order = {
          id: nanoid(),
          tableId: tableId,
          status: "ongoing",
          items: [...mergedOrder.items], // Copy all items to each table
          discountPercentage: mergedOrder.discountPercentage,
          serviceChargePercentage: mergedOrder.serviceChargePercentage,
          taxPercentage: mergedOrder.taxPercentage,
          createdAt: Date.now(),
        };

        state.ordersById[newOrder.id] = newOrder;
        state.ongoingOrderIds.unshift(newOrder.id);
      });
    },
  },
});

export const {
  createOrder,
  addItem,
  removeItem,
  updateItemQuantity,
  applyDiscount,
  setPayment,
  completeOrder,
  cancelOrder,
  changeOrderTable,
  setOrderCustomer,
  mergeOrders,
  unmergeOrders,
  snapshotSavedQuantities,
  markOrderSaved,
} = ordersSlice.actions;

export default ordersSlice.reducer;
