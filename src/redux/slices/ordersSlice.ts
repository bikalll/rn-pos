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
  payload: { id: nanoid(), tableId, mergedTableIds } 
}),
reducer: (state, action: PayloadAction<{ id: string; tableId: string; mergedTableIds?: string[] }>) => {
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
const existing = order.items.find(i => i.menuItemId === action.payload.item.menuItemId);
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
order.items = order.items.filter(i => i.menuItemId !== action.payload.menuItemId);
},
updateItemQuantity: (state, action: PayloadAction<{ orderId: string; menuItemId: string; quantity: number }>) => {
const order = state.ordersById[action.payload.orderId];
if (!order) return;
const existing = order.items.find(i => i.menuItemId === action.payload.menuItemId);
if (existing) existing.quantity = action.payload.quantity;
},
applyDiscount: (state, action: PayloadAction<{ orderId: string; discountPercentage: number }>) => {
const order = state.ordersById[action.payload.orderId];
if (!order) return;
order.discountPercentage = action.payload.discountPercentage;
},
setPayment: (state, action: PayloadAction<{ orderId: string; payment: PaymentInfo }>) => {
const order = state.ordersById[action.payload.orderId];
if (!order) return;
order.payment = action.payload.payment;
},
completeOrder: (state, action: PayloadAction<{ orderId: string }>) => {
const order = state.ordersById[action.payload.orderId];
if (!order) return;
order.status = "completed";
state.ongoingOrderIds = state.ongoingOrderIds.filter(id => id !== order.id);
state.completedOrderIds.unshift(order.id);
},
cancelOrder: (state, action: PayloadAction<{ orderId: string }>) => {
delete state.ordersById[action.payload.orderId];
state.ongoingOrderIds = state.ongoingOrderIds.filter(id => id !== action.payload.orderId);
state.completedOrderIds = state.completedOrderIds.filter(id => id !== action.payload.orderId);
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
} = ordersSlice.actions;

export default ordersSlice.reducer;
