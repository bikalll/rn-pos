import { Order } from "./types";

export function calculateOrderTotals(order: Order) {
const subtotal = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
const discount = (subtotal * (order.discountPercentage || 0)) / 100;
const afterDiscount = subtotal - discount;
const serviceCharge = (afterDiscount * (order.serviceChargePercentage || 0)) / 100;
const taxable = afterDiscount + serviceCharge;
const tax = (taxable * (order.taxPercentage || 0)) / 100;
const total = Math.round((taxable + tax) * 100) / 100;
return { subtotal, discount, serviceCharge, tax, total };
}
