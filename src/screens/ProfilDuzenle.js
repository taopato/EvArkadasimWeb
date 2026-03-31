import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../services/api';
import { useTheme } from '../shared/theme/ThemeProvider';
import { useCommonStyles } from '../shared/ui/CommonStyles';

export default function ProfilDuzenle({ navigation }) {
  const { user, updateUserData } = useAuth();
  const { theme } = useTheme();
  const CommonStyles = useCommonStyles();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [fullName, setFullName] = useState(user?.fullName || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUpdate = async () => {
    if (!fullName.trim()) {
      Alert.alert('Hata', 'Ad soyad bos olamaz');
      return;
    }

    if (newPassword && newPassword !== confirmPassword) {
      Alert.alert('Hata', 'Yeni sifreler eslesmiyor');
      return;
    }

    if (newPassword && !currentPassword) {
      Alert.alert('Hata', 'Sifre degistirmek icin mevcut sifrenizi girmelisiniz');
      return;
    }

    try {
      setLoading(true);
      const data = {
        fullName: fullName.trim(),
        currentPassword: currentPassword || null,
        newPassword: newPassword || null,
      };

      const res = await authApi.updateProfile(user.id, data);

      if (res.data?.success) {
        updateUserData({ ...user, fullName: fullName.trim() });
        Alert.alert('Basarili', 'Profil bilgileriniz guncellendi');
        navigation.goBack();
      } else {
        Alert.alert('Hata', res.data?.message || 'Guncelleme basarisiz');
      }
    } catch (error) {
      Alert.alert('Hata', error?.response?.data?.message || 'Bir hata olustu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[CommonStyles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        style={CommonStyles.content}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <View style={CommonStyles.header}>
          <Text style={CommonStyles.title}>Profilini Duzenle</Text>
          <Text style={CommonStyles.subtitle}>Bilgilerini guncel tut</Text>
        </View>

        <View style={[CommonStyles.card, styles.card]}>
          <Text style={styles.label}>Ad Soyad</Text>
          <TextInput
            style={styles.input}
            value={fullName}
            onChangeText={setFullName}
            placeholder="Ad Soyad"
            placeholderTextColor={theme.colors.text.disabled}
          />

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Sifre Degistir</Text>
          <Text style={styles.infoText}>Sifrenizi degistirmek istemiyorsaniz bu alanlari bos birakin.</Text>

          <Text style={styles.label}>Mevcut Sifre</Text>
          <TextInput
            style={styles.input}
            value={currentPassword}
            onChangeText={setCurrentPassword}
            placeholder="Mevcut Sifre"
            placeholderTextColor={theme.colors.text.disabled}
            secureTextEntry
          />

          <Text style={styles.label}>Yeni Sifre</Text>
          <TextInput
            style={styles.input}
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="Yeni Sifre"
            placeholderTextColor={theme.colors.text.disabled}
            secureTextEntry
          />

          <Text style={styles.label}>Yeni Sifre (Tekrar)</Text>
          <TextInput
            style={styles.input}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Yeni Sifre (Tekrar)"
            placeholderTextColor={theme.colors.text.disabled}
            secureTextEntry
          />
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: theme.colors.primary?.[600] }]}
          onPress={handleUpdate}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={theme.colors.text.onPrimary} />
          ) : (
            <Text style={styles.saveBtnText}>Degisiklikleri Kaydet</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const makeStyles = (theme) =>
  StyleSheet.create({
    content: {
      paddingBottom: 32,
    },
    card: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.neutral[200],
    },
    label: {
      fontSize: 14,
      fontWeight: '700',
      marginBottom: 8,
      marginTop: 15,
      color: theme.colors.text.secondary,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.colors.neutral[300],
      borderRadius: 12,
      padding: 12,
      fontSize: 16,
      color: theme.colors.text.primary,
      backgroundColor: theme.colors.background,
    },
    divider: {
      height: 1,
      backgroundColor: theme.colors.neutral[200],
      marginVertical: 25,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '800',
      marginBottom: 5,
      color: theme.colors.text.primary,
    },
    infoText: {
      fontSize: 12,
      color: theme.colors.text.secondary,
      marginBottom: 15,
      lineHeight: 18,
    },
    saveBtn: {
      marginTop: 20,
      padding: 18,
      borderRadius: 15,
      alignItems: 'center',
    },
    saveBtnText: {
      color: theme.colors.text.onPrimary,
      fontWeight: 'bold',
      fontSize: 16,
    },
  });
