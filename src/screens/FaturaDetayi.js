import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../shared/theme/ThemeProvider';
import { expensesApi } from '../services/api';
import eventBus from '../shared/events/bus';

const asData = (response) => response?.data?.data ?? response?.data ?? null;

const toMoney = (value) =>
  new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const formatDate = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('tr-TR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

const textToLabel = (text = '') => {
  const value = String(text).toLowerCase();
  if (/(elektrik|electric)/.test(value)) return 'Elektrik';
  if (/(su|water)/.test(value)) return 'Su';
  if (/(dogalgaz|doğalgaz|gaz|gas)/.test(value)) return 'Dogalgaz';
  if (/internet/.test(value)) return 'Internet';
  if (/(kira|rent)/.test(value)) return 'Kira';
  return 'Diger';
};

export default function FaturaDetayi({ route, navigation }) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { billId, houseId, houseName } = route.params || {};

  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [bill, setBill] = useState(null);

  const loadBill = useCallback(async () => {
    if (!billId) return;
    setLoading(true);
    try {
      const response = await expensesApi.getById(billId);
      setBill(asData(response));
    } catch {
      Alert.alert('Hata', 'Fatura detayi yuklenemedi.');
    } finally {
      setLoading(false);
    }
  }, [billId]);

  useFocusEffect(
    useCallback(() => {
      loadBill();
    }, [loadBill])
  );

  const goBackSafe = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.replace('BillsOverviewScreen', { houseId, houseName });
  };

  const emitRefresh = () => {
    try {
      eventBus.emit('expenses:updated', { houseId: Number(houseId), expenseId: Number(billId) });
    } catch {}
  };

  const removeBill = async () => {
    setDeleting(true);
    try {
      await expensesApi.remove(billId);
      emitRefresh();
      navigation.replace('BillsOverviewScreen', { houseId, houseName });
    } catch {
      Alert.alert('Hata', 'Fatura silinemedi.');
    } finally {
      setDeleting(false);
    }
  };

  const handleDelete = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm('Bu faturayi silmek istiyor musun?')) {
        removeBill();
      }
      return;
    }
    Alert.alert('Faturayi Sil', 'Bu kayit kalici olarak silinecek.', [
      { text: 'Iptal', style: 'cancel' },
      { text: 'Sil', style: 'destructive', onPress: removeBill },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.loaderWrap}>
        <ActivityIndicator size="large" color={theme.colors.primary[500]} />
      </View>
    );
  }

  if (!bill) {
    return (
      <View style={styles.loaderWrap}>
        <Text style={styles.emptyText}>Fatura bulunamadi.</Text>
      </View>
    );
  }

  const title = bill?.tur || `${textToLabel(bill?.category)} Faturasi`;
  const rows = [
    { label: 'Tutar', value: toMoney(bill?.amount ?? bill?.tutar) },
    { label: 'Kategori', value: textToLabel(bill?.tur || bill?.category || '') },
    { label: 'Kayit tarihi', value: formatDate(bill?.kayitTarihi ?? bill?.postDate) },
    { label: 'Vade gunu', value: bill?.dueDay ? String(bill.dueDay) : '-' },
  ];

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={[theme.colors.primary[500], theme.colors.primary[400]]} style={styles.hero}>
          <Text style={styles.heroBadge}>FATURA DETAYI</Text>
          <Text style={styles.heroTitle}>{title}</Text>
          <Text style={styles.heroSubtitle}>{houseName || 'Ev grubu'}</Text>
          <Text style={styles.heroAmount}>{toMoney(bill?.amount ?? bill?.tutar)}</Text>
        </LinearGradient>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Bilgiler</Text>
          {rows.map((row) => (
            <View key={row.label} style={styles.row}>
              <Text style={styles.rowLabel}>{row.label}</Text>
              <Text style={styles.rowValue}>{row.value}</Text>
            </View>
          ))}
          <View style={styles.noteBlock}>
            <Text style={styles.noteLabel}>Not</Text>
            <Text style={styles.noteText}>
              {bill?.description || bill?.note || bill?.aciklama || 'Aciklama yok.'}
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={goBackSafe} activeOpacity={0.85}>
            <Text style={styles.secondaryButtonText}>Listeye Don</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={() => navigation.navigate('FaturaEkle', { billId, houseId, houseName, isEditing: true })}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryButtonText}>Duzenle</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.dangerButton, deleting && styles.disabledButton]}
            onPress={handleDelete}
            activeOpacity={0.85}
            disabled={deleting}
          >
            <Text style={styles.dangerButtonText}>{deleting ? 'Siliniyor...' : 'Sil'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

function makeStyles(theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    loaderWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.background,
      padding: 24,
    },
    content: {
      padding: 16,
      paddingBottom: 40,
      gap: 16,
    },
    hero: {
      borderRadius: 24,
      padding: 20,
      gap: 8,
    },
    heroBadge: {
      color: '#dff4ff',
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 0.8,
    },
    heroTitle: {
      color: '#fff',
      fontSize: 28,
      fontWeight: '800',
    },
    heroSubtitle: {
      color: 'rgba(255,255,255,0.9)',
      fontSize: 15,
      fontWeight: '600',
    },
    heroAmount: {
      color: '#fff',
      fontSize: 30,
      fontWeight: '800',
      marginTop: 6,
    },
    card: {
      backgroundColor: theme.colors.surface || '#fff',
      borderRadius: 20,
      padding: 18,
      borderWidth: 1,
      borderColor: theme.colors.neutral?.[200] || '#e6edf5',
      gap: 12,
    },
    cardTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: theme.colors.text.primary,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 6,
    },
    rowLabel: {
      flex: 1,
      color: theme.colors.text.secondary,
      fontSize: 14,
      fontWeight: '600',
    },
    rowValue: {
      flex: 1,
      textAlign: 'right',
      color: theme.colors.text.primary,
      fontSize: 15,
      fontWeight: '700',
    },
    noteBlock: {
      marginTop: 6,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: theme.colors.neutral?.[200] || '#e6edf5',
      gap: 6,
    },
    noteLabel: {
      color: theme.colors.text.secondary,
      fontSize: 13,
      fontWeight: '700',
    },
    noteText: {
      color: theme.colors.text.primary,
      fontSize: 15,
      lineHeight: 22,
    },
    actions: {
      gap: 12,
      paddingBottom: 12,
    },
    button: {
      minHeight: 52,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 18,
    },
    primaryButton: {
      backgroundColor: theme.colors.primary[500],
    },
    secondaryButton: {
      backgroundColor: theme.colors.neutral?.[100] || '#eef3f8',
      borderWidth: 1,
      borderColor: theme.colors.neutral?.[200] || '#dce4ec',
    },
    dangerButton: {
      backgroundColor: '#fff1f1',
      borderWidth: 1,
      borderColor: '#f3b4b4',
    },
    primaryButtonText: {
      color: '#fff',
      fontSize: 15,
      fontWeight: '800',
    },
    secondaryButtonText: {
      color: theme.colors.text.primary,
      fontSize: 15,
      fontWeight: '800',
    },
    dangerButtonText: {
      color: '#c33f3f',
      fontSize: 15,
      fontWeight: '800',
    },
    disabledButton: {
      opacity: 0.65,
    },
    emptyText: {
      color: theme.colors.text.secondary,
      fontSize: 16,
      textAlign: 'center',
    },
  });
}
