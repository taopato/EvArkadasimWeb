// Harcama Özeti — "analitik & denge" ekranı
// Seçilen dönem için kümülatif bakış: kim ne kadar harcadı, kategoriler, trendler, net denge

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  Dimensions,
  useWindowDimensions
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { expensesApi, houseApi } from '../services/api';
import { useTheme } from '../shared/theme/ThemeProvider';
import { useCommonStyles } from '../shared/ui/CommonStyles';
import { normalizeExpense } from '../utils/expenseClassifier';
import { getCategoryDisplayName, getCategoryIcon, getCategoryColor } from '../constants/ExpenseEnums';
import { HeroHeader } from '../shared/ui/premium/HeroHeader';
import {
  getUTCMonthWindow,
  formatCurrency,
  formatDate,
  getItemDate,
  getItemNote,
  getPlanType,
  isChildExpense,
  isParentExpense,
  deduplicateMonthlyPlans,
  sortByDateDesc,
  calculateTotals
} from '../utils/expenseHelpers';

const { width } = Dimensions.get('window');

const HarcamaOzetiScreen = ({ navigation, route }) => {
  const { user } = useAuth();
  const { houseId: routeHouseId } = route.params || {};
  const houseId = routeHouseId || user?.defaultHouseId;
  const CommonStyles = useCommonStyles();
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const isCompact = width < 520;
  const styles = useMemo(() => makeStyles(theme, isCompact), [theme, isCompact]);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState([]);
  const [membersMap, setMembersMap] = useState({});

  // Filtreler
  const [selectedPeriod, setSelectedPeriod] = useState('current');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [includePlans, setIncludePlans] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  // Dönem seçenekleri
  const periodOptions = [
    { key: 'current', label: 'Bu Ay' },
    { key: 'last3', label: 'Son 3 Ay' },
    { key: 'last6', label: 'Son 6 Ay' },
    { key: 'year', label: 'Bu Yıl' },
    { key: 'all', label: 'Tümü' }
  ];

  // Kategori seçenekleri
  const categoryOptions = [
    { key: 'Rent', label: 'Kira', icon: '🏠' },
    { key: 'Internet', label: 'İnternet', icon: '🌐' },
    { key: 'Electricity', label: 'Elektrik', icon: '⚡' },
    { key: 'Water', label: 'Su', icon: '💧' },
    { key: 'Gas', label: 'Doğalgaz', icon: '🔥' },
    { key: 'Market', label: 'Market', icon: '🛒' },
    { key: 'Food', label: 'Yemek', icon: '🍽️' },
    { key: 'Other', label: 'Diğer', icon: '📄' }
  ];

  const billCategoryKeys = categoryOptions
    .map((option) => option.key)
    .filter((key) => ['Rent', 'Internet', 'Electricity', 'Water', 'Gas'].includes(key));
  const hasBillQuickFilter =
    selectedCategories.length === billCategoryKeys.length &&
    billCategoryKeys.every((key) => selectedCategories.includes(key));
  const hasMineQuickFilter = selectedMembers.length === 1 && selectedMembers.includes(String(user?.id));
  const hasIrregularQuickFilter = !includePlans;

  // Veri yükleme
  const loadData = async () => {
    if (!houseId) return;
    
    setLoading(true);
    try {
      // Harcamalar
      const res = await expensesApi.getByHouse(houseId);
      const data = res?.data?.data ?? res?.data ?? [];
      const list = Array.isArray(data) ? data.map(normalizeExpense) : [];

      // Deduplikasyon: Ayda plan başına tek çocuk
      const deduplicated = deduplicateMonthlyPlans(list);

      // Sıralama
      const sorted = sortByDateDesc(deduplicated);

      setItems(sorted);

      // Üyeler
      const membersRes = await houseApi.getMembers(houseId);
      const membersData = membersRes?.data?.data ?? membersRes?.data ?? [];
      const membersList = Array.isArray(membersData) ? membersData : [];
      
      setMembers(membersList);
      
      // Üye map'i oluştur
      const map = {};
      membersList.forEach(member => {
        map[member.userId ?? member.UserId] = member.fullName ?? member.FullName ?? 'Bilinmeyen';
      });
      setMembersMap(map);

    } catch (error) {
      console.error('❌ Harcama özeti yükleme hatası:', error);
      Alert.alert('Hata', 'Veriler yüklenirken bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [houseId]);

  // Dönem filtresi
  const getDateRange = () => {
    const now = new Date();
    
    switch (selectedPeriod) {
      case 'current':
        return getUTCMonthWindow(now);
      case 'last3':
        const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        return { monthStart: threeMonthsAgo, monthEnd: now };
      case 'last6':
        const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
        return { monthStart: sixMonthsAgo, monthEnd: now };
      case 'year':
        const yearStart = new Date(now.getFullYear(), 0, 1);
        const yearEnd = new Date(now.getFullYear() + 1, 0, 1);
        return { monthStart: yearStart, monthEnd: yearEnd };
      default:
        return null; // Tümü
    }
  };

  // Filtrelenmiş veriler
  const filteredItems = useMemo(() => {
    let filtered = items;

    // Dönem filtresi
    const dateRange = getDateRange();
    if (dateRange) {
      filtered = filtered.filter(item => {
        const date = getItemDate(item);
        return date >= dateRange.monthStart && date < dateRange.monthEnd;
      });
    }

    // Kategori filtresi
    if (selectedCategories.length > 0) {
      filtered = filtered.filter(item => selectedCategories.includes(item.key));
    }

    // Üye filtresi
    if (selectedMembers.length > 0) {
      filtered = filtered.filter(item => {
        const raw = item._raw || {};
        const payerId = raw.odeyenUserId ?? raw.OdeyenUserId;
        return selectedMembers.includes(String(payerId));
      });
    }

    // Plan türü filtresi
    if (!includePlans) {
      filtered = filtered.filter(item => getPlanType(item) === 'irregular');
    }

    return filtered;
  }, [items, selectedPeriod, selectedCategories, selectedMembers, includePlans]);

  // KPI Hesaplamaları
  const kpis = useMemo(() => {
    const { total, count } = calculateTotals(filteredItems);
    const participantCount = members.length;
    const averagePerPerson = participantCount > 0 ? total / participantCount : 0;
    
    // Kullanıcı bazlı hesaplamalar
    const userExpenses = filteredItems.filter(item => {
      const raw = item._raw || {};
      const payerId = raw.odeyenUserId ?? raw.OdeyenUserId;
      return String(payerId) === String(user?.id);
    });
    const userTotal = calculateTotals(userExpenses).total;

    // En büyük kalem
    const largestItem = filteredItems.reduce((max, item) => 
      item.amount > max.amount ? item : max, 
      { amount: 0, key: 'Other' }
    );

    return {
      total,
      count,
      averagePerPerson,
      userTotal,
      largestItem,
      participantCount
    };
  }, [filteredItems, members.length, user?.id]);

  // Kategori dağılımı
  const categoryBreakdown = useMemo(() => {
    const breakdown = {};
    
    filteredItems.forEach(item => {
      const category = item.key;
      if (!breakdown[category]) {
        breakdown[category] = { total: 0, count: 0 };
      }
      breakdown[category].total += item.amount;
      breakdown[category].count += 1;
    });

    return Object.entries(breakdown)
      .map(([key, data]) => ({
        key,
        label: getCategoryDisplayName(key),
        icon: getCategoryIcon(key),
        color: getCategoryColor(key),
        ...data
      }))
      .sort((a, b) => b.total - a.total);
  }, [filteredItems]);

  // Kişi bazlı özet
  const memberBreakdown = useMemo(() => {
    const breakdown = {};
    
    filteredItems.forEach(item => {
      const raw = item._raw || {};
      const payerId = raw.odeyenUserId ?? raw.OdeyenUserId;
      const payerName = membersMap[payerId] || `Kullanıcı ${payerId}`;
      
      if (!breakdown[payerId]) {
        breakdown[payerId] = {
          name: payerName,
          paid: 0,
          count: 0
        };
      }
      breakdown[payerId].paid += item.amount;
      breakdown[payerId].count += 1;
    });

    return Object.entries(breakdown)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.paid - a.paid);
  }, [filteredItems, membersMap]);

  // KPI Kartları Render
  const renderKPICards = () => (
    <View style={styles.kpiContainer}>
      <View style={styles.kpiCard}>
        <Text style={styles.kpiLabel}>Toplam Gider</Text>
        <Text style={styles.kpiValue}>{formatCurrency(kpis.total)}</Text>
        <Text style={styles.kpiSubtext}>{kpis.count} kalem</Text>
      </View>
      
      <View style={styles.kpiCard}>
        <Text style={styles.kpiLabel}>Kişi Başı Ortalama</Text>
        <Text style={styles.kpiValue}>{formatCurrency(kpis.averagePerPerson)}</Text>
        <Text style={styles.kpiSubtext}>{kpis.participantCount} kişi</Text>
      </View>
      
      <View style={styles.kpiCard}>
        <Text style={styles.kpiLabel}>Senin Ödediklerin</Text>
        <Text style={styles.kpiValue}>{formatCurrency(kpis.userTotal)}</Text>
        <Text style={styles.kpiSubtext}>
          {filteredItems.filter(item => {
            const raw = item._raw || {};
            const payerId = raw.odeyenUserId ?? raw.OdeyenUserId;
            return String(payerId) === String(user?.id);
          }).length} kalem
        </Text>
      </View>
      
      {kpis.largestItem.amount > 0 && (
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>En Büyük Kalem</Text>
          <Text style={styles.kpiValue}>{formatCurrency(kpis.largestItem.amount)}</Text>
          <Text style={styles.kpiSubtext}>{getCategoryDisplayName(kpis.largestItem.key)}</Text>
        </View>
      )}
    </View>
  );

  // Kategori Dağılımı Render
  const renderCategoryBreakdown = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Kategori Dağılımı</Text>
      {categoryBreakdown.map((category, index) => {
        const percentage = kpis.total > 0 ? (category.total / kpis.total) * 100 : 0;
        return (
          <View key={category.key} style={styles.categoryItem}>
            <View style={styles.categoryHeader}>
              <View style={styles.categoryInfo}>
                <Text style={styles.categoryIcon}>{category.icon}</Text>
                <Text style={styles.categoryLabel}>{category.label}</Text>
              </View>
              <Text style={styles.categoryAmount}>{formatCurrency(category.total)}</Text>
            </View>
            <View style={styles.categoryBar}>
              <View 
                style={[
                  styles.categoryBarFill, 
                  { 
                    width: `${percentage}%`,
                    backgroundColor: category.color
                  }
                ]} 
              />
            </View>
            <Text style={styles.categoryStats}>
              {category.count} kalem • %{percentage.toFixed(1)}
            </Text>
          </View>
        );
      })}
    </View>
  );

  // Kişi Bazlı Özet Render
  const renderMemberBreakdown = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Kişi Bazlı Özet</Text>
      {memberBreakdown.map((member, index) => (
        <View key={member.id} style={styles.memberItem}>
          <View style={styles.memberInfo}>
            <Text style={styles.memberName}>{member.name}</Text>
            <Text style={styles.memberStats}>{member.count} kalem</Text>
          </View>
          <Text style={styles.memberAmount}>{formatCurrency(member.paid)}</Text>
        </View>
      ))}
    </View>
  );

  // Filtre Modal Render
  const renderFilterModal = () => (
    <Modal
      visible={showFilters}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Filtreler</Text>
          <TouchableOpacity onPress={() => setShowFilters(false)}>
            <Text style={styles.modalClose}>Kapat</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent}>
          {/* Dönem */}
          <View style={styles.filterSection}>
            <Text style={styles.filterSectionTitle}>Dönem</Text>
            {periodOptions.map(option => (
              <TouchableOpacity
                key={option.key}
                style={[
                  styles.filterOption,
                  selectedPeriod === option.key && styles.filterOptionActive
                ]}
                onPress={() => setSelectedPeriod(option.key)}
              >
                <Text style={[
                  styles.filterOptionText,
                  selectedPeriod === option.key && styles.filterOptionTextActive
                ]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Kategoriler */}
          <View style={styles.filterSection}>
            <Text style={styles.filterSectionTitle}>Kategoriler</Text>
            <TouchableOpacity
              style={styles.filterOption}
              onPress={() => setSelectedCategories([])}
            >
              <Text style={styles.filterOptionText}>Hepsi</Text>
            </TouchableOpacity>
            {categoryOptions.map(option => (
              <TouchableOpacity
                key={option.key}
                style={[
                  styles.filterOption,
                  selectedCategories.includes(option.key) && styles.filterOptionActive
                ]}
                onPress={() => {
                  if (selectedCategories.includes(option.key)) {
                    setSelectedCategories(prev => prev.filter(c => c !== option.key));
                  } else {
                    setSelectedCategories(prev => [...prev, option.key]);
                  }
                }}
              >
                <Text style={[
                  styles.filterOptionText,
                  selectedCategories.includes(option.key) && styles.filterOptionTextActive
                ]}>
                  {option.icon} {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Üyeler */}
          <View style={styles.filterSection}>
            <Text style={styles.filterSectionTitle}>Ödeyen Kişi</Text>
            <TouchableOpacity
              style={[styles.filterOption, selectedMembers.length === 0 && styles.filterOptionActive]}
              onPress={() => setSelectedMembers([])}
            >
              <Text style={[styles.filterOptionText, selectedMembers.length === 0 && styles.filterOptionTextActive]}>Hepsi</Text>
            </TouchableOpacity>
            {members.map((member) => {
              const memberId = String(member.userId ?? member.UserId ?? member.id);
              const memberName = member.fullName ?? member.FullName ?? member.name ?? `Kullanıcı ${memberId}`;
              const active = selectedMembers.includes(memberId);
              return (
                <TouchableOpacity
                  key={`member-${memberId}`}
                  style={[styles.filterOption, active && styles.filterOptionActive]}
                  onPress={() => {
                    if (active) {
                      setSelectedMembers((prev) => prev.filter((id) => id !== memberId));
                    } else {
                      setSelectedMembers((prev) => [...prev, memberId]);
                    }
                  }}
                >
                  <Text style={[styles.filterOptionText, active && styles.filterOptionTextActive]}>{memberName}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Plan Türü */}
          <View style={styles.filterSection}>
            <Text style={styles.filterSectionTitle}>Plan Türü</Text>
            <TouchableOpacity
              style={[
                styles.filterOption,
                includePlans && styles.filterOptionActive
              ]}
              onPress={() => setIncludePlans(!includePlans)}
            >
              <Text style={[
                styles.filterOptionText,
                includePlans && styles.filterOptionTextActive
              ]}>
                Düzenli/Taksitli Planları Dahil Et
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.filterActions}>
            <TouchableOpacity
              style={styles.resetFiltersButton}
              onPress={() => {
                setSelectedPeriod('current');
                setSelectedCategories([]);
                setSelectedMembers([]);
                setIncludePlans(true);
              }}
            >
              <Text style={styles.resetFiltersText}>Filtreleri Sıfırla</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );

  

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary?.[500]} />
        <Text style={styles.loadingText}>Harcama özeti yükleniyor...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <HeroHeader
        title="Harcama Özeti"
        subtitle={`${selectedPeriod === 'current' ? 'Bu ay' : 'Seçili dönem'} • ${kpis.count} kalem`}
        amount={formatCurrency(kpis.total)}
        primaryLabel="Filtreler"
        onPrimaryAction={() => setShowFilters(true)}
      />

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.primaryActionButton}
          onPress={() => setShowFilters(true)}
          activeOpacity={0.9}
        >
          <Text style={styles.primaryActionText}>+ Filtreleri Aç</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryActionButton}
          onPress={() => {
            setSelectedPeriod('current');
            setSelectedCategories([]);
            setSelectedMembers([]);
            setIncludePlans(true);
          }}
          activeOpacity={0.85}
        >
          <Text style={styles.secondaryActionText}>Temizle</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.quickFiltersWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickFilters}>
          <TouchableOpacity
            style={[styles.quickChip, selectedPeriod === 'current' && styles.quickChipActive]}
            onPress={() => setSelectedPeriod('current')}
          >
            <Text style={[styles.quickChipText, selectedPeriod === 'current' && styles.quickChipTextActive]}>Bu ay</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickChip, selectedPeriod === 'last3' && styles.quickChipActive]}
            onPress={() => setSelectedPeriod(selectedPeriod === 'last3' ? 'current' : 'last3')}
          >
            <Text style={[styles.quickChipText, selectedPeriod === 'last3' && styles.quickChipTextActive]}>Son 3 ay</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickChip, hasIrregularQuickFilter && styles.quickChipActive]}
            onPress={() => setIncludePlans(!hasIrregularQuickFilter)}
          >
            <Text style={[styles.quickChipText, hasIrregularQuickFilter && styles.quickChipTextActive]}>Düzensiz</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickChip, hasBillQuickFilter && styles.quickChipActive]}
            onPress={() => setSelectedCategories(hasBillQuickFilter ? [] : billCategoryKeys)}
          >
            <Text style={[styles.quickChipText, hasBillQuickFilter && styles.quickChipTextActive]}>Faturalar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickChip, hasMineQuickFilter && styles.quickChipActive]}
            onPress={() => setSelectedMembers(hasMineQuickFilter ? [] : [String(user?.id)])}
          >
            <Text style={[styles.quickChipText, hasMineQuickFilter && styles.quickChipTextActive]}>Ben ödedim</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* KPI Kartları */}
        {renderKPICards()}

        {/* Kategori Dağılımı */}
        {renderCategoryBreakdown()}

        {/* Kişi Bazlı Özet */}
        {renderMemberBreakdown()}
      </ScrollView>

      {/* Filtre Modal */}
      {renderFilterModal()}
    </View>
  );
};

