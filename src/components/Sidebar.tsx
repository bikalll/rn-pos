import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { RootState } from '../redux/store';

interface SidebarProps {
  activeTab: string;
  onTabPress: (tabName: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabPress }) => {
  const navigation = useNavigation();
  const user = useSelector((state: RootState) => state.auth.user);

  const menuItems = [
    { name: 'Tables', icon: '⊞', route: 'TablesDashboard' },
    { name: 'Menu', icon: '🛒', route: 'Menu' },
    { name: 'Ongoing Orders', icon: '☰', route: 'OngoingOrders' },
    { name: 'Receipts', icon: '💵', route: 'DailySummary' },
    { name: 'Attendance', icon: '📋', route: 'Attendance' },
    { name: 'Customers', icon: '👥', route: 'Customers' },
    { name: 'Printer Setup', icon: '🖨️', route: 'PrinterSetup' },
    { name: 'Settings', icon: '⚙️', route: 'Settings' },
  ];

  const handleTabPress = (tabName: string) => {
    onTabPress(tabName);
    // Navigate to the appropriate screen
    try {
      navigation.navigate(tabName as any);
    } catch (error) {
      console.log('Navigation error:', error);
    }
  };

  const handleLogout = () => {
    // Handle logout logic
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' as any }],
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <Text style={styles.logo}>A</Text>
        </View>
        <Text style={styles.title}>Arbi POS</Text>
      </View>

      <ScrollView style={styles.menuContainer}>
        {menuItems.map((item) => (
          <TouchableOpacity
            key={item.name}
            style={[
              styles.menuItem,
              activeTab === item.name && styles.activeMenuItem
            ]}
            onPress={() => handleTabPress(item.route)}
          >
            <Text style={styles.menuIcon}>{item.icon}</Text>
            <Text style={[
              styles.menuText,
              activeTab === item.name && styles.activeMenuText
            ]}>
              {item.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.userProfile}>
          <View style={styles.userAvatar}>
            <Text style={styles.userInitial}>O</Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>Owner</Text>
            <Text style={styles.userRole}>Owner</Text>
          </View>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutIcon}>⊟</Text>
          </TouchableOpacity>
        </View>
        
        <Text style={styles.poweredBy}>Powered by Arbi POS</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    width: 280,
  },
  header: {
    alignItems: 'center',
    padding: 20,
    paddingTop: 40,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  logoContainer: {
    width: 50,
    height: 50,
    backgroundColor: '#ff6b35',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  logo: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  menuContainer: {
    flex: 1,
    paddingTop: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginHorizontal: 10,
    marginBottom: 4,
    borderRadius: 8,
  },
  activeMenuItem: {
    backgroundColor: '#333333',
  },
  menuIcon: {
    fontSize: 20,
    color: 'white',
    marginRight: 16,
    width: 24,
    textAlign: 'center',
  },
  menuText: {
    fontSize: 16,
    color: 'white',
    fontWeight: '500',
  },
  activeMenuText: {
    fontWeight: '600',
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#333333',
  },
  userProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  userAvatar: {
    width: 40,
    height: 40,
    backgroundColor: '#444444',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userInitial: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  userRole: {
    fontSize: 14,
    color: '#cccccc',
  },
  logoutButton: {
    width: 32,
    height: 32,
    backgroundColor: '#444444',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutIcon: {
    fontSize: 16,
    color: 'white',
  },
  poweredBy: {
    textAlign: 'center',
    color: '#666666',
    fontSize: 12,
  },
});

export default Sidebar;



