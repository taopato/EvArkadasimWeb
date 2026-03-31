import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { getCategoryDisplayName, toExpenseCategory } from '../constants/ExpenseEnums';
import { houseApi, expensesApi } from '../services/api';
import eventBus from '../shared/events/bus';
import { useTheme } from '../shared/theme/ThemeProvider';
import { useCommonStyles } from '../shared/ui/CommonStyles';

const formatThousandsTRInput = (text) => {
  if (text == null) return '';
  const digits = String(text).replace(/\D/g, '');
  if (!digits) return '';
  const intStr = digits.replace(/^0+(?=\d)/, '');
  return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

const parseIntFromTR = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  return digits ? Number(digits) : 0;
};

export default function DuzenliGiderEkle({ navigation, route }) {
  const { user } = useAuth();
  const CommonStyles = useCommonStyles();
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const isCompact = width < 520;
  const styles = useMemo(() => makeStyles(theme, isCompact), [theme, isCompact]);

  const activeHouseId = Number(route?.params?.houseId || user?.defaultHouseId || 0);
  const activeHouseName = route?.params?.houseName || user?.defaultHouseName || 'Aktif Ev';

  const [members, setMembers] = useState([]);
  const [mode, setMode] = useState(route?.params?.defaultMode || 'recurring');
  const [type, setType] = useState('Rent');
  const [payerUserId, setPayerUserId] = useState('');
  const [fixedAmount, setFixedAmount] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [installmentCount, setInstallmentCount] = useState('12');
  const [participants, setParticipants] = useState([]);
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), Math.min(now.getDate(), 28));
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempMonthOffset, setTempMonthOffset] = useState(() => new Date().getMonth());
  const [tempDay, setTempDay] = useState(() => String(Math.min(new Date().getDate(), 28)));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!activeHouseId) {
      Alert.alert('Hata', 'Aktif bir ev grubu bulunamadi.');
      navigation.navigate('GrupListesi');
      return;
    }

    (async () => {
      try {
        const res = await houseApi.getMembers(activeHouseId);
        const raw = Array.isArray(res?.data) ? res.data : Array.isArray(res?.data?.data) ? res.data.data : [];
        const arr = raw.map((item) => ({
          userId: item.userId ?? item.UserId,
          fullName: item.fullName ?? item.FullName ?? item.name ?? 'Bilinmeyen',
        }));
        setMembers(arr);
        const me = arr.find((item) => String(item.userId) === String(user?.id));
        if (me) setPayerUserId(String(me.userId));
      } catch {
        setMembers([]);
      }
    })();
  }, [activeHouseId, navigation, user?.id]);

  useEffect(() => {
    setTempMonthOffset(selectedDate.getMonth());
    setTempDay(String(Math.min(selectedDate.getDate(), 28)));
  }, [selectedDate]);

  const selectedMonthLabel = useMemo(() => {
    const now = new Date();
    const monthDate = new Date(now.getFullYear(), tempMonthOffset, 1);
    return monthDate.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
  }, [tempMonthOffset]);

  const applySelectedDate = () => {
    const now = new Date();
    const monthDate = new Date(now.getFullYear(), tempMonthOffset, 1);
    const safeDay = Math.min(28, Math.max(1, Number(tempDay) || 1));
    const nextDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), safeDay);
    setSelectedDate(nextDate);
    setTempDay(String(safeDay));
    setShowDatePicker(false);
  };

  const onSave = async () => {
    if (saving) return;
    try {
      setSaving(true);

      if (!payerUserId) {
        Alert.alert('Hata', 'Odeyecek kisiyi secin.');
        return;
      }

      const dueDayNum = Number(selectedDate.getDate());
      if (!(dueDayNum >= 1 && dueDayNum <= 28)) {
        Alert.alert('Hata', 'Lutfen 1-28 arasinda bir gun secin.');
        return;
      }

      const startMonth = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}`;
      const isoStart = `${startMonth}-01T00:00:00Z`;
      const safeTur = getCategoryDisplayName(type);
      const categoryEnum = toExpenseCategory(type);
      const descriptionSafe = `${safeTur} | Baslangic ${selectedDate.toLocaleDateString('tr-TR')}`;
      const creatorId = Number(user?.id ?? user?.userId ?? payerUserId ?? 0);
      const safeCreatorId = creatorId > 0 ? creatorId : Number(payerUserId);

      if (mode === 'installment') {
        const total = parseIntFromTR(totalAmount);
        if (!(total > 0)) {
          Alert.alert('Hata', 'Toplam tutar sifirdan buyuk olmalidir.');
          return;
        }

        await expensesApi.create({
          mode: 'installment',
          tur: safeTur,
          category: categoryEnum,
          categoryId: categoryEnum,
          CategoryId: categoryEnum,
          tutar: total,
          installmentCount: Number(installmentCount),
          dueDay: dueDayNum,
          startMonth: isoStart,
          houseId: activeHouseId,
          odeyenUserId: Number(payerUserId),
          kaydedenUserId: safeCreatorId,
          cardholderUserId: Number(payerUserId),
          participants: participants.length ? participants.map((id) => Number(id)) : [],
          description: descriptionSafe,
          Description: descriptionSafe,
          Aciklama: descriptionSafe,
        });
      } else if (mode === 'recurring') {
        const monthly = parseIntFromTR(fixedAmount);
        if (!(monthly > 0)) {
          Alert.alert('Hata', 'Aylik tutar sifirdan buyuk olmalidir.');
          return;
        }

        await expensesApi.create({
          mode: 'recurring',
          tur: safeTur,
          category: categoryEnum,
          categoryId: categoryEnum,
          CategoryId: categoryEnum,
          tutar: monthly,
          houseId: activeHouseId,
          odeyenUserId: Number(payerUserId),
          kaydedenUserId: safeCreatorId,
          dueDay: dueDayNum,
          startMonth: isoStart,
          ortakHarcamaTutari: monthly,
          sahsiHarcamalar: [],
          description: descriptionSafe,
          Description: descriptionSafe,
          Aciklama: descriptionSafe,
        });
      } else {
        const once = parseIntFromTR(fixedAmount);
        if (!(once > 0)) {
          Alert.alert('Hata', 'Tutar sifirdan buyuk olmalidir.');
          return;
        }

        await expensesApi.create({
          tur: safeTur,
          category: categoryEnum,
          categoryId: categoryEnum,
          CategoryId: categoryEnum,
          tutar: once,
          houseId: activeHouseId,
          odeyenUserId: Number(payerUserId),
          kaydedenUserId: safeCreatorId,
          date: selectedDate.toISOString(),
          ortakHarcamaTutari: once,
          sahsiHarcamalar: [],
          description: descriptionSafe,
          Description: descriptionSafe,
          Aciklama: descriptionSafe,
        });
      }

      eventBus.emit('expenses:updated', { houseId: activeHouseId });
      if (mode === 'recurring' || mode === 'installment') {
        eventBus.emit('expenses:created:recurring', { houseId: activeHouseId });
        navigation.replace('BillsOverviewScreen', {
          houseId: activeHouseId,
          houseName: activeHouseName,
        });
      } else {
        navigation.goBack();
      }
    } catch (error) {
      Alert.alert('Hata', error?.response?.data?.message || error?.message || 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  const Chip = ({ active, title, onPress }) => (
    <TouchableOpacity style={[styles.chip, active && styles.chipActive]} onPress={onPress} activeOpacity={0.88}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{title}</Text>
    </TouchableOpacity>
  );

  return (
    <KeyboardAvoidingView
      style={CommonStyles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
    >
      <ScrollView
        style={CommonStyles.content}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <View style={CommonStyles.header}>
          <Text style={CommonStyles.title}>Odeme Plani</Text>
          <Text style={CommonStyles.subtitle}>{activeHouseName} icin sade ve net bir gider plani olustur.</Text>
        </View>

        <View style={CommonStyles.card}>
          <Text style={styles.sectionTitle}>Plan tipi</Text>
          <View style={styles.rowWrap}>
            <Chip title="Duzenli" active={mode === 'recurring'} onPress={() => setMode('recurring')} />
            <Chip title="Taksitli" active={mode === 'installment'} onPress={() => setMode('installment')} />
            <Chip title="Tek seferlik" active={mode === 'irregular'} onPress={() => setMode('irregular')} />
          </View>

          <Text style={styles.sectionTitle}>Kategori</Text>
          <View style={styles.rowWrap}>
            {[
              ['Rent', 'Kira'],
              ['Internet', 'Internet'],
              ['Electricity', 'Elektrik'],
              ['Water', 'Su'],
              ['Gas', 'Dogalgaz'],
              ['Other', 'Diger'],
            ].map(([key, label]) => (
              <Chip key={key} title={label} active={type === key} onPress={() => setType(key)} />
            ))}
          </View>

          <Text style={styles.sectionTitle}>Odeyecek kisi</Text>
          <View style={styles.rowWrap}>
            {members.map((member) => (
              <Chip
                key={String(member.userId)}
                title={member.fullName}
                active={String(payerUserId) === String(member.userId)}
                onPress={() => setPayerUserId(String(member.userId))}
              />
            ))}
          </View>

          {(mode === 'recurring' || mode === 'irregular') && (
            <>
              <Text style={CommonStyles.label}>{mode === 'recurring' ? 'Aylik tutar (TL)' : 'Tutar (TL)'}</Text>
              <TextInput
                style={styles.input}
                value={fixedAmount}
                onChangeText={(text) => setFixedAmount(formatThousandsTRInput(text))}
                keyboardType="numeric"
                placeholder="20.000"
                placeholderTextColor={theme.colors.text.disabled}
              />
            </>
          )}

          {mode === 'installment' && (
            <>
              <Text style={CommonStyles.label}>Toplam tutar (TL)</Text>
              <TextInput
                style={styles.input}
                value={totalAmount}
                onChangeText={(text) => setTotalAmount(formatThousandsTRInput(text))}
                keyboardType="numeric"
                placeholder="120.000"
                placeholderTextColor={theme.colors.text.disabled}
              />
            </>
          )}

          {mode !== 'irregular' && (
            <>
              <Text style={CommonStyles.label}>Sure</Text>
              <View style={styles.rowWrap}>
                {['3', '6', '12'].map((count) => (
                  <Chip key={count} title={`${count} Ay`} active={installmentCount === count} onPress={() => setInstallmentCount(count)} />
                ))}
              </View>
            </>
          )}

          <Text style={CommonStyles.label}>{mode === 'irregular' ? 'Tarih sec' : 'Baslangic tarihi ve odeme gunu'}</Text>
          <TouchableOpacity style={styles.dateButton} onPress={() => setShowDatePicker(true)} activeOpacity={0.88}>
            <Text style={styles.dateButtonText}>
              {selectedDate.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })}
            </Text>
            <Text style={styles.dateHint}>Daha kisa bir secim ac</Text>
          </TouchableOpacity>

          {mode === 'installment' && (
            <>
              <Text style={CommonStyles.label}>Katilimcilar</Text>
              <View style={styles.rowWrap}>
                {members.map((member) => {
                  const id = String(member.userId);
                  const active = participants.includes(id);
                  return (
                    <Chip
                      key={id}
                      title={member.fullName}
                      active={active}
                      onPress={() => setParticipants((prev) => (active ? prev.filter((x) => x !== id) : [...prev, id]))}
                    />
                  );
                })}
              </View>
            </>
          )}

          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={onSave}
            activeOpacity={0.9}
            disabled={saving}
          >
            {saving ? <ActivityIndicator color={theme.colors.text.onPrimary} /> : <Text style={styles.saveButtonText}>Plani Kaydet</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={showDatePicker} transparent animationType="slide" onRequestClose={() => setShowDatePicker(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <ScrollView contentContainerStyle={styles.modalScrollContent} showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>Tarih sec</Text>
              <Text style={styles.modalPreview}>
                {selectedDate.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })}
              </Text>

              <Text style={styles.modalLabel}>Ay</Text>
              <View style={styles.monthSelector}>
                <TouchableOpacity
                  style={styles.monthNavBtn}
                  onPress={() => setTempMonthOffset((prev) => Math.max(0, prev - 1))}
                  disabled={tempMonthOffset <= 0}
                >
                  <Text style={[styles.monthNavText, tempMonthOffset <= 0 && styles.monthNavTextDisabled]}>{'<'}</Text>
                </TouchableOpacity>
                <View style={styles.monthPill}>
                  <Text style={styles.monthPillText}>{selectedMonthLabel}</Text>
                </View>
                <TouchableOpacity
                  style={styles.monthNavBtn}
                  onPress={() => setTempMonthOffset((prev) => Math.min(11, prev + 1))}
                  disabled={tempMonthOffset >= 11}
                >
                  <Text style={[styles.monthNavText, tempMonthOffset >= 11 && styles.monthNavTextDisabled]}>{'>'}</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.modalLabel}>Gun</Text>
              <TextInput
                style={styles.dayInput}
                value={tempDay}
                onChangeText={(value) => {
                  const digits = value.replace(/\D/g, '');
                  if (!digits) {
                    setTempDay('');
                    return;
                  }
                  const safeDay = Math.min(28, Math.max(1, Number(digits)));
                  setTempDay(String(safeDay));
                }}
                keyboardType="numeric"
                placeholder="1-28"
                placeholderTextColor={theme.colors.text.disabled}
                maxLength={2}
              />
              <Text style={styles.dayHint}>Her ay icin 1 ile 28 arasinda bir gun sec.</Text>

              <View style={styles.quickDaysRow}>
                {[1, 5, 10, 15, 20, 25, 28].map((day) => (
                  <TouchableOpacity
                    key={String(day)}
                    style={[styles.quickDayChip, String(day) === tempDay && styles.quickDayChipActive]}
                    onPress={() => setTempDay(String(day))}
                  >
                    <Text style={[styles.quickDayText, String(day) === tempDay && styles.quickDayTextActive]}>{day}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => setShowDatePicker(false)}>
                  <Text style={styles.secondaryBtnText}>Iptal</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.primaryBtn} onPress={applySelectedDate}>
                  <Text style={styles.primaryBtnText}>Sec</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (theme, isCompact) =>
  StyleSheet.create({
    scrollContent: {
      paddingBottom: 160,
      flexGrow: 1,
    },
    modalScrollContent: {
      paddingBottom: 12,
    },
    sectionTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: theme.colors.text.primary,
      marginBottom: 10,
    },
    rowWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginBottom: 8,
    },
    chip: {
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 999,
      backgroundColor: theme.colors.neutral[100],
      marginRight: 8,
      marginBottom: 8,
    },
    chipActive: {
      backgroundColor: theme.colors.primary[600],
    },
    chipText: {
      color: theme.colors.text.primary,
      fontWeight: '700',
    },
    chipTextActive: {
      color: theme.colors.text.onPrimary,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.colors.neutral[200],
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: theme.colors.text.primary,
      marginBottom: 12,
      fontSize: 16,
      backgroundColor: theme.colors.surface,
    },
    dateButton: {
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: theme.colors.neutral[200],
      backgroundColor: theme.colors.surface,
      marginBottom: 14,
    },
    dateButtonText: {
      color: theme.colors.text.primary,
      fontSize: 16,
      fontWeight: '800',
    },
    dateHint: {
      color: theme.colors.text.secondary,
      marginTop: 4,
      fontSize: 13,
    },
    saveButton: {
      marginTop: 6,
      backgroundColor: theme.colors.primary[600],
      borderRadius: 16,
      paddingVertical: 15,
      alignItems: 'center',
    },
    saveButtonDisabled: {
      opacity: 0.75,
    },
    saveButtonText: {
      color: theme.colors.text.onPrimary,
      fontWeight: '900',
      fontSize: 16,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.35)',
      justifyContent: 'flex-end',
    },
    modalCard: {
      backgroundColor: theme.colors.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 18,
      maxHeight: isCompact ? '62%' : '72%',
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '900',
      color: theme.colors.text.primary,
      marginBottom: 8,
    },
    modalPreview: {
      color: theme.colors.primary[700],
      fontWeight: '800',
      marginBottom: 12,
      fontSize: 16,
    },
    modalLabel: {
      fontSize: 14,
      fontWeight: '800',
      color: theme.colors.text.secondary,
      marginBottom: 8,
      marginTop: 6,
    },
    monthSelector: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 14,
      gap: 10,
    },
    monthNavBtn: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: theme.colors.neutral[100],
      alignItems: 'center',
      justifyContent: 'center',
    },
    monthNavText: {
      color: theme.colors.text.primary,
      fontWeight: '900',
      fontSize: 22,
      lineHeight: 22,
    },
    monthNavTextDisabled: {
      color: theme.colors.text.disabled,
    },
    monthPill: {
      flex: 1,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.neutral[200],
      backgroundColor: theme.colors.surface,
      paddingHorizontal: 14,
      paddingVertical: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    monthPillText: {
      color: theme.colors.text.primary,
      fontWeight: '800',
      fontSize: isCompact ? 14 : 15,
      textTransform: 'capitalize',
    },
    dayInput: {
      borderWidth: 1,
      borderColor: theme.colors.neutral[200],
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      color: theme.colors.text.primary,
      backgroundColor: theme.colors.surface,
      marginBottom: 8,
    },
    dayHint: {
      color: theme.colors.text.secondary,
      fontSize: 13,
      lineHeight: 18,
      marginBottom: 12,
    },
    quickDaysRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 12,
    },
    quickDayChip: {
      minWidth: 46,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: theme.colors.neutral[100],
      alignItems: 'center',
    },
    quickDayChipActive: {
      backgroundColor: theme.colors.primary[600],
    },
    quickDayText: {
      color: theme.colors.text.primary,
      fontWeight: '800',
    },
    quickDayTextActive: {
      color: theme.colors.text.onPrimary,
    },
    modalActions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 4,
    },
    secondaryBtn: {
      flex: 1,
      marginRight: 8,
      borderWidth: 1,
      borderColor: theme.colors.neutral[200],
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
    },
    secondaryBtnText: {
      color: theme.colors.text.primary,
      fontWeight: '800',
    },
    primaryBtn: {
      flex: 1,
      marginLeft: 8,
      backgroundColor: theme.colors.primary[600],
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: 'center',
    },
    primaryBtnText: {
      color: theme.colors.text.onPrimary,
      fontWeight: '800',
    },
  });