export default HarcamaOzetiScreen;

function makeStyles(theme, isCompact) {
  const { width } = Dimensions.get('window');
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.surface },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: 16, fontSize: 16 },
    actionRow: {
      flexDirection: isCompact ? 'column' : 'row',
      gap: 10,
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 10,
      backgroundColor: theme.colors.surface,
    },
    primaryActionButton: {
      flex: 1,
      backgroundColor: theme.colors.primary[600],
      borderRadius: 16,
      paddingVertical: 14,
      paddingHorizontal: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryActionText: {
      color: theme.colors.text.onPrimary,
      fontSize: 15,
      fontWeight: '800',
    },
    secondaryActionButton: {
      minWidth: isCompact ? 0 : 108,
      paddingHorizontal: 16,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.neutral[300],
      backgroundColor: theme.colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryActionText: {
      color: theme.colors.text.primary,
      fontSize: 14,
      fontWeight: '700',
    },
    quickFiltersWrap: {
      backgroundColor: theme.colors.background,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.neutral[200],
      paddingTop: 6,
    },
    quickFilters: {
      paddingHorizontal: 16,
      paddingBottom: 10,
      gap: 8,
    },
    quickChip: {
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 999,
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.neutral[200],
      alignSelf: 'flex-start',
    },
    quickChipActive: {
      backgroundColor: theme.colors.primary[600],
      borderColor: theme.colors.primary[600],
    },
    quickChipText: {
      color: theme.colors.text.primary,
      fontWeight: '700',
    },
    quickChipTextActive: {
      color: theme.colors.text.onPrimary,
    },
    content: { flex: 1 },
    kpiContainer: { flexDirection: 'row', flexWrap: 'wrap', padding: 16, gap: 12 },
    kpiCard: {
      width: (width - 44) / 2, backgroundColor: theme.colors.background, borderRadius: 12, padding: 16, alignItems: 'center',
      borderWidth: 1, borderColor: theme.colors.neutral[200]
    },
    kpiLabel: { fontSize: 12, color: theme.colors.text.secondary, marginBottom: 4, textAlign: 'center' },
    kpiValue: { fontSize: 16, fontWeight: 'bold', color: theme.colors.text.primary, marginBottom: 2, textAlign: 'center' },
    kpiSubtext: { fontSize: 11, color: theme.colors.text.secondary, textAlign: 'center' },
    section: { backgroundColor: theme.colors.background, margin: 16, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: theme.colors.neutral[200] },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: theme.colors.text.primary, marginBottom: 16 },
    categoryItem: { marginBottom: 16 },
    categoryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    categoryInfo: { flexDirection: 'row', alignItems: 'center' },
    categoryIcon: { fontSize: 16, marginRight: 8 },
    categoryLabel: { fontSize: 14, fontWeight: '600', color: theme.colors.text.primary },
    categoryAmount: { fontSize: 14, fontWeight: 'bold', color: theme.colors.text.primary },
    categoryBar: { height: 6, backgroundColor: theme.colors.neutral[200], borderRadius: 3, marginBottom: 4 },
    categoryBarFill: { height: '100%', borderRadius: 3 },
    categoryStats: { fontSize: 12, color: theme.colors.text.secondary },
    memberItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.neutral[100] },
    memberInfo: { flex: 1 },
    memberName: { fontSize: 14, fontWeight: '600', color: theme.colors.text.primary, marginBottom: 2 },
    memberStats: { fontSize: 12, color: theme.colors.text.secondary },
    memberAmount: { fontSize: 14, fontWeight: 'bold', color: theme.colors.text.primary },
    modalContainer: { flex: 1, backgroundColor: theme.colors.surface },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: theme.colors.neutral[200] },
    modalTitle: { fontSize: 18, fontWeight: 'bold', color: theme.colors.text.primary },
    modalClose: { fontSize: 16, color: theme.colors.primary[500], fontWeight: '600' },
    modalContent: { flex: 1, padding: 16 },
    filterSection: { marginBottom: 24 },
    filterSectionTitle: { fontSize: 16, fontWeight: '600', color: theme.colors.text.primary, marginBottom: 12 },
    filterOption: { padding: 12, borderRadius: 8, marginBottom: 8, backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.neutral[200] },
    filterOptionActive: { backgroundColor: theme.colors.primary[100], borderColor: theme.colors.primary[500] },
    filterOptionText: { fontSize: 14, color: theme.colors.text.primary },
    filterOptionTextActive: { color: theme.colors.primary[700], fontWeight: '600' },
    filterActions: { marginTop: 8, marginBottom: 28 },
    resetFiltersButton: {
      backgroundColor: theme.colors.neutral[100],
      borderColor: theme.colors.neutral[300],
      borderWidth: 1,
      borderRadius: 12,
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
    },
    resetFiltersText: { color: theme.colors.text.primary, fontWeight: '700' },
  });
}
