import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, ActivityIndicator } from 'react-native';
import { useTheme } from '../shared/theme/ThemeProvider';
import { useAuth } from '../context/AuthContext';
import { HeroHeader } from '../shared/ui/premium/HeroHeader';
import { WeekStrip } from '../shared/ui/premium/WeekStrip';
import { expensesApi, houseApi, houseNotesApi, paymentsApi } from '../services/api';
import { normalizeExpense } from '../utils/expenseClassifier';
import BrandMark from '../components/BrandMark';
import {
  deduplicateMonthlyPlans,
  getExpenseDisplayTitle,
  getItemDate,
  getSortDate,
  isFutureExpense,
  sortByDateDesc,
} from '../utils/expenseHelpers';

const HomeScreen = ({ navigation }) => {
  const { user, logout, setDefaultHouseId } = useAuth();
  const { theme } = useTheme();
  const [billModalVisible, setBillModalVisible] = useState(false);
  const [weeklyTotal, setWeeklyTotal] = useState(0);
  const [selectedDayKey, setSelectedDayKey] = useState(() => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  const [loadingWeekly, setLoadingWeekly] = useState(false);
  const [dashboardStats, setDashboardStats] = useState({ payable: 0, receivable: 0, pendingCount: 0, debtPeople: 0 });
  const [recentExpenses, setRecentExpenses] = useState([]);
  const [notePreview, setNotePreview] = useState([]);

  const styles = useMemo(() => makeStyles(theme), [theme]);
  const activeHouseId = user?.defaultHouseId ? Number(user.defaultHouseId) : null;
  const activeHouseName = user?.defaultHouseName || 'Aktif Ev';
  const hasDefaultHouse = Boolean(activeHouseId);

  useEffect(() => {
    const ensureDefaultHouse = async () => {
      if (!user?.id || user?.defaultHouseId) {
        return;
      }

      try {
        const response = await houseApi.getUserHouses(Number(user.id));
        const houses = Array.isArray(response?.data) ? response.data : [];
        if (houses.length > 0) {
          await setDefaultHouseId(houses[0].id, houses[0].name);
        }
      } catch {
        // Ana sayfayi bloklamamak icin burada sessiz kaliyoruz.
      }
    };

    ensureDefaultHouse();
  }, [user?.id, user?.defaultHouseId, setDefaultHouseId]);

  const pastelKeys = ['blue', 'green', 'purple', 'orange', 'pink'];
  const formatCurrency = (amount) =>
    new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(amount || 0));

  const NavButton = ({ title, subtitle, onPress, emoji, idx = 0, wide = false }) => (
    <TouchableOpacity
      style={[
        styles.btnCard,
        wide ? styles.gridItemFull : styles.gridItem,
        { backgroundColor: theme.colors.pastel[pastelKeys[idx % pastelKeys.length]].bg },
      ]}
      onPress={onPress}
      activeOpacity={0.88}
    >
      <View style={styles.btnCardInner}>
        <Text style={styles.btnIcon}>{emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.btnText, { color: theme.colors.pastel[pastelKeys[idx % pastelKeys.length]].fg }]} numberOfLines={1}>
            {title}
          </Text>
          {!!subtitle && (
            <Text
              style={[
                styles.btnSubSmall,
                { color: theme.colors.pastel[pastelKeys[idx % pastelKeys.length]].fg, opacity: 0.88 },
              ]}
              numberOfLines={2}
            >
              {subtitle}
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  const navigateToHouseScreen = (screenName, extraParams = {}, options = {}) => {
    if (activeHouseId) {
      navigation.navigate(screenName, {
        houseId: activeHouseId,
        houseName: activeHouseName,
        ...extraParams,
      });
      return;
    }

    if (options.redirectTo) {
      navigation.navigate('GrupListesi', { redirectTo: options.redirectTo });
      return;
    }

    navigation.navigate('GrupListesi');
  };

  useEffect(() => {
    const loadWeekly = async () => {
      if (!user?.defaultHouseId) {
        setWeeklyTotal(0);
        setRecentExpenses([]);
        return;
      }

      setLoadingWeekly(true);
      try {
        const res = await expensesApi.getByHouse(user.defaultHouseId);
        const data = res?.data?.data ?? res?.data ?? [];
        const normalized = Array.isArray(data) ? data.map(normalizeExpense) : [];
        const list = sortByDateDesc(deduplicateMonthlyPlans(normalized));
        const now = new Date();
        const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
        const day = monday.getUTCDay();
        const diff = (day + 6) % 7;
        monday.setUTCDate(monday.getUTCDate() - diff);
        const sunday = new Date(monday);
        sunday.setUTCDate(monday.getUTCDate() + 7);

        const sum = list.reduce((total, item) => {
          const date = getItemDate(item);
          return date >= monday && date < sunday ? total + Number(item.amount || 0) : total;
        }, 0);

        setWeeklyTotal(sum);
        const positiveItems = list.filter((item) => Number(item.amount || 0) > 0);
        const nonFutureItems = positiveItems.filter((item) => !isFutureExpense(item));
        setRecentExpenses((nonFutureItems.length > 0 ? nonFutureItems : positiveItems).slice(0, 5));
      } catch {
        setWeeklyTotal(0);
        setRecentExpenses([]);
      } finally {
        setLoadingWeekly(false);
      }
    };

    loadWeekly();
  }, [user?.defaultHouseId]);

  useEffect(() => {
    const loadDashboard = async () => {
      if (!activeHouseId || !user?.id) {
        setDashboardStats({ payable: 0, receivable: 0, pendingCount: 0, debtPeople: 0 });
        return;
      }

      try {
        const [debtRes, pendingRes] = await Promise.all([
          houseApi.getUserDebts(Number(user.id), activeHouseId),
          paymentsApi.getPendingPayments(Number(user.id)),
        ]);

        const debtBody = debtRes?.data?.data ?? debtRes?.data ?? {};
        const totals = Array.isArray(debtBody.totals) ? debtBody.totals : [];
        const myTotals = totals.find((t) => Number(t.userId) === Number(user.id)) || {};
        const pairs = Array.isArray(debtBody.pairs) ? debtBody.pairs : [];
        const debtPeople = pairs.filter((p) => Number(p.fromUserId) === Number(user.id) && Number(p.netAmount) > 0).length;
        const pendingArr = pendingRes?.data?.data ?? pendingRes?.data ?? [];

        setDashboardStats({
          payable: Number(myTotals.payable) || 0,
          receivable: Number(myTotals.receivable) || 0,
          pendingCount: Array.isArray(pendingArr) ? pendingArr.length : 0,
          debtPeople,
        });
      } catch {
        setDashboardStats({ payable: 0, receivable: 0, pendingCount: 0, debtPeople: 0 });
      }
    };

    loadDashboard();
  }, [activeHouseId, user?.id]);

  useEffect(() => {
    const loadNotes = async () => {
      if (!activeHouseId) {
        setNotePreview([]);
        return;
      }

      try {
        const response = await houseNotesApi.getBoard(activeHouseId);
        const sections = Array.isArray(response?.data?.sections) ? response.data.sections : [];
        const nextPreview = sections
          .flatMap((section) =>
            (Array.isArray(section?.items) ? section.items : []).map((item) => ({
              ...item,
              sectionTitle: section.title,
            }))
          )
          .slice(0, 5);
        setNotePreview(nextPreview);
      } catch {
        setNotePreview([]);
      }
    };

    loadNotes();
  }, [activeHouseId]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {dashboardStats.pendingCount > 0 && (
          <TouchableOpacity 
            style={styles.notificationCard} 
            activeOpacity={0.88}
            onPress={() => navigation.navigate('BekleyenOdemeler', { userId: user?.id })}
          >
            <View style={styles.notificationIconWrap}>
              <Text style={styles.notificationIconText}>💸</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.notificationTitle}>Onay Bekleyen Ödemeniz Var</Text>
              <Text style={styles.notificationDesc}>
                {dashboardStats.pendingCount} adet ödeme işlemini onaylamanız veya reddetmeniz gerekiyor.
              </Text>
            </View>
            <Text style={styles.notificationArrow}>›</Text>
          </TouchableOpacity>
        )}

        <HeroHeader
          title="Haftalık ev harcaması"
          subtitle={`Merhaba, ${user?.fullName || 'Kullanıcı'}`}
          amount={loadingWeekly ? 'Hesaplanıyor...' : formatCurrency(weeklyTotal)}
          primaryLabel={hasDefaultHouse ? '+ Gider Ekle' : 'Ev Seç'}
          onPrimaryAction={() => (hasDefaultHouse ? setBillModalVisible(true) : navigation.navigate('GrupListesi'))}
          showBrand
        />

        <WeekStrip selectedKey={selectedDayKey || undefined} onSelect={(key) => setSelectedDayKey(key)} />

        {hasDefaultHouse && (
          <View style={styles.summarySection}>
            <View style={styles.brandStrip}>
              <BrandMark variant="logo" size={82} subtle />
              <Text style={styles.brandStripText}>Ev Arkadaşım özeti</Text>
            </View>
            <View style={styles.todayCard}>
              <Text style={styles.todayEyebrow}>BUGÜN İÇİN ÖZET</Text>
              <Text style={styles.todayTitle}>{activeHouseName}</Text>
              <View style={styles.todayGrid}>
                <View style={styles.todayBox}>
                  <Text style={styles.todayLabel}>Borç</Text>
                  <Text style={styles.todayValue}>{formatCurrency(dashboardStats.payable)}</Text>
                </View>
                <View style={styles.todayBox}>
                  <Text style={styles.todayLabel}>Alacak</Text>
                  <Text style={styles.todayValue}>{formatCurrency(dashboardStats.receivable)}</Text>
                </View>
                <View style={styles.todayBox}>
                  <Text style={styles.todayLabel}>Bekleyen Ödeme</Text>
                  <Text style={styles.todayValue}>{dashboardStats.pendingCount}</Text>
                </View>
                <View style={styles.todayBox}>
                  <Text style={styles.todayLabel}>Borçlu olduğun kişi</Text>
                  <Text style={styles.todayValue}>{dashboardStats.debtPeople}</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {hasDefaultHouse && recentExpenses.length > 0 && (
          <View style={styles.recentCard}>
            <View style={styles.recentHeader}>
              <Text style={styles.recentTitle}>Son hareketler</Text>
              <TouchableOpacity activeOpacity={0.88} onPress={() => navigateToHouseScreen('TumHarcamalar', {}, { redirectTo: 'TumHarcamalar' })}>
                <Text style={styles.recentLink}>Tümünü gör</Text>
              </TouchableOpacity>
            </View>
            {recentExpenses.map((item, index) => (
              <View key={`${item.id || index}`} style={styles.recentRow}>
                <View style={styles.recentMain}>
                  <Text style={styles.recentItemTitle} numberOfLines={1}>
                    {getExpenseDisplayTitle(item) || 'Harcama'}
                  </Text>
                  <Text style={styles.recentItemSub} numberOfLines={1}>
                    {getSortDate(item).toLocaleDateString('tr-TR')}
                  </Text>
                </View>
                <Text style={styles.recentAmount}>{formatCurrency(item.amount)}</Text>
              </View>
            ))}
          </View>
        )}

        {!hasDefaultHouse && (
          <View style={styles.noticeCard}>
            <Text style={styles.noticeTitle}>Bir ev grubu seçerek başlayın</Text>
            <Text style={styles.noticeText}>
              Harcamalar, ödemeler ve borç özeti için önce aktif bir ev belirlememiz gerekiyor.
            </Text>
            <TouchableOpacity
              style={styles.noticeButton}
              activeOpacity={0.88}
              onPress={() => navigation.navigate('GrupListesi')}
            >
              <Text style={styles.noticeButtonText}>Evlerimi Aç</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Hızlı işlemler</Text>
            {loadingWeekly && <ActivityIndicator size="small" color={theme.colors.primary[600]} />}
          </View>

          <View style={styles.grid}>
            <NavButton
              title="Evlerim"
              subtitle="Üye olduğum ev grupları"
              emoji="🏘️"
              onPress={() => navigation.navigate('GrupListesi')}
              wide
            />
            <NavButton
              title="Faturalar"
              subtitle="Kira, internet, abonelikler"
              emoji="🧾"
              idx={0}
              onPress={() => navigateToHouseScreen('BillsOverviewScreen', {}, { redirectTo: 'BillsOverviewScreen' })}
            />
            <NavButton
              title="Harcamalar"
              subtitle="Serbest gider hareketleri"
              emoji="📋"
              idx={1}
              onPress={() => navigateToHouseScreen('TumHarcamalar', {}, { redirectTo: 'TumHarcamalar' })}
            />
            <NavButton
              title="Ev Notları"
              subtitle="Ortak market ve ev listeleri"
              emoji="📝"
              idx={2}
              onPress={() => navigateToHouseScreen('EvNotlari', {}, { redirectTo: 'EvNotlari' })}
            />
            <NavButton
              title="Ödemeler"
              subtitle="Gönderilen ve alınanlar"
              emoji="💳"
              idx={3}
              onPress={() => navigation.navigate('Odemeler')}
            />
            <NavButton
              title="Borç Özeti"
              subtitle="Net bakiyeleri gör"
              emoji="💰"
              idx={4}
              onPress={() => navigateToHouseScreen('DebtSummaryScreen', {}, { redirectTo: 'DebtSummaryScreen' })}
            />
            <NavButton
              title="Bekleyenler"
              subtitle="Onay bekleyen işlemler"
              emoji="⏳"
              idx={5}
              onPress={() => navigation.navigate('BekleyenOdemeler', { userId: user?.id })}
            />
            <NavButton
              title="Ayarlar"
              subtitle="Tema ve hesap seçenekleri"
              emoji="⚙️"
              idx={6}
              onPress={() => navigation.navigate('Ayarlar')}
            />
            <NavButton
              title="Davet Et"
              subtitle="Yeni ev arkadaşı çağır"
              emoji="📨"
              idx={7}
              onPress={() => navigateToHouseScreen('DavetEt')}
            />
            <NavButton
              title="Analitik"
              subtitle="Özetler ve dağılımlar"
              emoji="📊"
              idx={8}
              onPress={() => navigateToHouseScreen('HarcamaOzeti', {}, { redirectTo: 'HarcamaOzeti' })}
            />
          </View>
        </View>

        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={async () => {
            await logout();
          }}
          activeOpacity={0.88}
        >
          <Text style={styles.logoutText}>Çıkış Yap</Text>
        </TouchableOpacity>

        <Modal visible={billModalVisible} transparent animationType="slide" onRequestClose={() => setBillModalVisible(false)}>
          <View style={styles.sheetBackdrop}>
            <View style={styles.sheet}>
              <View style={styles.sheetHandle} />
              <Text style={styles.modalTitle}>Yeni harcama akışı</Text>
              <Text style={styles.modalSub}>Düzenli gider veya tek seferlik harcama ekleyebilirsin.</Text>
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.primaryModalBtn}
                  activeOpacity={0.88}
                  onPress={() => {
                    setBillModalVisible(false);
                    navigateToHouseScreen('DuzenliGiderEkle', { defaultMode: 'recurring' }, { redirectTo: 'DuzenliGiderEkle' });
                  }}
                >
                  <Text style={styles.primaryModalBtnText}>Düzenli Gider</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.secondaryModalBtn}
                  activeOpacity={0.88}
                  onPress={() => {
                    setBillModalVisible(false);
                    navigateToHouseScreen('HarcamaEkle', {}, { redirectTo: 'HarcamaEkle' });
                  }}
                >
                  <Text style={styles.secondaryModalBtnText}>Tekil Harcama</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.cancelModalBtn} activeOpacity={0.88} onPress={() => setBillModalVisible(false)}>
                  <Text style={styles.cancelModalBtnText}>İptal</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </View>
  );
};

const makeStyles = (theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    scrollContent: { paddingBottom: 24 },
    notificationCard: {
      marginHorizontal: 16,
      marginTop: 16,
      backgroundColor: theme.colors.warning[50],
      borderWidth: 1,
      borderColor: theme.colors.warning[200],
      borderRadius: 20,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    notificationIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: theme.colors.warning[100],
      justifyContent: 'center',
      alignItems: 'center',
    },
    notificationIconText: { fontSize: 20 },
    notificationTitle: { color: theme.colors.warning[800], fontWeight: '800', fontSize: 15, marginBottom: 2 },
    notificationDesc: { color: theme.colors.warning[700], fontSize: 13, lineHeight: 18, opacity: 0.9 },
    notificationArrow: { color: theme.colors.warning[400], fontSize: 24, fontWeight: '700' },
    section: { paddingHorizontal: 16, paddingTop: 14 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    sectionTitle: { color: theme.colors.text.secondary, fontSize: 14, fontWeight: '700' },
    grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    gridItem: { width: '48%', marginBottom: 12 },
    gridItemFull: { width: '100%', marginBottom: 12 },
    btnCard: {
      borderRadius: 18,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: theme.colors.neutral[200],
    },
    btnCardInner: {
      minHeight: 96,
      paddingHorizontal: 14,
      paddingVertical: 14,
      flexDirection: 'row',
      alignItems: 'center',
    },
    btnIcon: { fontSize: 24, marginRight: 10 },
    btnText: { fontWeight: '800', fontSize: 15 },
    btnSubSmall: { marginTop: 4, fontSize: 12, lineHeight: 16 },
    noticeCard: {
      marginHorizontal: 16,
      marginTop: 16,
      borderRadius: 20,
      padding: 18,
      backgroundColor: theme.colors.primary[50],
      borderWidth: 1,
      borderColor: theme.colors.primary[200],
    },
    noticeTitle: { color: theme.colors.primary[800], fontSize: 17, fontWeight: '800', marginBottom: 6 },
    noticeText: { color: theme.colors.text.secondary, fontSize: 14, lineHeight: 20 },
    noticeButton: {
      alignSelf: 'flex-start',
      marginTop: 14,
      backgroundColor: theme.colors.primary[600],
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    noticeButtonText: { color: theme.colors.text.onPrimary, fontWeight: '700' },
    summarySection: {
      marginHorizontal: 16,
      marginTop: 16,
    },
    brandStrip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 16,
      backgroundColor: theme.colors.primary[50],
      borderWidth: 1,
      borderColor: theme.colors.primary[100],
      marginBottom: 10,
    },
    brandStripText: {
      color: theme.colors.primary[700],
      fontSize: 12,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    todayCard: {
      borderRadius: 22,
      padding: 18,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.neutral[200],
    },
    todayEyebrow: {
      color: theme.colors.primary[700],
      fontSize: 12,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 4,
    },
    todayTitle: { color: theme.colors.text.primary, fontSize: 18, fontWeight: '900', marginBottom: 12 },
    todayGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10 },
    todayBox: {
      width: '48%',
      borderRadius: 16,
      padding: 12,
      backgroundColor: theme.colors.primary[50],
      borderWidth: 1,
      borderColor: theme.colors.primary[100],
    },
    todayLabel: { color: theme.colors.text.secondary, fontSize: 12, marginBottom: 6, lineHeight: 16 },
    todayValue: { color: theme.colors.text.primary, fontWeight: '800', fontSize: 15 },
    recentCard: {
      marginHorizontal: 16,
      marginTop: 16,
      borderRadius: 22,
      padding: 18,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.neutral[200],
    },
    recentHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    recentTitle: { color: theme.colors.text.primary, fontSize: 17, fontWeight: '900' },
    recentLink: { color: theme.colors.primary[600], fontWeight: '800' },
    recentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 10,
      borderTopWidth: 1,
      borderTopColor: theme.colors.neutral[100],
    },
    recentMain: { flex: 1, paddingRight: 10 },
    recentItemTitle: { color: theme.colors.text.primary, fontWeight: '700', marginBottom: 3 },
    recentItemSub: { color: theme.colors.text.secondary, fontSize: 12 },
    recentAmount: { color: theme.colors.text.primary, fontWeight: '800' },
    logoutBtn: {
      marginHorizontal: 16,
      marginTop: 8,
      borderRadius: 16,
      paddingVertical: 14,
      alignItems: 'center',
      backgroundColor: theme.colors.error[600],
    },
    logoutText: { color: theme.colors.text.onPrimary, fontSize: 15, fontWeight: '800' },
    sheetBackdrop: { flex: 1, backgroundColor: 'rgba(3, 7, 18, 0.45)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 18,
    },
    sheetHandle: {
      alignSelf: 'center',
      width: 44,
      height: 5,
      backgroundColor: theme.colors.neutral[300],
      borderRadius: 999,
      marginBottom: 12,
    },
    modalTitle: { color: theme.colors.text.primary, fontSize: 19, fontWeight: '800' },
    modalSub: { color: theme.colors.text.secondary, marginTop: 6, lineHeight: 20 },
    modalActions: { gap: 12, marginTop: 16 },
    primaryModalBtn: {
      backgroundColor: theme.colors.primary[600],
      borderRadius: 14,
      paddingVertical: 13,
      alignItems: 'center',
    },
    primaryModalBtnText: { color: theme.colors.text.onPrimary, fontWeight: '800' },
    secondaryModalBtn: {
      backgroundColor: theme.colors.success[600],
      borderRadius: 14,
      paddingVertical: 13,
      alignItems: 'center',
    },
    secondaryModalBtnText: { color: theme.colors.text.onPrimary, fontWeight: '800' },
    cancelModalBtn: {
      backgroundColor: theme.colors.neutral[100],
      borderRadius: 14,
      paddingVertical: 13,
      alignItems: 'center',
    },
    cancelModalBtnText: { color: theme.colors.text.primary, fontWeight: '700' },
  });

export default HomeScreen;


