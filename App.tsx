import "react-native-gesture-handler";
import React, { useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { Provider } from "react-redux";
import RootNavigator from "./src/navigation/RootNavigator";
import { store, persistor } from "./src/redux/store";
import { navigationTheme } from "./src/theme";
import { StatusBar } from "expo-status-bar";
import { PersistGate } from "redux-persist/integration/react";
import { initDatabase } from "./src/services/db";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AppInitializer from "./src/components/AppInitializer";

export default function App() {
	useEffect(() => {
		initDatabase();
	}, []);

	return (
		<Provider store={store}>
			<PersistGate loading={null} persistor={persistor}>
				<SafeAreaProvider>
					<NavigationContainer theme={navigationTheme}>
						<StatusBar style="light" />
						<AppInitializer />
						<RootNavigator />
					</NavigationContainer>
				</SafeAreaProvider>
			</PersistGate>
		</Provider>
	);
}
