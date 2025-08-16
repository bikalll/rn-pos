import { Alert, PermissionsAndroid, Platform } from 'react-native';

let BluetoothManager: any = null;
let BluetoothEscposPrinter: any = null;
let moduleLoadError: string | null = null;

try {
	// @ts-ignore
	const mod = require('tp-react-native-bluetooth-printer');
	BluetoothManager = mod.BluetoothManager;
	BluetoothEscposPrinter = mod.BluetoothEscposPrinter;
	
	if (!BluetoothManager || !BluetoothEscposPrinter) {
		moduleLoadError = 'Bluetooth module loaded but required components are missing';
	}
} catch (e) {
	moduleLoadError = `Failed to load Bluetooth module: ${e}`;
	console.error('Bluetooth module load error:', e);
}

export const blePrinter = {
	isSupported(): boolean {
		const supported = Boolean(BluetoothManager && BluetoothEscposPrinter);
		if (!supported && moduleLoadError) {
			console.warn('Bluetooth module not supported:', moduleLoadError);
		}
		return supported;
	},
	
	getModuleStatus(): { supported: boolean; error?: string } {
		return {
			supported: this.isSupported(),
			error: moduleLoadError || undefined
		};
	},
	async requestPermissions(): Promise<boolean> {
		if (Platform.OS !== 'android') return true;
		try {
			const result = await PermissionsAndroid.requestMultiple([
				PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN as any,
				PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT as any,
				PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
				PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
			]);
			return Object.values(result).every(v => v === PermissionsAndroid.RESULTS.GRANTED);
		} catch {
			return false;
		}
	},
	async isEnabled(): Promise<boolean> {
		if (!this.isSupported()) return false;
		try {
			const enabled = await BluetoothManager.isBluetoothEnabled();
			return !!enabled;
		} catch {
			return false;
		}
	},
	async enableBluetooth(): Promise<boolean> {
		if (!this.isSupported()) return false;
		try {
			await BluetoothManager.enableBluetooth();
			return true;
		} catch (e) {
			Alert.alert('Bluetooth', 'Unable to enable bluetooth');
			return false;
		}
	},
	async scanDevices(): Promise<{ paired: Array<any>; found: Array<any> }> {
		if (!this.isSupported()) return { paired: [], found: [] };
		try {
			const hasPerm = await this.requestPermissions();
			if (!hasPerm) {
				Alert.alert('Permissions required', 'Bluetooth and Location permissions are required to scan for printers.');
				return { paired: [], found: [] };
			}
			const res = await BluetoothManager.scanDevices();
			const parsed = typeof res === 'string' ? JSON.parse(res) : res;
			return {
				paired: parsed?.paired || [],
				found: parsed?.found || [],
			};
		} catch (e) {
			return { paired: [], found: [] };
		}
	},
	async connect(address: string): Promise<void> {
		if (!this.isSupported()) throw new Error('Bluetooth printing module not available');
		await BluetoothManager.connect(address);
	},
	async disconnect(): Promise<void> {
		if (!this.isSupported()) return;
		try { await BluetoothManager.disconnect(); } catch {}
	},
	async printText(text: string): Promise<void> {
		if (!this.isSupported()) throw new Error('Bluetooth printing module not available');
		await BluetoothEscposPrinter.printerInit();
		await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.LEFT);
		await BluetoothEscposPrinter.printText(text + '\n', { encoding: 'GBK' });
		await BluetoothEscposPrinter.printAndFeed(2);
	},
	async printReceipt(data: {
		restaurantName: string;
		receiptId: string;
		date: string;
		time: string;
		table: string;
		items: Array<{ name: string; quantity: number; price: number }>;
		taxLabel: string;
		serviceLabel: string;
		subtotal: number;
		tax: number;
		service: number;
		discount?: number;
		total: number;
		payment?: { method: string; amountPaid: number; change: number } | null;
	}): Promise<void> {
		if (!this.isSupported()) throw new Error('Bluetooth printing module not available');
		await BluetoothEscposPrinter.printerInit();
		await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.CENTER);
		await BluetoothEscposPrinter.setBlob(0);
		await BluetoothEscposPrinter.printText(`${data.restaurantName}\n`, {
			encoding: 'GBK',
			fonttype: 1,
			widthtimes: 1,
			heighttimes: 1,
		});
		await BluetoothEscposPrinter.printText(`Receipt #${data.receiptId}\n`, {});
		await BluetoothEscposPrinter.printText(`${data.date}  ${data.time}\n`, {});
		await BluetoothEscposPrinter.printText(`Table ${data.table}\n`, {});
		await BluetoothEscposPrinter.printText('==============================\n', {});
		await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.LEFT);
		await BluetoothEscposPrinter.printText('ITEMS:\n', {});
		for (const item of data.items) {
			const lineName = `${item.name}\n`;
			const lineDetail = `  ${item.quantity} x Rs. ${item.price.toFixed(2)}  =  Rs. ${(item.price * item.quantity).toFixed(2)}\n`;
			await BluetoothEscposPrinter.printText(lineName, {});
			await BluetoothEscposPrinter.printText(lineDetail, {});
		}
		await BluetoothEscposPrinter.printText('------------------------------\n', {});
		await BluetoothEscposPrinter.printText(`Subtotal: Rs. ${data.subtotal.toFixed(2)}\n`, {});
		await BluetoothEscposPrinter.printText(`${data.taxLabel}: Rs. ${data.tax.toFixed(2)}\n`, {});
		await BluetoothEscposPrinter.printText(`${data.serviceLabel}: Rs. ${data.service.toFixed(2)}\n`, {});
		if (data.discount && data.discount > 0) {
			await BluetoothEscposPrinter.printText(`Discount: -Rs. ${data.discount.toFixed(2)}\n`, {});
		}
		await BluetoothEscposPrinter.printText('==============================\n', {});
		await BluetoothEscposPrinter.printText(`TOTAL: Rs. ${data.total.toFixed(2)}\n`, { widthtimes: 1, heighthtimes: 1 });
		if (data.payment) {
			await BluetoothEscposPrinter.printText('\nPAYMENT:\n', {});
			await BluetoothEscposPrinter.printText(`Method: ${data.payment.method}\n`, {});
			await BluetoothEscposPrinter.printText(`Paid: Rs. ${data.payment.amountPaid.toFixed(2)}\n`, {});
			await BluetoothEscposPrinter.printText(`Change: Rs. ${data.payment.change.toFixed(2)}\n`, {});
		}
		await BluetoothEscposPrinter.printText('\nThank you!\n', {});
		await BluetoothEscposPrinter.printAndFeed(3);
	},

	async printKOT(data: {
		restaurantName: string;
		ticketId: string;
		date: string;
		time: string;
		table: string;
		items: Array<{ name: string; quantity: number; price: number; orderType: string }>;
		estimatedTime: string;
		specialInstructions?: string;
	}): Promise<void> {
		if (!this.isSupported()) throw new Error('Bluetooth printing module not available');
		await BluetoothEscposPrinter.printerInit();
		await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.CENTER);
		await BluetoothEscposPrinter.setBlob(0);
		await BluetoothEscposPrinter.printText('KITCHEN ORDER TICKET\n', {
			encoding: 'GBK',
			fonttype: 1,
			widthtimes: 1,
			heighttimes: 1,
		});
		await BluetoothEscposPrinter.printText(`${data.restaurantName}\n`, {});
		await BluetoothEscposPrinter.printText('==============================\n', {});
		await BluetoothEscposPrinter.printText(`Ticket #${data.ticketId}\n`, {});
		await BluetoothEscposPrinter.printText(`${data.date}  ${data.time}\n`, {});
		await BluetoothEscposPrinter.printText(`Table ${data.table}\n`, {});
		await BluetoothEscposPrinter.printText(`Est. Time: ${data.estimatedTime}\n`, {});
		if (data.specialInstructions) {
			await BluetoothEscposPrinter.printText(`Special: ${data.specialInstructions}\n`, {});
		}
		await BluetoothEscposPrinter.printText('==============================\n', {});
		await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.LEFT);
		await BluetoothEscposPrinter.printText('KITCHEN ITEMS:\n', {});
		for (const item of data.items) {
			if (item.orderType === 'KOT') {
				const lineName = `${item.name}\n`;
				const lineDetail = `  ${item.quantity} x Rs. ${item.price.toFixed(2)}\n`;
				await BluetoothEscposPrinter.printText(lineName, {});
				await BluetoothEscposPrinter.printText(lineDetail, {});
			}
		}
		await BluetoothEscposPrinter.printText('==============================\n', {});
		await BluetoothEscposPrinter.printText('PLEASE PREPARE WITH CARE\n', {});
		await BluetoothEscposPrinter.printText(`${new Date().toLocaleTimeString()}\n`, {});
		await BluetoothEscposPrinter.printAndFeed(3);
	},

	async printBOT(data: {
		restaurantName: string;
		ticketId: string;
		date: string;
		time: string;
		table: string;
		items: Array<{ name: string; quantity: number; price: number; orderType: string }>;
		estimatedTime: string;
		specialInstructions?: string;
	}): Promise<void> {
		if (!this.isSupported()) throw new Error('Bluetooth printing module not available');
		await BluetoothEscposPrinter.printerInit();
		await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.CENTER);
		await BluetoothEscposPrinter.setBlob(0);
		await BluetoothEscposPrinter.printText('BAR ORDER TICKET\n', {
			encoding: 'GBK',
			fonttype: 1,
			widthtimes: 1,
			heighttimes: 1,
		});
		await BluetoothEscposPrinter.printText(`${data.restaurantName}\n`, {});
		await BluetoothEscposPrinter.printText('==============================\n', {});
		await BluetoothEscposPrinter.printText(`Ticket #${data.ticketId}\n`, {});
		await BluetoothEscposPrinter.printText(`${data.date}  ${data.time}\n`, {});
		await BluetoothEscposPrinter.printText(`Table ${data.table}\n`, {});
		await BluetoothEscposPrinter.printText(`Est. Time: ${data.estimatedTime}\n`, {});
		if (data.specialInstructions) {
			await BluetoothEscposPrinter.printText(`Special: ${data.specialInstructions}\n`, {});
		}
		await BluetoothEscposPrinter.printText('==============================\n', {});
		await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.LEFT);
		await BluetoothEscposPrinter.printText('BAR ITEMS:\n', {});
		for (const item of data.items) {
			if (item.orderType === 'BOT') {
				const lineName = `${item.name}\n`;
				const lineDetail = `  ${item.quantity} x Rs. ${item.price.toFixed(2)}\n`;
				await BluetoothEscposPrinter.printText(lineName, {});
				await BluetoothEscposPrinter.printText(lineDetail, {});
			}
		}
		await BluetoothEscposPrinter.printText('==============================\n', {});
		await BluetoothEscposPrinter.printText('PLEASE PREPARE WITH CARE\n', {});
		await BluetoothEscposPrinter.printText(`${new Date().toLocaleTimeString()}\n`, {});
		await BluetoothEscposPrinter.printAndFeed(3);
	},

	async printCombinedTickets(data: {
		restaurantName: string;
		ticketId: string;
		date: string;
		time: string;
		table: string;
		items: Array<{ name: string; quantity: number; price: number; orderType: string }>;
		estimatedTime: string;
		specialInstructions?: string;
	}): Promise<void> {
		// Print KOT if kitchen items exist
		const hasKitchenItems = data.items.some(item => item.orderType === 'KOT');
		if (hasKitchenItems) {
			await this.printKOT(data);
		}

		// Print BOT if bar items exist
		const hasBarItems = data.items.some(item => item.orderType === 'BOT');
		if (hasBarItems) {
			await this.printBOT(data);
		}
	},
};



