﻿export type OrderItem = {
  menuItemId: string;
  name: string;
  description?: string;
  price: number;
  quantity: number;
  modifiers?: string[];
  orderType: 'KOT' | 'BOT'; // Add orderType to preserve KOT/BOT information
};

export type PaymentInfo = {
  method: "Cash" | "Card" | "UPI" | "Bank Card" | "Bank" | "Fonepay" | "Credit" | "Split";
  amount: number;
  amountPaid: number;
  change: number;
  customerName: string;
  customerPhone: string;
  timestamp: number;
  // Optional breakdown for split payments
  splitPayments?: Array<{
    method: "Cash" | "Card" | "UPI" | "Bank Card" | "Bank" | "Fonepay" | "Credit";
    amount: number;
  }>;
};

export type OrderStatus = "ongoing" | "completed";

export type Order = {
id: string;
tableId: string;
mergedTableIds?: string[]; // Array of table IDs if this is a merged table order
isMergedOrder?: boolean; // Flag to indicate if this is a merged table order
status: OrderStatus;
items: OrderItem[];
discountPercentage: number;
serviceChargePercentage: number;
taxPercentage: number;
 customerName?: string;
 customerPhone?: string;
payment?: PaymentInfo;
createdAt: number;
 // Tracks last saved/printed quantities per item so KOT/BOT only prints deltas
 savedQuantities?: Record<string, number>;
  // Whether the order has been saved at least once (UI hint)
  isSaved?: boolean;
};

export type InventoryItem = {
id: string;
name: string;
category?: string;
price: number;
stockQuantity: number;
isActive?: boolean;
};

export type Customer = {
id: string;
name: string;
phone?: string;
email?: string;
address?: string;
creditAmount?: number;
loyaltyPoints?: number;
visitCount?: number;
lastVisit?: number;
createdAt?: number;
};

export type StaffRole = "Owner" | "Staff" | "Waiter";

export type StaffMember = {
id: string;
name: string;
role: StaffRole;
};

export type AttendanceRecord = {
id: string;
staffId: string;
timestamp: number;
latitude?: number;
longitude?: number;
photoUri?: string;
type: "in" | "out";
};

export type Receipt = {
id: string;
orderId: string;
content: string;
createdAt: number;
};
