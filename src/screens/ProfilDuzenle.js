import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../services/api';
import { useTheme } from '../shared/theme/ThemeProvider';
import { useCommonStyles } from '../shared/ui/CommonStyles';

const ProfilDuzenle = ({ navigation }) => {
  const { user, updateUserData } = useAuth();
  const { theme } = useTheme();
  const CommonStyles = useCommonStyles();

  const [fullName, setFullName] = useState(user?.fullName || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUpdate = async () => {
    if (!fullName.trim()) {
      Alert.alert('Hata', 'Ad soyad boş olamaz');
      return;
    }

    if (newPassword && newPassword !== confirmPassword) {
      Alert.alert('Hata', 'Yeni şifreler eşleşmiyor');
      return;
    }

    if (newPassword && !currentPassword) {
      Alert.alert('Hata', 'Şifre değiştirmek için mevcut şifrenizi girmelisiniz');
      return;
    }

    try {
      setLoading(true);
      const data = {
        fullName: fullName.trim(),
        currentPassword: currentPassword || null,
        newPassword: newPassword || null
      };

      const res = await authApi.updateProfile(user.id, data);
      
      if (res.data?.success) {
        // Auth context'i güncelle
        updateUserData({ ...user, fullName: fullName.trim() });
        Alert.alert('Başarılı', 'Profil bilgileriniz güncellendi');
        navigation.goBack();
      } else {
        Alert.alert('Hata', res.data?.message || 'Güncelleme başarısız');
      }
    } catch (error) {
      Alert.alert('Hata', error?.response?.data?.message || 'Bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[CommonStyles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView style={CommonStyles.content}>
        <View style={CommonStyles.header}>
          <Text style={CommonStyles.title}>Profilini Düzenle</Text>
          <Text style={CommonStyles.subtitle}>Bilgilerini güncel tut</Text>
        </View>

        <View style={CommonStyles.card}>
          <Text style={styles.label}>Ad Soyad</Text>
          <TextInput
            style={styles.input}
            value={fullName}
            onChangeText={setFullName}
            placeholder="Ad Soyad"
          />

          <View style={styles.divider} />
          
          <Text style={styles.sectionTitle}>Şifre Değiştir</Text>
          <Text style={styles.infoText}>Şifrenizi değiştirmek istemiyorsanız bu alanları boş bırakın.</Text>

          <Text style={styles.label}>Mevcut Şifre</Text>
          <TextInput
            style={styles.input}
            value={currentPassword}
            onChangeText={setCurrentPassword}
            placeholder="Mevcut Şifre"
            secureTextEntry
          />

          <Text style={styles.label}>Yeni Şifre</Text>
          <TextInput
            style={styles.input}
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="Yeni Şifre"
            secureTextEntry
          />

          <Text style={styles.label}>Yeni Şifre (Tekrar)</Text>
          <TextInput
            style={styles.input}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Yeni Şifre (Tekrar)"
            secureTextEntry
          />
        </View>

        <TouchableOpacity 
          style={[styles.saveBtn, { backgroundColor: theme.colors.primary?.[600] }]}
          onPress={handleUpdate}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveBtnText}>Değişiklikleri Kaydet</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8, marginTop: 15, opacity: 0.7 },
  input: { borderWidth: 1, borderColor: '#eee', borderRadius: 12, padding: 12, fontSize: 16 },
  divider: { height: 1, backgroundColor: '#f0f0f0', marginVertical: 25 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 5 },
  infoText: { fontSize: 12, opacity: 0.5, marginBottom: 15 },
  saveBtn: { marginTop: 20, padding: 18, borderRadius: 15, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});

export default ProfilDuzenle;
