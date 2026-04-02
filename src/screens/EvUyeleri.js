import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Toast from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import useScrollRestore from '../hooks/useScrollRestore';
import { expensesApi, houseApi } from '../services/api';
import { useTheme } from '../shared/theme/ThemeProvider';
import { useCommonStyles } from '../shared/ui/CommonStyles';

const MenuBtn = ({ icon, title, sub, onPress, color }) => (
  <TouchableOpacity style={[styles.menuBtn, { backgroundColor: color }]} onPress={onPress}>
    <Text style={styles.menuIcon}>{icon}</Text>
    <Text style={styles.menuTitle}>{title}</Text>
    <Text style={styles.menuSub}>{sub}</Text>
  </TouchableOpacity>
);

export default function HouseMembersScreen({ route, navigation }) {
  const { houseId, houseName } = route.params || {};
  const { user, updateUser } = useAuth();
  const { listRef, handleScroll } = useScrollRestore(`HouseMembersScreen:${houseId ?? 'all'}`);
  const { theme } = useTheme();
  const CommonStyles = useCommonStyles();

  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });
  const [memberCount, setMemberCount] = useState(0);
  const [monthlyBillsTotal, setMonthlyBillsTotal] = useState(0);
  const [netBalance, setNetBalance] = useState(0);
  const [creatorUserId, setCreatorUserId] = useState(null);
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);

  const dynamicStyles = useMemo(() => makeDynamicStyles(theme), [theme]);

  const showToast = (message, type = 'success') => {
    setToast({ visible: true, message, type });
  };

  const hideToast = () => {
    setToast((prev) => ({ ...prev, visible: false }));
  };

  const fetchHouseDetail = async () => {
    try {
      const res = await houseApi.getById(houseId);
      const data = res?.data?.data || res?.data;
      if (data?.creatorUserId) {
        setCreatorUserId(data.creatorUserId);
      }
    } catch (err) {
      console.error('Ev detayi yuklenemedi:', err);
    }
  };

  const fetchKPIData = async () => {
    try {
      const membersResponse = await houseApi.getMembers(houseId);
      const members = membersResponse.data || [];
      setMemberCount(members.length);

      const expensesResponse = await expensesApi.getByHouse(houseId);
      const expenses = expensesResponse.data?.data || expensesResponse.data || [];

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      const monthlyBills = expenses.filter((expense) => {
        const expenseDate = new Date(expense.kayitTarihi || expense.postDate || expense.date || expense.createdDate);
        const isChild = expense.parentExpenseId || expense.ParentExpenseId;
        return isChild && expenseDate >= monthStart && expenseDate < monthEnd && expenseDate <= now;
      });

      const billsTotal = monthlyBills.reduce((sum, bill) => sum + (Number(bill.tutar) || Number(bill.amount) || 0), 0);
      setMonthlyBillsTotal(billsTotal);

      if (user?.id) {
        const debtResponse = await houseApi.getUserDebts(user.id, houseId);
        const debtData = debtResponse.data?.data || debtResponse.data || {};
        if (debtData.totals && Array.isArray(debtData.totals)) {
          const myTotal = debtData.totals.find((t) => Number(t.userId) === Number(user.id));
          setNetBalance(Number(myTotal?.net) || 0);
        } else {
          setNetBalance(Number(debtData.netDurum) || 0);
        }
      }
    } catch (error) {
      console.error('KPI verileri yuklenirken hata:', error);
    }
  };

  const fetchMembers = async () => {
    try {
      const membersResponse = await houseApi.getMembers(houseId);
      if (membersResponse.data && Array.isArray(membersResponse.data)) {
        const members = membersResponse.data;
        const membersWithDebts = await Promise.all(
          members.map(async (member) => {
            try {
              const userId = member.userId || member.id;
              const debtResponse = await houseApi.getUserDebts(userId, houseId);
              const debtData = debtResponse.data;
              const balance = Number(debtData.netBalance || debtData.netDurum || 0);
              return {
                id: userId,
                fullName: member.name || member.fullName || 'Isimsiz Kullanici',
                email: member.email,
                balance,
              };
            } catch {
              return {
                id: member.userId || member.id,
                fullName: member.name || member.fullName || 'Isimsiz Kullanici',
                email: member.email,
                balance: 0,
              };
            }
          })
        );
        setFriends(membersWithDebts);
      }
    } catch (error) {
      console.error('Uyeler yuklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!houseId) {
      showToast('Gecerli bir ev ID bulunamadi', 'error');
      navigation.goBack();
      return;
    }

    fetchKPIData();
    fetchMembers();
    fetchHouseDetail();
  }, [houseId]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchKPIData();
      fetchMembers();
    });
    return unsubscribe;
  }, [navigation, houseId]);

  const handleRemoveMember = (memberId, memberName) => {
    const isRemovingSelf = Number(user?.id) === Number(memberId);
    const title = isRemovingSelf ? 'Evden Ayril' : 'Uyeyi Cikar';
    const message = isRemovingSelf
      ? 'Bu ev grubundan ayrilmak istediginizden emin misiniz?'
      : `${memberName} isimli uyeyi evden cikarmak istediginizden emin misiniz?`;

    Alert.alert(title, message, [
      { text: 'Iptal', style: 'cancel' },
      {
        text: isRemovingSelf ? 'Ayril' : 'Cikar',
        style: 'destructive',
        onPress: async () => {
          try {
            await houseApi.removeMember(houseId, memberId);
            showToast(isRemovingSelf ? 'Evden ayrildiniz' : 'Uye cikarildi', 'success');
            if (isRemovingSelf) {
              // Varsayılan ev bu ev ise temizle
              if (Number(user?.defaultHouseId) === Number(houseId)) {
                await updateUser((prev) => ({
                  ...(prev || {}),
                  defaultHouseId: null,
                  defaultHouseName: null,
                }));
              }
              navigation.navigate('Home');
            } else {
              fetchMembers();
              fetchKPIData();
            }
          } catch (error) {
            showToast(error?.response?.data?.message || 'Islem basarisiz', 'error');
          }
        },
      },
    ]);
  };

  const handleSendInvitation = async () => {
    if (!inviteEmail.trim()) {
      showToast('Lutfen e-posta adresi girin', 'error');
      return;
    }

    try {
      setInviting(true);
      await houseApi.sendInvitation(houseId, inviteEmail.trim());
      showToast('Davet basariyla gonderildi', 'success');
      setInviteModalVisible(false);
      setInviteEmail('');
    } catch (error) {
      showToast(error?.response?.data?.message || 'Davet gonderilemedi', 'error');
    } finally {
      setInviting(false);
    }
  };

  if (loading) {
    return (
      <View style={[CommonStyles.container, { backgroundColor: theme.colors.background }]}>
        <View style={CommonStyles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary?.[500]} />
          <Text style={[CommonStyles.loadingText, { color: theme.colors.text.secondary }]}>Yukleniyor...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[CommonStyles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        style={CommonStyles.content}
        contentContainerStyle={styles.scrollContent}
        ref={listRef}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={CommonStyles.header}>
          <Text style={[CommonStyles.title, { color: theme.colors.text.primary }]}>{houseName || 'Ev'}</Text>
        </View>

        <View style={styles.kpiRow}>
          <View style={[styles.kpiCard, { backgroundColor: theme.colors.surface }]}>
            <Text style={styles.kpiLabel}>Uye</Text>
            <Text style={styles.kpiValue}>{memberCount}</Text>
          </View>
          <View style={[styles.kpiCard, { backgroundColor: theme.colors.surface }]}>
            <Text style={styles.kpiLabel}>Bu Ay</Text>
            <Text style={styles.kpiValue}>{monthlyBillsTotal.toFixed(0)} TL</Text>
          </View>
          <View style={[styles.kpiCard, { backgroundColor: theme.colors.surface }]}>
            <Text style={styles.kpiLabel}>Denge</Text>
            <Text
              style={[
                styles.kpiValue,
                { color: netBalance >= 0 ? theme.colors.success?.[600] : theme.colors.error?.[600] },
              ]}
            >
              {netBalance.toFixed(0)} TL
            </Text>
          </View>
        </View>

        <View style={[CommonStyles.card, { marginTop: 20 }]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Ev Arkadaslari</Text>
            <TouchableOpacity style={styles.addBtn} onPress={() => setInviteModalVisible(true)}>
              <Text style={styles.addBtnText}>+ Davet</Text>
            </TouchableOpacity>
          </View>

          {friends.map((item) => {
            const isCurrentUser = user && Number(user.id) === Number(item.id);
            const balanceColor =
              item.balance > 0
                ? theme.colors.success?.[600]
                : item.balance < 0
                  ? theme.colors.error?.[600]
                  : theme.colors.text.secondary;

            return (
              <View key={item.id} style={styles.memberItem}>
                <View style={[styles.avatar, { backgroundColor: theme.colors.primary?.[500] }]}>
                  <Text style={styles.avatarText}>{item.fullName.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.memberBody}>
                  <Text style={styles.memberName}>
                    {item.fullName} {isCurrentUser ? '(Siz)' : ''}
                  </Text>
                  <Text style={styles.memberEmail}>{item.email}</Text>
                </View>
                <View style={styles.memberRight}>
                  <Text style={[styles.memberBalance, { color: balanceColor }]}>
                    {item.balance !== 0 ? `${item.balance.toFixed(0)} TL` : 'Notr'}
                  </Text>
                  {Number(user?.id) === Number(creatorUserId) && !isCurrentUser ? (
                    <TouchableOpacity onPress={() => handleRemoveMember(item.id, item.fullName)} style={styles.removeBtn}>
                      <Text style={styles.removeBtnText}>Cikar</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.menuGrid}>
          <MenuBtn
            icon="F"
            title="Faturalar"
            sub="Bu ay"
            onPress={() => navigation.navigate('BillsOverviewScreen', { houseId, houseName })}
            color={theme.colors.info?.[50]}
          />
          <MenuBtn
            icon="H"
            title="Harcamalar"
            sub="Tumu"
            onPress={() => navigation.navigate('TumHarcamalar', { houseId, houseName })}
            color={theme.colors.success?.[50]}
          />
          <MenuBtn
            icon="B"
            title="Bekleyen"
            sub="Onaylar"
            onPress={() => navigation.navigate('BekleyenOdemeler', { houseId, houseName })}
            color={theme.colors.warning?.[50]}
          />
          <MenuBtn
            icon="N"
            title="Bakiye"
            sub="Net durum"
            onPress={() => navigation.navigate('DebtSummaryScreen', { houseId, houseName })}
            color={theme.colors.error?.[50]}
          />
        </View>

        <TouchableOpacity style={styles.leaveBtn} onPress={() => handleRemoveMember(user?.id, 'Kendim')}>
          <Text style={styles.leaveBtnText}>Evden Ayril</Text>
        </TouchableOpacity>
      </ScrollView>

      <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={hideToast} />

      <Modal visible={inviteModalVisible} transparent animationType="fade" onRequestClose={() => setInviteModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
            <Text style={styles.modalTitle}>Davet Et</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="E-posta adresi"
              placeholderTextColor="#9aa3b2"
              value={inviteEmail}
              onChangeText={setInviteEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={[styles.mBtn, { backgroundColor: theme.colors.neutral?.[200] }]}
                onPress={() => setInviteModalVisible(false)}
              >
                <Text>Iptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.mBtn, { backgroundColor: theme.colors.primary?.[600] }]}
                onPress={handleSendInvitation}
                disabled={inviting}
              >
                <Text style={dynamicStyles.primaryText}>{inviting ? 'Gonderiliyor' : 'Gonder'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: 40 },
  kpiRow: { flexDirection: 'row', gap: 10 },
  kpiCard: { flex: 1, padding: 12, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#eee' },
  kpiLabel: { fontSize: 12, opacity: 0.6 },
  kpiValue: { fontSize: 16, fontWeight: 'bold' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold' },
  addBtn: { backgroundColor: '#007AFF', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8 },
  addBtnText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  memberItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  avatar: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { color: '#fff', fontWeight: 'bold' },
  memberBody: { flex: 1 },
  memberName: { fontWeight: 'bold' },
  memberEmail: { fontSize: 12, opacity: 0.5 },
  memberRight: { alignItems: 'flex-end' },
  memberBalance: { fontWeight: 'bold' },
  removeBtn: { marginTop: 6, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, backgroundColor: '#ffe8e6' },
  removeBtnText: { color: '#d94841', fontSize: 12, fontWeight: '700' },
  menuGrid: { marginTop: 20, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  menuBtn: { flex: 1, minWidth: '45%', padding: 15, borderRadius: 15, alignItems: 'center' },
  menuIcon: { fontSize: 24, marginBottom: 4 },
  menuTitle: { fontWeight: 'bold' },
  menuSub: { fontSize: 10, opacity: 0.6 },
  leaveBtn: { marginTop: 30, padding: 15, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ff3b30', alignItems: 'center' },
  leaveBtnText: { color: '#ff3b30', fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { padding: 20, borderRadius: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  modalInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, marginBottom: 20, fontSize: 16 },
  modalButtonRow: { flexDirection: 'row', gap: 10 },
  mBtn: { flex: 1, padding: 12, borderRadius: 10, alignItems: 'center' },
});

const makeDynamicStyles = (theme) =>
  StyleSheet.create({
    primaryText: { color: theme.colors.text.onPrimary, fontWeight: '700' },
  });
