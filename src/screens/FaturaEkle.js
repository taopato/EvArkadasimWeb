import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Animated,
  Platform,
  TextInput,
  Keyboard,
  KeyboardAvoidingView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../shared/theme/ThemeProvider';
import { useAuth } from '../context/AuthContext';
import { houseApi, expensesApi } from '../services/api';
import Toast from '../components/Toast';
import { toExpenseCategory } from '../constants/ExpenseEnums';
import eventBus from '../shared/events/bus';

const BILL_TYPES = [
  { key: 'Water', label: 'Su', tone: 'variable', description: 'Aylık değişken gider' },
  { key: 'Electricity', label: 'Elektrik', tone: 'variable', description: 'Aylık değişken gider' },
  { key: 'Rent', label: 'Kira', tone: 'fixed', description: 'Sabit aylık gider' },
  { key: 'Gas', label: 'Doğalgaz', tone: 'variable', description: 'Aylık değişken gider' },
  { key: 'Internet', label: 'İnternet', tone: 'fixed', description: 'Sabit aylık gider' },
  { key: 'Other', label: 'Diğer', tone: 'neutral', description: 'Genel fatura kaydı' },
];

const displayName = (category) => {
  const map = {
    Water: 'Su',
    Electricity: 'Elektrik',
    Rent: 'Kira',
    Gas: 'Doğalgaz',
    Internet: 'İnternet',
    Other: 'Diğer',
    0: 'Kira',
    1: 'İnternet',
    2: 'Elektrik',
    3: 'Su',
    4: 'Market',
    5: 'Yemek',
    99: 'Diğer',
  };
  return map[category] || String(category || 'Su');
};

const normalizeBillTypeKey = (value) => {
  const raw = String(value ?? '').toLowerCase();
  if (/(water|su)/.test(raw)) return 'Water';
  if (/(electricity|elektrik)/.test(raw)) return 'Electricity';
  if (/(rent|kira)/.test(raw)) return 'Rent';
  if (/(gas|doğalgaz|dogalgaz|doalgaz)/.test(raw)) return 'Gas';
  if (/internet/.test(raw)) return 'Internet';
  if (/(other|diğer|diger)/.test(raw)) return 'Other';
  return 'Water';
};

const normalizeMembers = (raw) =>
  (Array.isArray(raw) ? raw : [])
    .map((m) => ({
      userId: Number(m.userId ?? m.user?.id ?? NaN),
      fullName: m.fullName ?? m.name ?? m.user?.fullName ?? 'Kullanıcı',
    }))
    .filter((m) => Number.isInteger(m.userId) && m.userId > 0);

