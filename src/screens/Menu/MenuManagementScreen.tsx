import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert, Modal, ScrollView, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useDispatch, useSelector } from 'react-redux';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius, shadow } from '../../theme';
import { RootState } from '../../redux/store';
import { addMenuItem, updateMenuItem, removeMenuItem, toggleAvailability, MenuItem } from '../../redux/slices/menuSlice';

const MenuManagementScreen: React.FC = () => {
  const menuItemsById = useSelector((s: RootState) => s.menu.itemsById);
  const items: MenuItem[] = useMemo(() => Object.values(menuItemsById) as MenuItem[], [menuItemsById]);
  const dispatch = useDispatch();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [form, setForm] = useState<Omit<MenuItem, 'id'>>({ 
    name: '', 
    description: '', 
    price: 0, 
    category: '', 
    isAvailable: true, 
    modifiers: [], 
    image: '',
    orderType: 'KOT' // Add orderType with default value
  });

  const categories = useMemo(() => ['All', ...Array.from(new Set(items.map((i: MenuItem) => i.category)))], [items]);
  const filtered: MenuItem[] = items.filter((i: MenuItem) => (categoryFilter === 'All' || i.category === categoryFilter) && (search === '' || i.name.toLowerCase().includes(search.toLowerCase())));

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', description: '', price: 0, category: '', isAvailable: true, modifiers: [], image: '', orderType: 'KOT' });
    setModalOpen(true);
  };

  const openEdit = (item: MenuItem) => {
    setEditing(item);
    setForm({ 
      name: item.name, 
      description: item.description, 
      price: item.price, 
      category: item.category, 
      isAvailable: item.isAvailable, 
      modifiers: item.modifiers, 
      image: item.image || '',
      orderType: item.orderType
    });
    setModalOpen(true);
  };

  const handleAddImage = async () => {
    try {
      console.log('Starting image picker...');
      
      // Request permissions first
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      console.log('Photo library permission status:', status);
      
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Permission to access the photo library is required to add images to dishes.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => {
              // You can add navigation to settings here if needed
              Alert.alert('Settings', 'Please enable photo library permissions in your device settings.');
            }}
          ]
        );
        return;
      }

      console.log('Launching image library...');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        allowsMultipleSelection: false,
      });

      console.log('Image picker result:', result);

      if (!result.canceled && result.assets && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        console.log('Selected image URI:', imageUri);
        
        // Validate the image URI
        if (imageUri && imageUri.length > 0) {
          setForm(prev => ({ ...prev, image: imageUri }));
          Alert.alert('Success', 'Image added successfully!');
        } else {
          console.error('Invalid image URI received');
          Alert.alert('Error', 'Invalid image selected. Please try again.');
        }
      } else {
        console.log('Image selection was canceled or failed');
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to add image. Please try again.');
    }
  };

  const handleTakePhoto = async () => {
    try {
      console.log('Starting camera...');
      
      // Request camera permissions first
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      console.log('Camera permission status:', status);
      
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Permission to access the camera is required to take photos.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => {
              Alert.alert('Settings', 'Please enable camera permissions in your device settings.');
            }}
          ]
        );
        return;
      }

      console.log('Launching camera...');
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      console.log('Camera result:', result);

      if (!result.canceled && result.assets && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        console.log('Taken photo URI:', imageUri);
        
        // Validate the image URI
        if (imageUri && imageUri.length > 0) {
          setForm(prev => ({ ...prev, image: imageUri }));
          Alert.alert('Success', 'Photo taken successfully!');
        } else {
          console.error('Invalid image URI received from camera');
          Alert.alert('Error', 'Invalid photo taken. Please try again.');
        }
      } else {
        console.log('Photo taking was canceled or failed');
      }
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  const showImageOptions = () => {
    Alert.alert(
      'Add Image',
      'Choose how you want to add an image',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Take Photo', onPress: handleTakePhoto },
        { text: 'Choose from Gallery', onPress: handleAddImage },
      ]
    );
  };

  const handleRemoveImage = () => {
    Alert.alert(
      'Remove Image',
      'Are you sure you want to remove the image?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => {
          setForm(prev => ({ ...prev, image: '' }));
        }}
      ]
    );
  };

  const save = () => {
    if (!form.name || !form.category || !Number.isFinite(Number(form.price))) {
      Alert.alert('Invalid', 'Please provide name, category and valid price');
      return;
    }
    
    console.log('Saving form data:', form);
    console.log('Image URI:', form.image);
    
    if (editing) {
      console.log('Updating existing menu item:', editing.id);
      dispatch(updateMenuItem({ ...editing, ...form }));
    } else {
      const id = `${form.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;
      console.log('Creating new menu item with ID:', id);
      dispatch(addMenuItem({ id, ...form }));
    }
    setModalOpen(false);
  };

  const confirmDelete = (id: string) => {
    Alert.alert('Delete item', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => dispatch(removeMenuItem(id)) },
    ]);
  };

  const renderItem = ({ item }: { item: MenuItem }) => (
    <View style={styles.card}>
      <View style={styles.cardContent}>
        {item.image && (
          <Image source={{ uri: item.image }} style={styles.itemImage} />
        )}
        <View style={styles.itemInfo}>
          <Text style={styles.name}>{item.name}</Text>
          {item.description ? <Text style={styles.desc}>{item.description}</Text> : null}
          <Text style={styles.meta}>{item.category} • Rs {item.price.toFixed(2)}</Text>
          <Text style={[styles.badge, { backgroundColor: item.isAvailable ? '#1f8f4d' : '#8f1f2a' }]}>{item.isAvailable ? 'Available' : 'Unavailable'}</Text>
        </View>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={() => dispatch(toggleAvailability(item.id))}><Text style={styles.btnText}>{item.isAvailable ? 'Disable' : 'Enable'}</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={() => openEdit(item)}><Text style={styles.btnText}>Edit</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.btnDanger]} onPress={() => confirmDelete(item.id)}><Text style={styles.btnText}>Delete</Text></TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>Menu</Text>
        <Text style={styles.subtitle}>Add, edit or disable dishes in your restaurant menu</Text>
      </View>

      <View style={styles.filters}>
        <TextInput placeholder="Search dishes..." placeholderTextColor={colors.textSecondary} value={search} onChangeText={setSearch} style={styles.search} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {categories.map(c => (
            <TouchableOpacity key={c} style={[styles.catChip, categoryFilter === c && styles.catChipActive]} onPress={() => setCategoryFilter(c)}>
              <Text style={[styles.catText, categoryFilter === c && styles.catTextActive]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList 
        data={filtered} 
        keyExtractor={(i) => i.id} 
        renderItem={renderItem} 
        contentContainerStyle={{ 
          padding: spacing.md, 
          paddingBottom: 120 
        }} 
      />

      <TouchableOpacity 
        style={styles.addButton} 
        onPress={openAdd}
      >
        <Text style={styles.addButtonText}>+ Add Dish</Text>
      </TouchableOpacity>

      <Modal visible={modalOpen} animationType="slide" transparent onRequestClose={() => setModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>{editing ? 'Edit Dish' : 'Add Dish'}</Text>
            <TextInput style={styles.input} placeholder="Name" placeholderTextColor={colors.textSecondary} value={form.name} onChangeText={(t) => setForm({ ...form, name: t })} />
            <TextInput style={styles.input} placeholder="Description" placeholderTextColor={colors.textSecondary} value={form.description} onChangeText={(t) => setForm({ ...form, description: t })} />
            <TextInput style={styles.input} placeholder="Category" placeholderTextColor={colors.textSecondary} value={form.category} onChangeText={(t) => setForm({ ...form, category: t })} />
            <TextInput style={styles.input} placeholder="Price" placeholderTextColor={colors.textSecondary} keyboardType="numeric" value={String(form.price || '')} onChangeText={(t) => setForm({ ...form, price: Number(t) })} />
            
            {/* Order Type Selection */}
            <View style={styles.orderTypeSection}>
              <Text style={styles.orderTypeLabel}>Order Type</Text>
              <View style={styles.orderTypeButtons}>
                <TouchableOpacity
                  style={[
                    styles.orderTypeButton,
                    form.orderType === 'KOT' && styles.orderTypeButtonActive
                  ]}
                  onPress={() => setForm({ ...form, orderType: 'KOT' })}
                >
                  <Text style={[
                    styles.orderTypeButtonText,
                    form.orderType === 'KOT' && styles.orderTypeButtonTextActive
                  ]}>
                    KOT
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.orderTypeButton,
                    form.orderType === 'BOT' && styles.orderTypeButtonActiveBOT
                  ]}
                  onPress={() => setForm({ ...form, orderType: 'BOT' })}
                >
                  <Text style={[
                    styles.orderTypeButtonText,
                    form.orderType === 'BOT' && styles.orderTypeButtonTextActive
                  ]}>
                    BOT
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            
            {/* Image Section */}
            <View style={styles.imageSection}>
              <Text style={styles.imageLabel}>Dish Image</Text>
              {form.image ? (
                <View style={styles.imageContainer}>
                  <Image source={{ uri: form.image }} style={styles.imagePreview} />
                  <View style={styles.imageActions}>
                    <TouchableOpacity style={styles.imageActionButton} onPress={showImageOptions}>
                      <Text style={styles.imageActionText}>Change</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.imageActionButton, styles.removeImageButton]} onPress={handleRemoveImage}>
                      <Text style={styles.imageActionText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity style={styles.imageButton} onPress={showImageOptions}>
                  <View style={styles.imagePlaceholder}>
                    <Text style={styles.imagePlaceholderText}>+ Add Image</Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.mbtn, styles.cancel]} onPress={() => setModalOpen(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.mbtn, styles.save]} onPress={save}><Text style={styles.saveText}>{editing ? 'Update' : 'Save'}</Text></TouchableOpacity>
            </View>
          </View>
                 </View>
       </Modal>
     </SafeAreaView>
   );
 };

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.md, paddingTop: 0, borderBottomWidth: 1, borderBottomColor: colors.outline },
  title: { fontSize: 24, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 4 },
  subtitle: { color: colors.textSecondary },
  filters: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.outline },
  search: { borderWidth: 1, borderColor: colors.outline, borderRadius: radius.md, padding: spacing.md, color: colors.textPrimary, backgroundColor: colors.surface2, marginBottom: spacing.sm },
  catChip: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.outline, marginRight: spacing.sm, backgroundColor: colors.surface },
  catChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  catText: { color: colors.textSecondary, fontWeight: '600' },
  catTextActive: { color: 'white' },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.outline, borderRadius: radius.lg, marginHorizontal: spacing.md, marginTop: spacing.sm, padding: spacing.md },
  name: { color: colors.textPrimary, fontWeight: '700', fontSize: 16 },
  desc: { color: colors.textSecondary, marginTop: 4 },
  meta: { color: colors.textSecondary, marginTop: 8 },
  badge: { alignSelf: 'flex-start', marginTop: 8, color: 'white', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, overflow: 'hidden' },
  actions: { flexDirection: 'row', gap: 8, marginTop: spacing.md },
  btn: { flex: 1, padding: spacing.sm, borderRadius: radius.md, alignItems: 'center' },
  btnPrimary: { backgroundColor: colors.primary },
  btnSecondary: { backgroundColor: colors.surface2 },
  btnDanger: { backgroundColor: colors.danger },
  btnText: { color: 'white', fontWeight: '600' },
  addButton: { 
    position: 'absolute', 
    bottom: 80, 
    right: 20, 
    backgroundColor: colors.success, 
    paddingHorizontal: 20, 
    paddingVertical: 16, 
    borderRadius: 30, 
    ...shadow.card,
  },
  addButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  modal: { width: '92%', backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.outline },
  modalTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: 'bold', marginBottom: spacing.md, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: colors.outline, borderRadius: radius.md, padding: spacing.md, color: colors.textPrimary, backgroundColor: colors.surface2, marginBottom: spacing.sm },
  modalActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  mbtn: { flex: 1, padding: spacing.md, alignItems: 'center', borderRadius: radius.md },
  cancel: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.outline },
  save: { backgroundColor: colors.primary },
  cancelText: { color: colors.textSecondary, fontWeight: '600' },
  saveText: { color: 'white', fontWeight: '700' },
  imageSection: { marginBottom: spacing.sm },
  imageLabel: { color: colors.textSecondary, fontSize: 14, fontWeight: '600', marginBottom: spacing.xs },
  imageButton: { borderWidth: 1, borderColor: colors.outline, borderRadius: radius.md, padding: spacing.md, backgroundColor: colors.surface2, alignItems: 'center' },
  imagePreview: {
    width: '100%',
    height: 150,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  imagePreviewText: { color: 'white', fontWeight: '600' },
  imagePlaceholder: { backgroundColor: colors.primary, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.sm },
  imagePlaceholderText: { color: 'white', fontWeight: '600' },
  orderTypeSection: { marginTop: spacing.sm, marginBottom: spacing.sm },
  orderTypeLabel: { color: colors.textSecondary, fontSize: 14, fontWeight: '600', marginBottom: spacing.xs },
  orderTypeSubLabel: { color: colors.textSecondary, fontSize: 12, marginBottom: spacing.sm },
  orderTypeButtons: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xs },
  orderTypeButton: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.md, borderWidth: 1, borderColor: colors.outline },
  orderTypeButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  orderTypeButtonActiveBOT: { backgroundColor: '#8f1f2a', borderColor: '#8f1f2a' },
  orderTypeButtonText: { color: colors.textPrimary, fontWeight: '600' },
  orderTypeButtonTextActive: { color: 'white' },
  orderTypeStatus: { color: colors.textSecondary, fontSize: 12, textAlign: 'center' },
  imageContainer: {
    width: '100%',
    height: 150,
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: radius.md,
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  imagePreviewContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  imageActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  imageActionButton: {
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.outline,
  },
  imageActionText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  removeImageButton: {
    borderColor: colors.danger,
  },
  removeImageButtonText: {
    color: colors.danger,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  itemImage: {
    width: 60,
    height: 60,
    borderRadius: radius.md,
    marginRight: spacing.sm,
    backgroundColor: colors.surface,
  },
  itemInfo: {
    flex: 1,
  },
});

export default MenuManagementScreen;




