import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../shared/theme/ThemeProvider';
import { ledgerApi, houseApi } from '../services/api';

const asData = (response) => response?.data?.data ?? response?.data ?? [];

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
    month: 'short',
    day: 'numeric',
  });
};

export default function DefterDetayi({ route }) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { houseId, houseName } = route.params || {};

  const [loading, setLoading] = useState(true);
  const [ledgerLines, setLedgerLines] = useState([]);
  const [membersMap, setMembersMap] = useState({});

  const loadData = useCallback(async () => {
    if (!houseId) return;
    setLoading(true);
    try {
      const [ledgerResponse, membersResponse] = await Promise.all([
        ledgerApi.byHouse(houseId),
        houseApi.getMembers(houseId),
      ]);

      const lines = asData(ledgerResponse);
      const members = asData(membersResponse);
      const map = {};

      (Array.isArray(members) ? members : []).forEach((member) => {
        const id = Number(member?.userId ?? member?.id ?? member?.user?.id);
        const fullName = member?.fullName ?? member?.name ?? member?.user?.fullName;
        if (Number.isFinite(id)) map[id] = fullName || `Kullanici ${id}`;
      });

      setLedgerLines(Array.isArray(lines) ? lines : []);
      setMembersMap(map);
    } catch {
      Alert.alert('Hata', 'Defter verileri yuklenemedi.');
    } finally {
      setLoading(false);
    }
  }, [houseId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const grouped = Object.values(
    ledgerLines.reduce((acc, line) => {
      const fromUserId = Number(line?.fromUserId);
      const toUserId = Number(line?.toUserId);
      const key = `${fromUserId}-${toUserId}`;
      if (!Number.isFinite(fromUserId) || !Number.isFinite(toUserId)) return acc;

      acc[key] = acc[key] || {
        fromUserId,
        toUserId,
        totalAmount: 0,
        latestDate: line?.postDate,
        count: 0,
      };

      acc[key].totalAmount += Number(line?.amount || 0);
      acc[key].count += 1;
      if (new Date(line?.postDate) > new Date(acc[key].latestDate)) {
        acc[key].latestDate = line?.postDate;
      }
      return acc;
    }, {})
  ).sort((a, b) => new Date(b.latestDate) - new Date(a.latestDate));

  if (loading) {
    return (
      <View style={styles.loaderWrap}>
        <ActivityIndicator size="large" color={theme.colors.primary[500]} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={[theme.colors.primary[500], theme.colors.primary[400]]} style={styles.hero}>
          <Text style={styles.heroBadge}>DEFTER DETAYI</Text>
          <Text style={styles.heroTitle}>Borç ve alacak akisi</Text>
          <Text style={styles.heroSubtitle}>{houseName || 'Ev grubu'}</Text>
        </LinearGradient>

        <View style={styles.summaryCard}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Toplam hareket</Text>
            <Text style={styles.summaryValue}>{ledgerLines.length}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Aktif çift</Text>
            <Text style={styles.summaryValue}>{grouped.length}</Text>
          </View>
        </View>

        {grouped.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.emptyText}>Bu ev icin henuz defter kaydi yok.</Text>
          </View>
        ) : (
          grouped.map((item) => (
            <View key={`${item.fromUserId}-${item.toUserId}`} style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.personText}>{membersMap[item.fromUserId] || `Kullanici ${item.fromUserId}`}</Text>
                <Text style={styles.arrowText}>-></Text>
                <Text style={styles.personText}>{membersMap[item.toUserId] || `Kullanici ${item.toUserId}`}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Toplam</Text>
                <Text style={styles.detailValue}>{toMoney(item.totalAmount)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Hareket</Text>
                <Text style={styles.detailValue}>{item.count}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Son tarih</Text>
                <Text style={styles.detailValue}>{formatDate(item.latestDate)}</Text>
              </View>
            </View>
          ))
        )}

        <TouchableOpacity style={styles.refreshButton} onPress={loadData} activeOpacity={0.85}>
          <Text style={styles.refreshButtonText}>Yenile</Text>
        </TouchableOpacity>
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
      paddingBottom: 36,
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
      fontSize: 26,
      fontWeight: '800',
    },
    heroSubtitle: {
      color: 'rgba(255,255,255,0.9)',
      fontSize: 15,
      fontWeight: '600',
    },
    summaryCard: {
      flexDirection: 'row',
      gap: 12,
    },
    summaryItem: {
      flex: 1,
      backgroundColor: theme.colors.surface || '#fff',
      borderRadius: 18,
      padding: 18,
      borderWidth: 1,
      borderColor: theme.colors.neutral?.[200] || '#e6edf5',
    },
    summaryLabel: {
      color: theme.colors.text.secondary,
      fontSize: 13,
      fontWeight: '700',
    },
    summaryValue: {
      color: theme.colors.text.primary,
      fontSize: 24,
      fontWeight: '800',
      marginTop: 8,
    },
    card: {
      backgroundColor: theme.colors.surface || '#fff',
      borderRadius: 20,
      padding: 18,
      borderWidth: 1,
      borderColor: theme.colors.neutral?.[200] || '#e6edf5',
      gap: 10,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 8,
    },
    personText: {
      flex: 1,
      color: theme.colors.text.primary,
      fontSize: 15,
      fontWeight: '800',
    },
    arrowText: {
      color: theme.colors.text.secondary,
      fontSize: 14,
      fontWeight: '700',
    },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 4,
    },
    detailLabel: {
      color: theme.colors.text.secondary,
      fontSize: 14,
      fontWeight: '600',
    },
    detailValue: {
      color: theme.colors.text.primary,
      fontSize: 14,
      fontWeight: '700',
    },
    emptyText: {
      color: theme.colors.text.secondary,
      fontSize: 15,
      textAlign: 'center',
    },
    refreshButton: {
      minHeight: 52,
      borderRadius: 16,
      backgroundColor: theme.colors.primary[500],
      alignItems: 'center',
      justifyContent: 'center',
    },
    refreshButtonText: {
      color: '#fff',
      fontSize: 15,
      fontWeight: '800',
    },
  });
}
