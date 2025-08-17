import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, shadow } from '../../theme';
import * as Location from 'expo-location';

interface Employee {
  id: string;
  name: string;
  email: string;
  phone: string;
  designation: string;
  role: 'Manager' | 'Waiter' | 'Accountant' | 'Other';
  joinDate: number;
  isActive: boolean;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
}

interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  timestamp: number;
  type: 'check-in' | 'check-out';
  location: {
    latitude: number;
    longitude: number;
    address?: string;
    detailedAddress?: string;
    accuracy?: number;
  };
  isWithinGeofence: boolean;
  distanceFromOffice?: number;
}

interface FormErrors {
  name?: string;
  email?: string;
  phone?: string;
  designation?: string;
}

const EmployeeManagementScreen: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [showLocationSettings, setShowLocationSettings] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('All');
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [officeLocation, setOfficeLocation] = useState({
    latitude: 37.7749, // Default to San Francisco
    longitude: -122.4194,
    address: 'Restaurant Office',
    geofenceRadius: 100, // 100 meters radius
  });
  
  const [newEmployee, setNewEmployee] = useState({
    name: '',
    email: '',
    phone: '',
    designation: '',
    role: 'Waiter' as Employee['role'],
  });

  useEffect(() => {
    loadEmployeeData();
    loadAttendanceData();
    requestLocationPermission();
  }, []);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location Permission Required',
          'Location access is needed for accurate attendance tracking.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.log('Error requesting location permission:', error);
    }
  };

  const getCurrentLocation = async (): Promise<Location.LocationObject | null> => {
    setIsGettingLocation(true);
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        timeInterval: 5000,
        distanceInterval: 10,
      });
      setCurrentLocation(location);
      return location;
    } catch (error) {
      Alert.alert('Location Error', 'Unable to get current location. Please check your GPS settings.');
      return null;
    } finally {
      setIsGettingLocation(false);
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  const isWithinGeofence = (latitude: number, longitude: number): boolean => {
    const distance = calculateDistance(
      latitude, longitude,
      officeLocation.latitude, officeLocation.longitude
    );
    return distance <= officeLocation.geofenceRadius;
  };

  const getAddressFromCoordinates = async (latitude: number, longitude: number): Promise<{ address: string; detailedAddress: string }> => {
    try {
      const reverseGeocode = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });
      
      if (reverseGeocode.length > 0) {
        const addressData = reverseGeocode[0];
        
        // Create detailed address with more specific information
        const addressParts = [
          addressData.name,           // Building name
          addressData.street,         // Street name
          addressData.streetNumber,   // Street number
          addressData.district,       // District/Area
          addressData.subregion,      // Sub-region
          addressData.city,           // City
          addressData.region,         // Region/State
          addressData.country         // Country
        ].filter(Boolean);
        
        const detailedAddress = addressParts.join(', ');
        
        // Create shorter address for display
        const shortAddressParts = [
          addressData.street,
          addressData.district || addressData.subregion,
          addressData.city,
          addressData.country
        ].filter(Boolean);
        
        const address = shortAddressParts.join(', ');
        
        return { address, detailedAddress };
      }
      return { address: 'Unknown location', detailedAddress: 'Unknown location' };
    } catch (error) {
      return { address: 'Unknown location', detailedAddress: 'Unknown location' };
    }
  };

  const handleAttendance = async (type: 'check-in' | 'check-out') => {
    const location = await getCurrentLocation();
    if (!location) return;

    const addressData = await getAddressFromCoordinates(location.coords.latitude, location.coords.longitude);
    const distance = calculateDistance(
      location.coords.latitude, location.coords.longitude,
      officeLocation.latitude, officeLocation.longitude
    );
    const withinGeofence = isWithinGeofence(location.coords.latitude, location.coords.longitude);

    const attendanceRecord: AttendanceRecord = {
      id: Date.now().toString(),
      employeeId: 'current-user', // In real app, this would be the logged-in user's ID
      employeeName: 'Current User', // In real app, this would be the logged-in user's name
      timestamp: Date.now(),
      type,
      location: {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        address: addressData.address,
        detailedAddress: addressData.detailedAddress,
        accuracy: location.coords.accuracy || undefined,
      },
      isWithinGeofence: withinGeofence,
      distanceFromOffice: distance,
    };

    setAttendanceRecords(prev => [attendanceRecord, ...prev]);
    
    const statusMessage = withinGeofence 
      ? `${type === 'check-in' ? 'Checked in' : 'Checked out'} successfully!`
      : `Warning: You are ${Math.round(distance)}m away from the office. Attendance may not be valid.`;
    
    Alert.alert(
      'Attendance Recorded',
      statusMessage,
      [{ text: 'OK' }]
    );
  };

  const loadAttendanceData = () => {
    // Mock attendance data
    const mockAttendance: AttendanceRecord[] = [
      {
        id: '1',
        employeeId: '1',
        employeeName: 'John Doe',
        timestamp: Date.now() - 8 * 60 * 60 * 1000, // 8 hours ago
        type: 'check-in',
        location: {
          latitude: 37.7749,
          longitude: -122.4194,
          address: '123 Main St, San Francisco, CA',
          accuracy: 5,
        },
        isWithinGeofence: true,
        distanceFromOffice: 25,
      },
      {
        id: '2',
        employeeId: '2',
        employeeName: 'Jane Smith',
        timestamp: Date.now() - 7 * 60 * 60 * 1000, // 7 hours ago
        type: 'check-in',
        location: {
          latitude: 37.7749,
          longitude: -122.4194,
          address: '123 Main St, San Francisco, CA',
          accuracy: 3,
        },
        isWithinGeofence: true,
        distanceFromOffice: 15,
      },
    ];
    setAttendanceRecords(mockAttendance);
  };

  const loadEmployeeData = () => {
    const mockEmployees: Employee[] = [
      {
        id: '1',
        name: 'John Doe',
        email: 'john.doe@restaurant.com',
        phone: '+1 (555) 123-4567',
        designation: 'Senior Waiter',
        role: 'Waiter',
        joinDate: Date.now() - 365 * 24 * 60 * 60 * 1000, // 1 year ago
        isActive: true,
        location: {
          latitude: 37.7749,
          longitude: -122.4194,
          address: '123 Main St, San Francisco, CA',
        },
      },
      {
        id: '2',
        name: 'Jane Smith',
        email: 'jane.smith@restaurant.com',
        phone: '+1 (555) 234-5678',
        designation: 'Head Chef',
        role: 'Manager',
        joinDate: Date.now() - 180 * 24 * 60 * 60 * 1000, // 6 months ago
        isActive: true,
        location: {
          latitude: 37.7749,
          longitude: -122.4194,
          address: '123 Main St, San Francisco, CA',
        },
      },
      {
        id: '3',
        name: 'Mike Johnson',
        email: 'mike.johnson@restaurant.com',
        phone: '+1 (555) 345-6789',
        designation: 'Restaurant Manager',
        role: 'Manager',
        joinDate: Date.now() - 730 * 24 * 60 * 60 * 1000, // 2 years ago
        isActive: true,
        location: {
          latitude: 37.7749,
          longitude: -122.4194,
          address: '123 Main St, San Francisco, CA',
        },
      },
      {
        id: '4',
        name: 'Sarah Wilson',
        email: 'sarah.wilson@restaurant.com',
        phone: '+1 (555) 456-7890',
        designation: 'Financial Controller',
        role: 'Accountant',
        joinDate: Date.now() - 90 * 24 * 60 * 60 * 1000, // 3 months ago
        isActive: true,
        location: {
          latitude: 37.7749,
          longitude: -122.4194,
          address: '123 Main St, San Francisco, CA',
        },
      },
    ];
    setEmployees(mockEmployees);
  };

  const roles = ['All', 'Manager', 'Waiter', 'Accountant', 'Other'];
  const filteredEmployees = employees.filter(employee => 
    (selectedRole === 'All' || employee.role === selectedRole) &&
    (searchQuery === '' || employee.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const validateForm = (): boolean => {
    const errors: FormErrors = {};
    
    if (!newEmployee.name.trim()) {
      errors.name = 'Name is required';
    } else if (newEmployee.name.trim().length < 2) {
      errors.name = 'Name must be at least 2 characters';
    }
    
    if (!newEmployee.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmployee.email.trim())) {
      errors.email = 'Please enter a valid email';
    }
    
    if (!newEmployee.phone.trim()) {
      errors.phone = 'Phone number is required';
    } else if (!/^[\+]?[1-9][\d]{0,15}$/.test(newEmployee.phone.replace(/[\s\-\(\)]/g, ''))) {
      errors.phone = 'Please enter a valid phone number';
    }
    
    if (!newEmployee.designation.trim()) {
      errors.designation = 'Designation is required';
    } else if (newEmployee.designation.trim().length < 3) {
      errors.designation = 'Designation must be at least 3 characters';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddEmployee = async () => {
    if (!validateForm()) return;
    
    setIsSubmitting(true);
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const employee: Employee = {
        id: Date.now().toString(),
        name: newEmployee.name.trim(),
        email: newEmployee.email.trim().toLowerCase(),
        phone: newEmployee.phone.trim(),
        designation: newEmployee.designation.trim(),
        role: newEmployee.role,
        joinDate: Date.now(),
        isActive: true,
      };

      setEmployees(prev => [employee, ...prev]);
      setShowAddModal(false);
      resetNewEmployee();
      setFormErrors({});
      
      Alert.alert('Success', 'Employee added successfully!');
    } catch (error) {
      Alert.alert('Error', 'Failed to add employee. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditEmployee = (employee: Employee) => {
    setEditingEmployee(employee);
    setNewEmployee({
      name: employee.name,
      email: employee.email,
      phone: employee.phone,
      designation: employee.designation,
      role: employee.role,
    });
    setFormErrors({});
    setShowAddModal(true);
  };

  const handleUpdateEmployee = async () => {
    if (!editingEmployee || !validateForm()) return;
    
    setIsSubmitting(true);
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const updatedEmployees = employees.map(employee => 
        employee.id === editingEmployee.id ? {
          ...employee,
          name: newEmployee.name.trim(),
          email: newEmployee.email.trim().toLowerCase(),
          phone: newEmployee.phone.trim(),
          designation: newEmployee.designation.trim(),
          role: newEmployee.role,
        } : employee
      );

      setEmployees(updatedEmployees);
      setShowAddModal(false);
      setEditingEmployee(null);
      resetNewEmployee();
      setFormErrors({});
      
      Alert.alert('Success', 'Employee updated successfully!');
    } catch (error) {
      Alert.alert('Error', 'Failed to update employee. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEmployee = (employeeId: string) => {
    Alert.alert(
      'Delete Employee',
      'Are you sure you want to delete this employee? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => {
            setEmployees(prev => prev.filter(emp => emp.id !== employeeId));
            Alert.alert('Success', 'Employee deleted successfully!');
          }
        },
      ]
    );
  };

  const resetNewEmployee = () => {
    setNewEmployee({
      name: '',
      email: '',
      phone: '',
      designation: '',
      role: 'Waiter',
    });
    setFormErrors({});
  };

  const closeModal = () => {
    setShowAddModal(false);
    setEditingEmployee(null);
    resetNewEmployee();
  };

  const renderEmployee = ({ item }: { item: Employee }) => (
    <View style={styles.employeeCard}>
      <View style={styles.employeeInfo}>
        <View style={styles.employeeHeader}>
          <Text style={styles.employeeName}>{item.name}</Text>
          <View style={[styles.roleBadge, { backgroundColor: getRoleColor(item.role) }]}>
            <Text style={styles.roleText}>{item.role}</Text>
          </View>
        </View>
        <Text style={styles.employeeDesignation}>{item.designation}</Text>
        <Text style={styles.employeeContact}>{item.email}</Text>
        <Text style={styles.employeeContact}>{item.phone}</Text>
        <Text style={styles.employeeDate}>
          Joined: {new Date(item.joinDate).toLocaleDateString()}
        </Text>
        {item.location && (
          <Text style={styles.employeeLocation}>
            📍 {item.location.address}
          </Text>
        )}
      </View>
      
      <View style={styles.employeeActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleEditEmployee(item)}
        >
          <Ionicons name="pencil" size={20} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleDeleteEmployee(item.id)}
        >
          <Ionicons name="trash" size={20} color={colors.danger} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderAttendanceRecord = ({ item }: { item: AttendanceRecord }) => (
    <View style={styles.attendanceCard}>
      <View style={styles.attendanceHeader}>
        <Text style={styles.attendanceEmployeeName}>{item.employeeName}</Text>
        <View style={[
          styles.attendanceTypeBadge,
          { backgroundColor: item.type === 'check-in' ? colors.success : colors.warning }
        ]}>
          <Text style={styles.attendanceTypeText}>
            {item.type === 'check-in' ? 'Check In' : 'Check Out'}
          </Text>
        </View>
      </View>
      
      <Text style={styles.attendanceTime}>
        {new Date(item.timestamp).toLocaleString()}
      </Text>
      
      <Text style={styles.attendanceLocation}>
        📍 {item.location.detailedAddress || item.location.address}
      </Text>
      
      <View style={styles.attendanceDetails}>
        <Text style={styles.attendanceDetail}>
          Accuracy: {item.location.accuracy?.toFixed(1)}m
        </Text>
        <Text style={styles.attendanceDetail}>
          Distance: {item.distanceFromOffice?.toFixed(0)}m from office
        </Text>
        <View style={[
          styles.geofenceStatus,
          { backgroundColor: item.isWithinGeofence ? colors.success + '20' : colors.danger + '20' }
        ]}>
          <Text style={[
            styles.geofenceStatusText,
            { color: item.isWithinGeofence ? colors.success : colors.danger }
          ]}>
            {item.isWithinGeofence ? '✅ Within Geofence' : '❌ Outside Geofence'}
          </Text>
        </View>
      </View>
    </View>
  );

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'Manager': return colors.primary;
      case 'Waiter': return colors.success;
      case 'Accountant': return colors.warning;
      case 'Other': return colors.textSecondary;
      default: return colors.outline;
    }
  };

  const renderFormField = (
    label: string,
    field: 'name' | 'email' | 'phone' | 'designation',
    placeholder: string,
    keyboardType: 'default' | 'email-address' | 'phone-pad' = 'default',
    autoCapitalize: 'none' | 'sentences' | 'words' | 'characters' = 'sentences'
  ) => (
    <View style={styles.formField}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[
          styles.formInput,
          formErrors[field] && styles.formInputError
        ]}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        value={newEmployee[field]}
        onChangeText={(text) => {
          setNewEmployee(prev => ({ ...prev, [field]: text }));
          if (formErrors[field]) {
            setFormErrors(prev => ({ ...prev, [field]: undefined }));
          }
        }}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        returnKeyType="next"
        blurOnSubmit={false}
      />
      {formErrors[field] && (
        <Text style={styles.errorText}>{formErrors[field]}</Text>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Employee Management</Text>
        <Text style={styles.subtitle}>Manage restaurant staff and roles</Text>
      </View>

      {/* Search and Filters */}
      <View style={styles.searchSection}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search employees..."
          placeholderTextColor={colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.rolesContainer}>
          {roles.map((role) => (
            <TouchableOpacity
              key={role}
              style={[
                styles.roleButton,
                selectedRole === role && styles.roleButtonActive
              ]}
              onPress={() => setSelectedRole(role)}
            >
              <Text style={[
                styles.roleButtonText,
                selectedRole === role && styles.roleButtonTextActive
              ]}>
                {role}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Employee Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{employees.length}</Text>
          <Text style={styles.statLabel}>Total Employees</Text>
        </View>
        
        <View style={styles.statCard}>
          <Text style={styles.statValue}>
            {employees.filter(e => e.isActive).length}
          </Text>
          <Text style={styles.statLabel}>Active</Text>
        </View>
        
        <View style={styles.statCard}>
          <Text style={styles.statValue}>
            {employees.filter(e => e.role === 'Manager').length}
          </Text>
          <Text style={styles.statLabel}>Managers</Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtonsContainer}>
        <TouchableOpacity
          style={styles.actionButtonLarge}
          onPress={() => setShowAddModal(true)}
        >
          <Ionicons name="add" size={24} color={colors.textPrimary} />
          <Text style={styles.actionButtonText}>Add Employee</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.actionButtonLarge, styles.attendanceButton]}
          onPress={() => setShowAttendanceModal(true)}
        >
          <Ionicons name="time" size={24} color={colors.textPrimary} />
          <Text style={styles.actionButtonText}>Attendance</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.actionButtonLarge, styles.locationButton]}
          onPress={() => setShowLocationSettings(true)}
        >
          <Ionicons name="location" size={24} color={colors.textPrimary} />
          <Text style={styles.actionButtonText}>Location</Text>
        </TouchableOpacity>
      </View>

      {/* Employee List */}
      <FlatList
        data={filteredEmployees}
        renderItem={renderEmployee}
        keyExtractor={(item) => item.id}
        style={styles.employeeList}
        contentContainerStyle={styles.employeeListContent}
        showsVerticalScrollIndicator={false}
      />

      {/* Optimized Add/Edit Employee Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView 
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {editingEmployee ? 'Edit Employee' : 'Add New Employee'}
                </Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={closeModal}
                  disabled={isSubmitting}
                >
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView 
                style={styles.modalForm}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {renderFormField('Full Name', 'name', 'Enter full name')}
                {renderFormField('Email Address', 'email', 'Enter email address', 'email-address', 'none')}
                {renderFormField('Phone Number', 'phone', 'Enter phone number', 'phone-pad')}
                {renderFormField('Designation', 'designation', 'Enter job title')}

                {/* Role Selection */}
                <View style={styles.formField}>
                  <Text style={styles.fieldLabel}>Role</Text>
                  <View style={styles.roleSelection}>
                    {(['Manager', 'Waiter', 'Accountant', 'Other'] as const).map((role) => (
                      <TouchableOpacity
                        key={role}
                        style={[
                          styles.roleOption,
                          newEmployee.role === role && styles.roleOptionActive
                        ]}
                        onPress={() => setNewEmployee(prev => ({ ...prev, role }))}
                        disabled={isSubmitting}
                      >
                        <View style={styles.radioContainer}>
                          <View style={[
                            styles.radioButton,
                            newEmployee.role === role && styles.radioButtonActive
                          ]}>
                            {newEmployee.role === role && <View style={styles.radioButtonInner} />}
                          </View>
                          <Text style={[
                            styles.roleOptionText,
                            newEmployee.role === role && styles.roleOptionTextActive
                          ]}>
                            {role}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </ScrollView>
              
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  onPress={closeModal}
                  disabled={isSubmitting}
                >
                  <Text style={styles.modalButtonCancelText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.modalButton, 
                    styles.modalButtonConfirm,
                    isSubmitting && styles.modalButtonDisabled
                  ]}
                  onPress={editingEmployee ? handleUpdateEmployee : handleAddEmployee}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <View style={styles.loadingContainer}>
                      <Ionicons name="hourglass" size={16} color={colors.textPrimary} style={{ marginRight: spacing.xs }} />
                      <Text style={styles.modalButtonConfirmText}>Processing...</Text>
                    </View>
                  ) : (
                    <Text style={styles.modalButtonConfirmText}>
                      {editingEmployee ? 'Update' : 'Add'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Attendance Modal */}
      <Modal
        visible={showAttendanceModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAttendanceModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Attendance Tracking</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowAttendanceModal(false)}
              >
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.attendanceActions}>
              <TouchableOpacity
                style={[styles.attendanceActionButton, styles.checkInButton]}
                onPress={() => handleAttendance('check-in')}
                disabled={isGettingLocation}
              >
                <Ionicons name="log-in" size={24} color={colors.textPrimary} />
                <Text style={styles.attendanceActionText}>Check In</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.attendanceActionButton, styles.checkOutButton]}
                onPress={() => handleAttendance('check-out')}
                disabled={isGettingLocation}
              >
                <Ionicons name="log-out" size={24} color={colors.textPrimary} />
                <Text style={styles.attendanceActionText}>Check Out</Text>
              </TouchableOpacity>
            </View>

            {isGettingLocation && (
              <View style={styles.locationLoading}>
                <Ionicons name="location" size={24} color={colors.primary} />
                <Text style={styles.locationLoadingText}>Getting your location...</Text>
              </View>
            )}

            <View style={styles.attendanceHistory}>
              <Text style={styles.attendanceHistoryTitle}>Recent Attendance</Text>
              <FlatList
                data={attendanceRecords.slice(0, 10)}
                renderItem={renderAttendanceRecord}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                style={styles.attendanceList}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Location Settings Modal */}
      <Modal
        visible={showLocationSettings}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowLocationSettings(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Location Settings</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowLocationSettings(false)}
              >
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalForm}>
              <View style={styles.locationInfo}>
                <Text style={styles.locationInfoTitle}>Office Location</Text>
                <Text style={styles.locationInfoText}>
                  📍 {officeLocation.address}
                </Text>
                <Text style={styles.locationInfoText}>
                  Coordinates: {officeLocation.latitude.toFixed(6)}, {officeLocation.longitude.toFixed(6)}
                </Text>
                <Text style={styles.locationInfoText}>
                  Geofence Radius: {officeLocation.geofenceRadius}m
                </Text>
              </View>

              <View style={styles.locationActions}>
                <TouchableOpacity
                  style={styles.locationActionButton}
                  onPress={async () => {
                    const location = await getCurrentLocation();
                    if (location) {
                      setOfficeLocation(prev => ({
                        ...prev,
                        latitude: location.coords.latitude,
                        longitude: location.coords.longitude,
                      }));
                      Alert.alert('Success', 'Office location updated to your current location!');
                    }
                  }}
                >
                  <Ionicons name="location" size={20} color={colors.primary} />
                  <Text style={styles.locationActionText}>Set Current Location as Office</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.background,
    padding: spacing.md,
    paddingTop: 0,
    borderBottomWidth: 1,
    borderBottomColor: colors.outline,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  searchSection: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.outline,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 16,
    backgroundColor: colors.surface2,
    marginBottom: spacing.md,
    color: colors.textPrimary,
  },
  rolesContainer: {
    flexDirection: 'row',
  },
  roleButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.outline,
    marginRight: spacing.sm,
    backgroundColor: colors.surface2,
  },
  roleButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  roleButtonText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  roleButtonTextActive: {
    color: colors.textPrimary,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'center',
    ...shadow.card,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  addButtonContainer: {
    padding: spacing.md,
    paddingBottom: spacing.sm,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  addButtonText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: spacing.xs,
  },
  employeeList: {
    flex: 1,
  },
  employeeListContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  employeeCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.outline,
    ...shadow.card,
  },
  employeeInfo: {
    flex: 1,
  },
  employeeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  employeeName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
  },
  roleBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  roleText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  employeeDesignation: {
    fontSize: 16,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  employeeContact: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  employeeDate: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  employeeLocation: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  employeeActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  actionButton: {
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.outline,
  },
  attendanceButton: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  locationButton: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  actionButtonText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: spacing.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    width: '90%',
    maxHeight: '80%',
    ...shadow.card,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.outline,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  modalForm: {
    padding: spacing.md,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 16,
    backgroundColor: colors.surface2,
    marginBottom: spacing.md,
    color: colors.textPrimary,
  },
  roleLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  roleSelection: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  roleOption: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.surface2,
    minHeight: 48,
    justifyContent: 'center',
  },
  roleOptionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '20',
    borderWidth: 2,
  },
  radioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.outline,
    marginRight: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioButtonActive: {
    borderColor: colors.primary,
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  roleOptionText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  roleOptionTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.outline,
    gap: spacing.sm,
  },
  modalButton: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.outline,
  },
  modalButtonConfirm: {
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  modalButtonCancelText: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonConfirmText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonDisabled: {
    opacity: 0.6,
  },
  closeButton: {
    padding: spacing.sm,
  },
  formField: {
    marginBottom: spacing.md,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  formInput: {
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 16,
    backgroundColor: colors.surface2,
    color: colors.textPrimary,
    minHeight: 48,
  },
  formInputError: {
    borderColor: colors.danger,
    borderWidth: 2,
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    marginTop: spacing.xs,
    fontStyle: 'italic',
  },
  attendanceActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.outline,
  },
  attendanceActionButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.outline,
  },
  checkInButton: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  checkOutButton: {
    backgroundColor: colors.warning,
    borderColor: colors.warning,
  },
  attendanceActionText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  attendanceHistory: {
    padding: spacing.md,
  },
  attendanceHistoryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  attendanceList: {
    // No specific styles needed, FlatList handles its own contentContainerStyle
  },
  attendanceCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.outline,
    ...shadow.card,
  },
  attendanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  attendanceEmployeeName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  attendanceTypeBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  attendanceTypeText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  attendanceTime: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  attendanceLocation: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  attendanceDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  attendanceDetail: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  geofenceStatus: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  geofenceStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  locationLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.outline,
  },
  locationLoadingText: {
    color: colors.textSecondary,
    fontSize: 14,
    marginLeft: spacing.xs,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.outline,
  },
  actionButtonLarge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outline,
  },
  locationInfo: {
    marginBottom: spacing.md,
  },
  locationInfoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  locationInfoText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  locationActions: {
    marginTop: spacing.md,
  },
  locationActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.outline,
  },
  locationActionText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: spacing.xs,
  },
});

export default EmployeeManagementScreen;
