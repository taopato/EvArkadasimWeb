import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../shared/theme/ThemeProvider';
import { useAuth } from '../context/AuthContext';
import { expensesApi, houseApi, ledgerApi } from '../services/api';
import eventBus from '../shared/events/bus';

const asData = (response) => response?.data?.data ?? response?.data ?? null;

const toMoney = (value) =>
  new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const toInputMoney = (value) => {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

const fromInputMoney = (value) => {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits ? Number(digits) : 0;
};

const formatDate = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('tr-TR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

export default function HarcamaDetayi({ navigation, route }) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { expenseId: expenseIdParam, billId: billIdParam, houseId, houseName } = route.params || {};
  const expenseId = expenseIdParam ?? billIdParam;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [expense, setExpense] = useState(null);
  const [ledgerLines, setLedgerLines] = useState([]);
  const [membersMap, setMembersMap] = useState({});
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [sharedAmount, setSharedAmount] = useState('');
  const [note, setNote] = useState('');

  const loadData = useCallback(async () => {
    if (!expenseId) return;
    setLoading(true);
    try {
      const [expenseRes, ledgerRes, membersRes] = await Promise.all([
        expensesApi.getById(expenseId),
        ledgerApi.byExpense(expenseId).catch(() => ({ data: [] })),
        houseId ? houseApi.getMembers(houseId).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
      ]);

      const loadedExpense = asData(expenseRes);
      const loadedLedger = asData(ledgerRes) || [];
      const members = asData(membersRes) || [];

      const nextMap = {};
      (Array.isArray(members) ? members : []).forEach((member) => {
        const id = Number(member?.userId ?? member?.id ?? member?.user?.id);
        const fullName = member?.fullName ?? member?.name ?? member?.user?.fullName;
        if (Number.isFinite(id)) nextMap[id] = fullName || `Kullanici ${id}`;
      });

      setExpense(loadedExpense);
      setLedgerLines(Array.isArray(loadedLedger) ? loadedLedger : []);
      setMembersMap(nextMap);
      setTitle(String(loadedExpense?.tur ?? loadedExpense?.category ?? ''));
      setAmount(toInputMoney(loadedExpense?.tutar ?? loadedExpense?.amount ?? 0));
      setSharedAmount(toInputMoney(loadedExpense?.ortakHarcamaTutari ?? 0));
      setNote(
        String(
          loadedExpense?.note ??
            loadedExpense?.description ??
            loadedExpense?.aciklama ??
            ''
        )
      );
    } catch (error) {
      Alert.alert('Hata', 'Harcama detayi yuklenemedi.');
    } finally {
      setLoading(false);
    }
  }, [expenseId, houseId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const payerName =
    expense?.odeyenKullaniciAdi ||
    expense?.odeyenUser?.fullName ||
    membersMap[Number(expense?.odeyenUserId)] ||
    '-';

  const summaryRows = [
    { label: 'Toplam', value: toMoney(expense?.tutar ?? expense?.amount) },
    { label: 'Ortak kisim', value: toMoney(expense?.ortakHarcamaTutari ?? 0) },
    { label: 'Odeyen', value: payerName },
    { label: 'Tarih', value: formatDate(expense?.postDate ?? expense?.kayitTarihi ?? expense?.createdDate) },
  ];

  const groupedLedger = Object.values(
    ledgerLines.reduce((acc, item) => {
      const uid = Number(item?.toUserId ?? item?.ToUserId ?? item?.userId ?? item?.UserId);
      const amountValue = Number(item?.amount ?? item?.Amount ?? 0);
      if (!Number.isFinite(uid)) return acc;
      acc[uid] = acc[uid] || { uid, total: 0 };
      acc[uid].total += amountValue;
      return acc;
    }, {})
  );

  const ledgerByPair = useMemo(
    () =>
      Object.values(
        ledgerLines.reduce((acc, line) => {
          const fromUserId = Number(line?.fromUserId ?? line?.FromUserId);
          const toUserId = Number(line?.toUserId ?? line?.ToUserId);
          const amountValue = Number(line?.amount ?? line?.Amount ?? 0);
          if (!Number.isFinite(fromUserId) || !Number.isFinite(toUserId) || !(amountValue > 0)) return acc;

          const key = `${fromUserId}-${toUserId}`;
          acc[key] = acc[key] || { fromUserId, toUserId, amount: 0 };
          acc[key].amount += amountValue;
          return acc;
        }, {})
      ),
    [ledgerLines]
  );

  const personalByUser = useMemo(
    () =>
      (expense?.sahsiHarcamalar ?? expense?.SahsiHarcamalar ?? []).reduce((acc, item) => {
        const uid = Number(item?.userId ?? item?.UserId);
        const amountValue = Number(item?.tutar ?? item?.Tutar ?? 0);
        if (!Number.isFinite(uid) || amountValue <= 0) return acc;
        acc[uid] = (acc[uid] || 0) + amountValue;
        return acc;
      }, {}),
    [expense]
  );

  const sharedByUser = useMemo(
    () =>
      ledgerLines.reduce((acc, line) => {
        const uid = Number(line?.fromUserId ?? line?.FromUserId);
        const amountValue = Number(line?.amount ?? line?.Amount ?? 0);
        if (!Number.isFinite(uid) || amountValue <= 0) return acc;
        acc[uid] = (acc[uid] || 0) + amountValue;
        return acc;
      }, {}),
    [ledgerLines]
  );

  const perUserBreakdown = useMemo(() => {
    const payerId = Number(expense?.odeyenUserId ?? expense?.OdeyenUserId);
    const memberIds = new Set([
      ...Object.keys(membersMap).map((id) => Number(id)),
      ...Object.keys(personalByUser).map((id) => Number(id)),
      ...Object.keys(sharedByUser).map((id) => Number(id)),
      Number.isFinite(payerId) ? payerId : null,
    ]);

    return [...memberIds]
      .filter((uid) => Number.isFinite(uid))
      .map((uid) => {
        const personalAmount = Number(personalByUser[uid] || 0);
        const sharedAmountValue = Number(sharedByUser[uid] || 0);
        return {
          uid,
          name: membersMap[uid] || (uid === payerId ? payerName : `Kullanici ${uid}`),
          personalAmount,
          sharedAmount: sharedAmountValue,
          total: personalAmount + sharedAmountValue,
        };
      })
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'tr-TR'));
  }, [expense, membersMap, payerName, personalByUser, sharedByUser]);

  const goBackSafe = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.replace('TumHarcamalar', { houseId, houseName });
  };

  const emitRefresh = () => {
    try {
      eventBus.emit('expenses:updated', { houseId: Number(houseId), expenseId: Number(expenseId) });
    } catch {}
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Hata', 'Baslik bos olamaz.');
      return;
    }

    const total = fromInputMoney(amount);
    const shared = fromInputMoney(sharedAmount);
    if (!(total > 0)) {
      Alert.alert('Hata', 'Gecerli bir tutar gir.');
      return;
    }

    setSaving(true);
    try {
      const desc = note.trim();
      await expensesApi.update(expenseId, {
        Tur: title.trim(),
        Tutar: total,
        OrtakHarcamaTutari: shared,
        Aciklama: desc,
        Description: desc,
        Note: desc,
      });
      emitRefresh();
      setIsEditing(false);
      await loadData();
    } catch (error) {
      Alert.alert('Hata', 'Harcama guncellenemedi.');
    } finally {
      setSaving(false);
    }
  };

  const performDelete = async () => {
    setDeleting(true);
    try {
      await expensesApi.remove(expenseId);
      emitRefresh();
      navigation.replace('TumHarcamalar', { houseId, houseName });
    } catch (error) {
      Alert.alert('Hata', 'Harcama silinemedi.');
    } finally {
      setDeleting(false);
    }
  };

  const handleDelete = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm('Bu harcamayi silmek istiyor musun?')) {
        performDelete();
      }
      return;
    }

    Alert.alert('Harcamayi Sil', 'Bu kayit kalici olarak silinecek.', [
      { text: 'Iptal', style: 'cancel' },
      { text: 'Sil', style: 'destructive', onPress: performDelete },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.loaderWrap}>
        <ActivityIndicator size="large" color={theme.colors.primary[500]} />
      </View>
    );
  }

  if (!expense) {
    return (
      <View style={styles.loaderWrap}>
        <Text style={styles.emptyText}>Harcama bulunamadi.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={[theme.colors.primary[500], theme.colors.primary[400]]} style={styles.hero}>
          <Text style={styles.heroBadge}>{isEditing ? 'DUZENLEME' : 'HARCAMA DETAYI'}</Text>
          <Text style={styles.heroTitle}>{expense?.tur || expense?.category || 'Harcama'}</Text>
          <Text style={styles.heroSubtitle}>{houseName || 'Ev grubu'}</Text>
          <Text style={styles.heroAmount}>{toMoney(expense?.tutar ?? expense?.amount)}</Text>
        </LinearGradient>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Ozet</Text>
          {summaryRows.map((row) => (
            <View key={row.label} style={styles.row}>
              <Text style={styles.rowLabel}>{row.label}</Text>
              <Text style={styles.rowValue}>{row.value}</Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Aciklama</Text>
          {!isEditing ? (
            <Text style={styles.noteText}>{note || 'Aciklama yok.'}</Text>
          ) : (
            <>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Baslik"
                placeholderTextColor={theme.colors.text.secondary}
                style={styles.input}
              />
              <TextInput
                value={amount}
                onChangeText={(text) => setAmount(toInputMoney(text))}
                placeholder="Toplam tutar"
                placeholderTextColor={theme.colors.text.secondary}
                keyboardType="numeric"
                style={styles.input}
              />
              <TextInput
                value={sharedAmount}
                onChangeText={(text) => setSharedAmount(toInputMoney(text))}
                placeholder="Ortak kisim"
                placeholderTextColor={theme.colors.text.secondary}
                keyboardType="numeric"
                style={styles.input}
              />
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="Not"
                placeholderTextColor={theme.colors.text.secondary}
                multiline
                style={[styles.input, styles.multiline]}
              />
            </>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Borc Akisi</Text>
          {ledgerByPair.length > 0 ? (
            ledgerByPair.map((item, idx) => (
              <View key={`${item.fromUserId}-${item.toUserId}-${idx}`} style={styles.row}>
                <Text style={styles.rowLabel}>
                  {(membersMap[item.fromUserId] || `Kullanici ${item.fromUserId}`)} {' -> '}
                  {(membersMap[item.toUserId] || `Kullanici ${item.toUserId}`)}
                </Text>
                <Text style={styles.rowValue}>{toMoney(item.amount)}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.noteText}>Bu harcama icin borc akisi bulunmuyor.</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Kisi Bazli Dagilim</Text>
          {perUserBreakdown.length > 0 ? (
            perUserBreakdown.map((item) => (
              <View key={item.uid} style={styles.breakdownRow}>
                <Text style={styles.breakdownName}>{item.name}</Text>
                <View style={styles.breakdownValues}>
                  <Text style={styles.breakdownMeta}>Ozel: {toMoney(item.personalAmount)}</Text>
                  <Text style={styles.breakdownMeta}>Ortak: {toMoney(item.sharedAmount)}</Text>
                  <Text style={styles.breakdownTotal}>Toplam: {toMoney(item.total)}</Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.noteText}>Kisi bazli dagilim bulunmuyor.</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Paylasim Ozeti</Text>
          {groupedLedger.length > 0 ? (
            groupedLedger.map((item) => (
              <View key={item.uid} style={styles.row}>
                <Text style={styles.rowLabel}>{membersMap[item.uid] || `Kullanici ${item.uid}`}</Text>
                <Text style={styles.rowValue}>{toMoney(item.total)}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.noteText}>Bu kayit icin paylasim satiri bulunmuyor.</Text>
          )}
        </View>

        <View style={styles.actions}>
          {!isEditing ? (
            <>
              <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={goBackSafe} activeOpacity={0.85}>
                <Text style={styles.secondaryButtonText}>Listeye Don</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.button, styles.primaryButton]} onPress={() => setIsEditing(true)} activeOpacity={0.85}>
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
            </>
          ) : (
            <>
              <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={() => setIsEditing(false)} activeOpacity={0.85}>
                <Text style={styles.secondaryButtonText}>Iptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.primaryButton, saving && styles.disabledButton]}
                onPress={handleSave}
                activeOpacity={0.85}
                disabled={saving}
              >
                <Text style={styles.primaryButtonText}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</Text>
              </TouchableOpacity>
            </>
          )}
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
    breakdownRow: {
      paddingVertical: 8,
      borderTopWidth: 1,
      borderTopColor: theme.colors.neutral?.[100] || '#edf1f6',
      gap: 6,
    },
    breakdownName: {
      color: theme.colors.text.primary,
      fontSize: 15,
      fontWeight: '700',
    },
    breakdownValues: {
      gap: 3,
    },
    breakdownMeta: {
      color: theme.colors.text.secondary,
      fontSize: 13,
      fontWeight: '600',
    },
    breakdownTotal: {
      color: theme.colors.text.primary,
      fontSize: 13,
      fontWeight: '800',
    },
    noteText: {
      color: theme.colors.text.primary,
      fontSize: 15,
      lineHeight: 22,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.colors.neutral?.[300] || '#d4dbe5',
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      color: theme.colors.text.primary,
      backgroundColor: theme.colors.background,
    },
    multiline: {
      minHeight: 100,
      textAlignVertical: 'top',
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
