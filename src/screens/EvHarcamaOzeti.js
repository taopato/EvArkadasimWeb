import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { expensesApi, houseApi } from '../services/api';
import { makeColorThemes, useCommonStyles } from '../shared/ui/CommonStyles';
import { useTheme } from '../shared/theme/ThemeProvider';
import { formatAmount, formatDate, getCategoryDisplayName, getCategoryIcon } from '../constants/ExpenseEnums';
import { getCategoryColorUI } from '../constants/ExpenseUI';

const HouseSpendingOverviewScreen = ({ navigation, route }) => {
  const { houseId, houseName } = route.params || {};
  const { user } = useAuth();
  const CommonStyles = useCommonStyles();
  const { theme } = useTheme();
  const ColorThemes = makeColorThemes(theme);
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [members, setMembers] = useState([]);
  const [expenses, setExpenses] = useState([]);

  useEffect(() => {
    if (!houseId) {
      Alert.alert('Hata', 'Ev bilgisi eksik.');
      navigation.goBack();
      return;
    }

    fetchOverview();
  }, [houseId]);

  const fetchOverview = async () => {
    setLoading(true);

    try {
      const currentMonth = new Date().toISOString().slice(0, 7);
      const [membersRes, expensesRes] = await Promise.all([
        houseApi.getMembers(houseId),
        expensesApi.getExpenses(houseId, currentMonth),
      ]);

      const membersData = Array.isArray(membersRes?.data) ? membersRes.data : [];
      const expensePayload = expensesRes?.data?.data ?? expensesRes?.data ?? [];
      const expensesData = Array.isArray(expensePayload) ? expensePayload : [];

      setMembers(membersData);
      setExpenses(expensesData);

      const totalExpenses = expensesData.reduce((sum, expense) => sum + Number(expense?.tutar || 0), 0);
      setOverview({
        totalSpending: totalExpenses,
        memberCount: membersData.length,
      });
    } catch (error) {
      Alert.alert(
        'Hata',
        'Harcama özeti alınırken bir sorun oluştu: ' + (error?.response?.data?.message || error?.message || 'Bilinmeyen hata')
      );
    } finally {
      setLoading(false);
    }
  };

  const categories = useMemo(() => {
    const totals = new Map();

    expenses.forEach((expense) => {
      const category = expense.category || 'Other';
      const displayName = getCategoryDisplayName(category);
      const current = totals.get(displayName) || { total: 0, count: 0 };
      current.total += Number(expense?.tutar || 0);
      current.count += 1;
      totals.set(displayName, current);
    });

    return Array.from(totals.entries())
      .map(([name, data]) => ({
        name,
        total: data.total,
        count: data.count,
      }))
      .sort((a, b) => b.total - a.total);
  }, [expenses]);

  if (loading) {
    return (
      <View style={CommonStyles.container}>
        <View style={CommonStyles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary[500]} />
          <Text style={CommonStyles.loadingText}>Harcama özeti yükleniyor...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={CommonStyles.container}>
      <ScrollView
        style={CommonStyles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={CommonStyles.header}>
          <Text style={CommonStyles.title}>Harcama Özeti</Text>
          <Text style={CommonStyles.subtitle}>{houseName || user?.defaultHouseName || 'Ev'} için genel görünüm</Text>
        </View>

        <View style={CommonStyles.card}>
          <Text style={styles.sectionTitle}>Genel Durum</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{formatAmount(overview?.totalSpending || 0)}</Text>
              <Text style={styles.statLabel}>Toplam Harcama</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{overview?.memberCount || 0}</Text>
              <Text style={styles.statLabel}>Aktif Üye</Text>
            </View>
          </View>
        </View>

        {categories.length > 0 && (
          <View style={CommonStyles.card}>
            <Text style={styles.sectionTitle}>Kategori Dağılımı</Text>
            <View style={styles.categoryList}>
              {categories.map((category) => (
                <View key={category.name} style={styles.categoryRow}>
                  <Text style={styles.categoryName}>{category.name}</Text>
                  <Text style={styles.categoryMeta}>
                    {category.count} kayıt • {formatAmount(category.total)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {expenses.length > 0 && (
          <View style={CommonStyles.card}>
            <Text style={styles.sectionTitle}>Son Hareketler</Text>
            <View style={CommonStyles.listContainer}>
              {expenses
                .slice()
                .sort((a, b) => new Date(b.postDate || b.createdAt || b.kayitTarihi || 0) - new Date(a.postDate || a.createdAt || a.kayitTarihi || 0))
                .map((expense, index) => {
                  const category = expense.category || expense.tur || 'Other';
                  const color = getCategoryColorUI(category) || theme.colors.primary[500];
                  const displayName = getCategoryDisplayName(category);
                  const displayDate = expense.postDate || expense.createdAt || expense.kayitTarihi;
                  const spender = expense.odeyenKullaniciAdi || expense.odeyenUser?.fullName || 'Bilinmeyen';

                  return (
                    <View key={String(expense.id ?? index)} style={CommonStyles.listItem}>
                      <View style={[styles.expenseIcon, { backgroundColor: `${color}20` }]}>
                        <Text style={styles.expenseIconText}>{getCategoryIcon(category)}</Text>
                      </View>
                      <View style={CommonStyles.listItemContent}>
                        <Text style={CommonStyles.listItemTitle}>{displayName}</Text>
                        <Text style={CommonStyles.listItemSubtitle}>
                          {spender} • {formatDate(displayDate)}
                        </Text>
                      </View>
                      <Text style={[styles.amountText, { color }]}>{formatAmount(expense.tutar)}</Text>
                    </View>
                  );
                })}
            </View>
          </View>
        )}

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={CommonStyles.menuButton}
            onPress={() => navigation.navigate('HarcamaEkle', { houseId, houseName })}
            activeOpacity={0.85}
          >
            <View style={[CommonStyles.buttonContent, { backgroundColor: ColorThemes.success.background }]}>
              <Text style={CommonStyles.buttonIcon}>+</Text>
              <Text style={CommonStyles.buttonText}>Harcama Ekle</Text>
              <Text style={CommonStyles.buttonSubtext}>Yeni harcama kaydı oluştur</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={CommonStyles.menuButton}
            onPress={() => navigation.navigate('HarcamaListesi', { houseId, houseName })}
            activeOpacity={0.85}
          >
            <View style={[CommonStyles.buttonContent, { backgroundColor: ColorThemes.primary.background }]}>
              <Text style={CommonStyles.buttonIcon}>≡</Text>
              <Text style={CommonStyles.buttonText}>Tüm Harcamalar</Text>
              <Text style={CommonStyles.buttonSubtext}>Detaylı listeyi görüntüle</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

export default HouseSpendingOverviewScreen;

function makeStyles(theme) {
  return StyleSheet.create({
    scrollContent: {
      paddingBottom: 32,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.colors.text.primary,
      marginBottom: 14,
    },
    statsGrid: {
      flexDirection: 'row',
      gap: 12,
    },
    statItem: {
      flex: 1,
      alignItems: 'center',
      padding: 16,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.primary[200],
      backgroundColor: theme.colors.primary[50],
    },
    statValue: {
      fontSize: 24,
      fontWeight: '800',
      color: theme.colors.primary[700],
      marginBottom: 4,
    },
    statLabel: {
      fontSize: 13,
      color: theme.colors.text.secondary,
      textAlign: 'center',
    },
    categoryList: {
      gap: 10,
    },
    categoryRow: {
      padding: 12,
      borderRadius: 12,
      backgroundColor: theme.colors.surfaceVariant || theme.colors.neutral[50],
      borderWidth: 1,
      borderColor: theme.colors.neutral[200],
    },
    categoryName: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.colors.text.primary,
      marginBottom: 2,
    },
    categoryMeta: {
      fontSize: 13,
      color: theme.colors.text.secondary,
    },
    expenseIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    expenseIconText: {
      fontSize: 18,
    },
    amountText: {
      fontSize: 15,
      fontWeight: '700',
    },
    actionButtons: {
      gap: 12,
    },
  });
}