export default function FaturaEkle({ route, navigation }) {
  const { houseId, houseName, billId, isEditing } = route.params || {};
  const editingMode = isEditing === true || String(isEditing).toLowerCase() === 'true';
  const { user } = useAuth();
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState([]);
  const [amount, setAmount] = useState('');
  const [billDate, setBillDate] = useState('');
  const [month, setMonth] = useState('');
  const [note, setNote] = useState('');
  const [billType, setBillType] = useState('Water');
  const [responsibleUserId, setResponsibleUserId] = useState(null);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(24));

  const showToast = (message, type = 'success') => setToast({ visible: true, message, type });
  const hideToast = () => setToast((prev) => ({ ...prev, visible: false }));

  useEffect(() => {
    if (!houseId) {
      showToast('Ev bilgisi eksik', 'error');
      navigation.goBack();
      return;
    }

    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const today = `${y}-${m}-${d}`;
    setBillDate(today);
    setMonth(`${y}-${m}`);

    fetchMembers();
    if (editingMode && billId) {
      fetchBillData();
    }

    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(slideAnim, { toValue: 0, duration: 280, useNativeDriver: Platform.OS !== 'web' }),
    ]).start();
  }, [houseId, billId, editingMode]);

  useFocusEffect(
    React.useCallback(() => {
      if (houseId) {
        fetchMembers();
      }
    }, [houseId])
  );

  useEffect(() => {
    if (billDate && /^\d{4}-\d{2}-\d{2}$/.test(billDate)) {
      setMonth(billDate.slice(0, 7));
    }
  }, [billDate]);

  const fetchMembers = async () => {
    try {
      const res = await houseApi.getMembers(houseId);
      const list = normalizeMembers(res?.data?.data || res?.data);
      setMembers(list);
      if (!responsibleUserId) {
        const me = list.find((x) => x.userId === Number(user?.id));
        if (me) setResponsibleUserId(me.userId);
      }
    } catch {
      showToast('Ev üyeleri alınamadı', 'error');
    }
  };

  const fetchBillData = async () => {
    try {
      setLoading(true);
      const response = await expensesApi.getById(billId);
      const bill = response?.data?.data || response?.data;
      if (!bill) return;

      setAmount(String(bill.tutar ?? bill.amount ?? ''));
      const postDate = String(bill.postDate ?? bill.kayitTarihi ?? '').slice(0, 10);
      if (postDate) {
        setBillDate(postDate);
        setMonth(postDate.slice(0, 7));
      }
      setNote(String(bill.note ?? bill.description ?? bill.aciklama ?? ''));
      setBillType(normalizeBillTypeKey(bill.category));
      setResponsibleUserId(Number(bill.odeyenUserId ?? bill.payerUserId ?? 0) || null);
    } catch {
      showToast('Fatura bilgileri alınamadı', 'error');
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    const money = parseFloat(String(amount).replace(',', '.'));
    if (Number.isNaN(money) || money <= 0) {
      showToast('Geçerli bir tutar gir', 'warning');
      return { ok: false };
    }
    if (!billDate || !/^\d{4}-\d{2}-\d{2}$/.test(billDate)) {
      showToast('Tarih formatı YYYY-MM-DD olmalı', 'warning');
      return { ok: false };
    }
    if (!responsibleUserId) {
      showToast('Ödeyen kişiyi seç', 'warning');
      return { ok: false };
    }
    return { ok: true, money };
  };

  const goToBills = () => {
    navigation.replace('BillsOverviewScreen', { houseId, houseName });
  };

  const handleSubmit = async () => {
    Keyboard.dismiss();
    const validation = validateForm();
    if (!validation.ok) return;

    setLoading(true);
    try {
      const safeTitle = `${displayName(billType)} ${month}`.slice(0, 30);
      const desc = (note?.trim() || `${displayName(billType)} • ${billDate}`).slice(0, 250);

      if (editingMode && billId) {
        await expensesApi.update(billId, {
          tur: safeTitle,
          category: toExpenseCategory(billType),
          tutar: validation.money,
          postDate: `${billDate}T00:00:00`,
          dueDate: `${billDate}T00:00:00`,
          description: desc,
          Description: desc,
          note: desc,
          Aciklama: desc,
          splitPolicy: 0,
        });
        try { eventBus.emit('expenses:updated', { houseId: Number(houseId) }); } catch {}
        showToast('Fatura güncellendi', 'success');
        goToBills();
        return;
      }

      const payerId = Number(responsibleUserId);
      const creatorId = Number(user?.id ?? user?.userId ?? payerId ?? 0);
      await expensesApi.createIrregular({
        tur: safeTitle,
        category: toExpenseCategory(billType),
        tutar: validation.money,
        houseId: Number(houseId),
        odeyenUserId: payerId,
        kaydedenUserId: creatorId > 0 ? creatorId : payerId,
        postDate: `${billDate}T00:00:00`,
        dueDate: `${billDate}T00:00:00`,
        splitPolicy: 0,
        personalItems: [],
        description: desc,
        Description: desc,
        Aciklama: desc,
      });

      try { eventBus.emit('expenses:updated', { houseId: Number(houseId) }); } catch {}
      showToast('Fatura kaydedildi', 'success');
      goToBills();
    } catch (error) {
      const serverText = String(error?.response?.data?.message || error?.response?.data || error?.message || 'Beklenmeyen hata');
      showToast(serverText, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={84}>
      <LinearGradient colors={[theme.colors.background, theme.colors.neutral?.[50] || theme.colors.background]} style={styles.gradient}>
        <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.hero}>
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>{editingMode ? 'DÜZENLE' : 'YENİ FATURA'}</Text>
              </View>
              <Text style={styles.heroTitle}>{editingMode ? 'Fatura Düzenle' : 'Fatura Ekle'}</Text>
              <Text style={styles.heroSubtitle}>{houseName || 'Ev grubu'} • {displayName(billType)}</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Temel Bilgiler</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Tutar</Text>
                <TextInput
                  style={styles.input}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                  placeholder="Örn: 700.00"
                  placeholderTextColor={theme.colors.text.disabled}
                />
              </View>

              <View style={styles.row}>
                <View style={[styles.inputGroup, styles.half]}>
                  <Text style={styles.label}>Tarih</Text>
                  <TextInput
                    style={styles.input}
                    value={billDate}
                    onChangeText={setBillDate}
                    placeholder="YYYY-MM-DD"
                    maxLength={10}
                    autoCapitalize="none"
                    placeholderTextColor={theme.colors.text.disabled}
                  />
                </View>
                <View style={[styles.inputGroup, styles.half]}>
                  <Text style={styles.label}>Dönem</Text>
                  <View style={styles.readonlyBox}>
                    <Text style={styles.readonlyText}>{month || '-'}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Not</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={note}
                  onChangeText={setNote}
                  multiline
                  placeholder="İsteğe bağlı kısa açıklama"
                  placeholderTextColor={theme.colors.text.disabled}
                />
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Fatura Türü</Text>
              <View style={styles.chips}>
                {BILL_TYPES.map((type) => {
                  const selected = billType === type.key;
                  return (
                    <TouchableOpacity
                      key={type.key}
                      style={[styles.chip, selected && styles.chipSelected]}
                      onPress={() => setBillType(type.key)}
                      activeOpacity={0.84}
                    >
                      <Text style={[styles.chipTitle, selected && styles.chipTitleSelected]}>{type.label}</Text>
                      <Text style={[styles.chipMeta, selected && styles.chipMetaSelected]}>{type.description}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Ödeyen Kişi</Text>
              <View style={styles.memberWrap}>
                {members.map((member) => {
                  const selected = Number(member.userId) === Number(responsibleUserId);
                  return (
                    <TouchableOpacity
                      key={member.userId}
                      style={[styles.memberChip, selected && styles.memberChipSelected]}
                      onPress={() => setResponsibleUserId(member.userId)}
                      activeOpacity={0.84}
                    >
                      <Text style={[styles.memberText, selected && styles.memberTextSelected]}>{member.fullName}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <TouchableOpacity style={[styles.submitButton, loading && styles.submitButtonDisabled]} onPress={handleSubmit} disabled={loading} activeOpacity={0.9}>
              {loading ? (
                <ActivityIndicator size="small" color={theme.colors.text.onPrimary} />
              ) : (
                <Text style={styles.submitText}>{editingMode ? 'Faturayı Güncelle' : 'Faturayı Kaydet'}</Text>
              )}
            </TouchableOpacity>
          </ScrollView>

          <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={hideToast} />
        </Animated.View>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

function makeStyles(theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    gradient: { flex: 1 },
    content: { flex: 1 },
    scroll: { flex: 1 },
    scrollContent: { padding: 18, paddingBottom: 36 },
    hero: {
      backgroundColor: theme.colors.primary[600],
      borderRadius: 24,
      padding: 22,
      marginBottom: 16,
    },
    heroBadge: {
      alignSelf: 'flex-start',
      backgroundColor: 'rgba(255,255,255,0.18)',
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 5,
      marginBottom: 12,
    },
    heroBadgeText: {
      color: theme.colors.text.onPrimary,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.7,
    },
    heroTitle: {
      fontSize: 28,
      fontWeight: '800',
      color: theme.colors.text.onPrimary,
      marginBottom: 6,
    },
    heroSubtitle: {
      fontSize: 14,
      color: theme.colors.text.onPrimary,
      opacity: 0.92,
    },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: 20,
      padding: 18,
      borderWidth: 1,
      borderColor: theme.colors.neutral[200],
      marginBottom: 14,
    },
    sectionTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: theme.colors.text.primary,
      marginBottom: 14,
    },
    inputGroup: { marginBottom: 14 },
    row: { flexDirection: 'row', gap: 12 },
    half: { flex: 1 },
    label: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.colors.text.primary,
      marginBottom: 8,
    },
    input: {
      backgroundColor: theme.colors.background,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.neutral[300],
      color: theme.colors.text.primary,
      fontSize: 16,
      paddingHorizontal: 14,
      paddingVertical: 13,
    },
    textArea: {
      minHeight: 92,
      textAlignVertical: 'top',
    },
    readonlyBox: {
      backgroundColor: theme.colors.neutral[50],
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.neutral[200],
      paddingHorizontal: 14,
      paddingVertical: 13,
    },
    readonlyText: {
      color: theme.colors.text.secondary,
      fontSize: 15,
      fontWeight: '700',
    },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    chip: {
      width: '48%',
      minWidth: 148,
      backgroundColor: theme.colors.neutral[50],
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.neutral[200],
      padding: 14,
    },
    chipSelected: {
      backgroundColor: theme.colors.primary[50],
      borderColor: theme.colors.primary[500],
    },
    chipTitle: {
      color: theme.colors.text.primary,
      fontSize: 15,
      fontWeight: '800',
      marginBottom: 4,
    },
    chipTitleSelected: {
      color: theme.colors.primary[700],
    },
    chipMeta: {
      color: theme.colors.text.secondary,
      fontSize: 12,
      lineHeight: 17,
    },
    chipMetaSelected: {
      color: theme.colors.primary[700],
    },
    memberWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    memberChip: {
      backgroundColor: theme.colors.neutral[50],
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.neutral[200],
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    memberChipSelected: {
      backgroundColor: theme.colors.success?.[50] || theme.colors.primary[50],
      borderColor: theme.colors.success?.[500] || theme.colors.primary[500],
    },
    memberText: {
      color: theme.colors.text.primary,
      fontSize: 14,
      fontWeight: '700',
    },
    memberTextSelected: {
      color: theme.colors.text.primary,
    },
    submitButton: {
      backgroundColor: theme.colors.success?.[600] || '#16a34a',
      borderRadius: 16,
      paddingVertical: 18,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
    },
    submitButtonDisabled: {
      opacity: 0.7,
    },
    submitText: {
      color: theme.colors.text.onPrimary,
      fontSize: 17,
      fontWeight: '800',
    },
  });
}
