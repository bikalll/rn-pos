export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
};

export type AppTabParamList = {
  DashboardTab: undefined;
  OrdersTab: undefined;
  ReceiptsTab: undefined;
  StaffTab: undefined;
  InventoryTab: undefined;
  ReportsTab: undefined;
  SettingsTab: undefined;
};

export type DashboardStackParamList = {
  TablesDashboard: undefined;
  OrderTaking: { tableId: string; orderId: string };
  TableManagement: undefined;
};

export type OrdersStackParamList = {
  OngoingOrders: undefined;
  OrderManagement: { orderId: string };
  OrderTaking: { tableId: string; orderId: string };
  OrderConfirmation: { orderId: string; tableId: string };
};

export type ReceiptsStackParamList = {
  DailySummary: undefined;
  ReceiptDetail: { orderId: string };
};

export type StaffStackParamList = {
  Attendance: undefined;
  Customers: undefined;
  StaffManagement: undefined;
};

export type InventoryStackParamList = {
  Menu: undefined;
  MenuManagement: undefined;
  InventoryManagement: undefined;
  Vendors: undefined;
};

export type SettingsStackParamList = {
  SettingsMain: undefined;
  PrinterSetup: undefined;
  PrintDemo: undefined;
  OfficeProfile: undefined;
  TableManagement: undefined;
  BluetoothDebug: undefined;
};

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

// Combined type for all screens
export type AllScreensParamList = 
  | AuthStackParamList
  | DashboardStackParamList
  | OrdersStackParamList
  | ReceiptsStackParamList
  | StaffStackParamList
  | InventoryStackParamList
  | SettingsStackParamList;
