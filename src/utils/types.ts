export type OrderItem = {
  menuItemId: string;
  name: string;
  description?: string;
  price: number;
  quantity: number;
  modifiers?: string[];
  orderType: 'KOT' | 'BOT'; // Add orderType to preserve KOT/BOT information
};

export type PaymentInfo = {
  method: "Cash" | "Card" | "UPI" | "Bank Card" | "Bank" | "Fonepay" | "Credit";
  amount: number;
  amountPaid: number;
  change: number;
  customerName: string;
  customerPhone: string;
  timestamp: number;
};

export type OrderStatus = "ongoing" | "completed";

export type Order = {
id: string;
tableId: string;
status: OrderStatus;
items: OrderItem[];
discountPercentage: number;
serviceChargePercentage: number;
taxPercentage: number;
payment?: PaymentInfo;
createdAt: number;
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
loyaltyPoints?: number;
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
