import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import Constants from 'expo-constants';
import { useTheme } from '../shared/theme/ThemeProvider';
import { useAuth } from '../context/AuthContext';
import { GOOGLE_CLIENT_IDS, BASE_URL } from '../shared/config/env';
import BrandMark from '../components/BrandMark';

export default function SettingsScreen({ navigation }) {
  const { user, logout } = useAuth();
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const appVersion = Constants?.expoConfig?.version || '1.0.0';
  const googleReady = Boolean(
    GOOGLE_CLIENT_IDS.web || GOOGLE_CLIENT_IDS.android || GOOGLE_CLIENT_IDS.ios || GOOGLE_CLIENT_IDS.expo
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.heroCard}>
        <View style={styles.heroBadge}>
          <BrandMark size={22} subtle />
        </View>
        <Text style={styles.eyebrow}>Hesap</Text>
        <Text style={styles.title}>Ayarlar</Text>
        <Text style={styles.sub}>{user?.fullName || user?.email || 'Kullanıcı'}</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.infoGrid}>
          <View style={styles.infoBox}>
            <Text style={styles.infoLabel}>Aktif ev</Text>
            <Text style={styles.infoValue}>
              {user?.defaultHouseName || (user?.defaultHouseId ? `Ev #${user.defaultHouseId}` : 'Seçilmedi')}
            </Text>
          </View>
          <View style={styles.infoBox}>
            <Text style={styles.infoLabel}>Google giriş</Text>
            <Text style={styles.infoValue}>{googleReady ? 'Hazır' : 'Kurulum bekliyor'}</Text>
          </View>
          <View style={styles.infoBox}>
            <Text style={styles.infoLabel}>Uygulama</Text>
            <Text style={styles.infoValue}>v{appVersion}</Text>
          </View>
          <View style={styles.infoBox}>
            <Text style={styles.infoLabel}>API</Text>
            <Text style={styles.infoValue} numberOfLines={1}>
              {BASE_URL}
            </Text>
          </View>
        </View>

        <TouchableOpacity style={styles.rowBtn} activeOpacity={0.88} onPress={() => navigation.navigate('ProfilDuzenle')}>
          <View>
            <Text style={styles.rowTitle}>Profili Düzenle</Text>
            <Text style={styles.rowDesc}>Ad soyad ve şifre bilgilerini güncelle</Text>
          </View>
          <Text style={styles.rowArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.rowBtn} activeOpacity={0.88} onPress={() => navigation.navigate('ThemeSettingsScreen')}>
          <View>
            <Text style={styles.rowTitle}>Tema</Text>
            <Text style={styles.rowDesc}>Açık, koyu veya AMOLED görünüm arasında geçiş yap</Text>
          </View>
          <Text style={styles.rowArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.rowBtn} activeOpacity={0.88} onPress={() => navigation.navigate('GrupListesi')}>
          <View>
            <Text style={styles.rowTitle}>Aktif ev grubunu değiştir</Text>
            <Text style={styles.rowDesc}>Varsayılan ev seçimini güncelle</Text>
          </View>
          <Text style={styles.rowArrow}>›</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.logoutBtn}
        activeOpacity={0.88}
        onPress={async () => {
          try {
            await logout();
          } catch {
            Alert.alert('Hata', 'Çıkış yapılamadı');
          }
        }}
      >
        <Text style={styles.logoutTitle}>Çıkış Yap</Text>
        <Text style={styles.logoutDesc}>Oturumu bu cihazdan kapat</Text>
      </TouchableOpacity>

      <View style={styles.signatureWrap}>
        <Text style={styles.signatureText}>
          Bu bir Tarık Çetintürk projesidir. Backend, frontend ve DevOps süreçlerinin tamamı tek
          başına geliştirilmiştir.
        </Text>
      </View>
    </ScrollView>
  );
}

const makeStyles = (theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      padding: 16,
      paddingBottom: 32,
    },
    heroCard: {
      padding: 18,
      borderRadius: 22,
      backgroundColor: theme.colors.primary[50],
      borderWidth: 1,
      borderColor: theme.colors.primary[200],
      marginBottom: 16,
      position: 'relative',
      overflow: 'hidden',
    },
    heroBadge: {
      position: 'absolute',
      top: 14,
      right: 14,
    },
    eyebrow: {
      color: theme.colors.primary[700],
      fontSize: 12,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 6,
    },
    title: {
      color: theme.colors.text.primary,
      fontSize: 24,
      fontWeight: '900',
    },
    sub: {
      color: theme.colors.text.secondary,
      marginTop: 6,
      fontSize: 14,
    },
    card: {
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.colors.neutral[200],
      backgroundColor: theme.colors.surface,
      padding: 8,
      gap: 8,
    },
    infoGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      gap: 8,
      marginBottom: 8,
    },
    infoBox: {
      width: '48%',
      borderRadius: 14,
      padding: 12,
      backgroundColor: theme.colors.primary[50],
      borderWidth: 1,
      borderColor: theme.colors.primary[100],
    },
    infoLabel: {
      color: theme.colors.text.secondary,
      fontSize: 12,
      fontWeight: '700',
      marginBottom: 6,
    },
    infoValue: {
      color: theme.colors.text.primary,
      fontWeight: '800',
      fontSize: 14,
    },
    rowBtn: {
      borderRadius: 16,
      padding: 14,
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.neutral[200],
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    rowTitle: {
      color: theme.colors.text.primary,
      fontWeight: '800',
      fontSize: 15,
      marginBottom: 4,
    },
    rowDesc: {
      color: theme.colors.text.secondary,
      fontSize: 13,
      lineHeight: 18,
      maxWidth: '90%',
    },
    rowArrow: {
      color: theme.colors.primary[600],
      fontSize: 24,
      fontWeight: '700',
    },
    logoutBtn: {
      marginTop: 16,
      borderRadius: 20,
      padding: 16,
      backgroundColor: theme.colors.error[50],
      borderWidth: 1,
      borderColor: theme.colors.error[200],
    },
    logoutTitle: {
      color: theme.colors.error[700],
      fontWeight: '800',
      fontSize: 16,
      marginBottom: 4,
    },
    logoutDesc: {
      color: theme.colors.error[600],
      fontSize: 13,
    },
    signatureWrap: {
      pointerEvents: 'none',
      marginTop: 14,
      paddingHorizontal: 10,
    },
    signatureText: {
      color: theme.colors.text.secondary,
      opacity: 0.5,
      fontSize: 12,
      lineHeight: 18,
      textAlign: 'center',
    },
  });
