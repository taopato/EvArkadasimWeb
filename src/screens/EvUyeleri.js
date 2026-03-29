import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  Platform,
  Modal,
  TextInput
} from 'react-native';
import useScrollRestore from '../hooks/useScrollRestore';
import { useAuth } from '../context/AuthContext';
import { houseApi, expensesApi } from '../services/api';
import { useCommonStyles } from '../shared/ui/CommonStyles';
import Toast from '../components/Toast';
import { useTheme } from '../shared/theme/ThemeProvider';

const HouseMembersScreen = ({ route, navigation }) => {
  const { houseId, houseName } = route.params || {};
  const { user } = useAuth();
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

  const showToast = (message, type = 'success') => {
    setToast({ visible: true, message, type });
  };

  const hideToast = () => {
    setToast(prev => ({ ...prev, visible: false }));
  };

  useEffect(() => {
    if (!houseId) {
      showToast('Geçerli bir ev ID\'si bulunamadı', 'error');
      navigation.goBack();
      return;
    }
    
    fetchKPIData();
    fetchMembers();
    fetchHouseDetail();
  }, [houseId]);

  const fetchHouseDetail = async () => {
    try {
      const res = await houseApi.getById(houseId);
      const data = res?.data?.data || res?.data;
      if (data?.creatorUserId) {
        setCreatorUserId(data.creatorUserId);
      }
    } catch (err) {
      console.error('Ev detayı yüklenemedi:', err);
    }
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchKPIData();
      fetchMembers();
    });
    return unsubscribe;
  }, [navigation, houseId]);

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
      
      const monthlyBills = expenses.filter(expense => {
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
          const myTotal = debtData.totals.find(t => Number(t.userId) === Number(user.id));
          setNetBalance(Number(myTotal?.net) || 0);
        } else {
          setNetBalance(Number(debtData.netDurum) || 0);
        }
      }
    } catch (error) {
      console.error('KPI verileri yüklenirken hata:', error);
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
              const netBalance = debtData.netBalance || 0;
              return {
                id: userId,
                fullName: member.name || member.fullName || 'İsimsiz Kullanıcı',
                email: member.email,
                balance: netBalance
              };
            } catch {
              return {
                id: member.userId || member.id,
                fullName: member.name || member.fullName || 'İsimsiz Kullanıcı',
                email: member.email,
                balance: 0
              };
            }
          })
        );
        setFriends(membersWithDebts);
      }
    } catch (error) {
      console.error('Üyeler yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = (memberId, memberName) => {
    const isRemovingSelf = user?.id === memberId;
    const title = isRemovingSelf ? 'Evden Ayrıl' : 'Üyeyi Çıkar';
    const message = isRemovingSelf 
      ? 'Bu ev grubundan ayrılmak istediğinizden emin misiniz?' 
      : `${memberName} isimli üyeyi evden çıkarmak istediğinizden emin misiniz?`;

    Alert.alert(title, message, [
      { text: 'İptal', style: 'cancel' },
      {
        text: isRemovingSelf ? 'Ayrıl' : 'Çıkar',
        style: 'destructive',
        onPress: async () => {
          try {
            await houseApi.removeMember(houseId, memberId, user?.id);
            showToast(isRemovingSelf ? 'Evden ayrıldınız' : 'Üye çıkarıldı', 'success');
            if (isRemovingSelf) {
              navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
            } else {
              fetchMembers();
              fetchKPIData();
            }
          } catch (error) {
            showToast(error?.response?.data?.message || 'İşlem başarısız', 'error');
          }
        }
      }
    ]);
  };

  const handleSendInvitation = async () => {
    if (!inviteEmail.trim()) {
      showToast('Lütfen e-posta adresi girin', 'error');
      return;
    }
    try {
      setInviting(true);
      await houseApi.sendInvitation(houseId, inviteEmail.trim());
      showToast('Davet başarıyla gönderildi', 'success');
      setInviteModalVisible(false);
      setInviteEmail('');
    } catch (error) {
      showToast(error?.response?.data?.message || 'Davet gönderilemedi', 'error');
    } finally {
      setInviting(false);
    }
  };

  if (loading) {
    return (
      <View style={[CommonStyles.container, { backgroundColor: theme.colors.background }]}>
        <View style={CommonStyles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary?.[500]} />
          <Text style={[CommonStyles.loadingText, { color: theme.colors.text.secondary }]}>Yükleniyor...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[CommonStyles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView style={CommonStyles.content} ref={listRef} onScroll={handleScroll} scrollEventThrottle={16}>
        <View style={CommonStyles.header}>
          <Text style={[CommonStyles.title, { color: theme.colors.text.primary }]}>{houseName || 'Ev'}</Text>
        </View>

        {/* KPI Özeti */}
        <View style={styles.kpiRow}>
          <View style={[styles.kpiCard, { backgroundColor: theme.colors.surface }]}>
            <Text style={styles.kpiLabel}>Üye</Text>
            <Text style={styles.kpiValue}>{memberCount}</Text>
          </View>
          <View style={[styles.kpiCard, { backgroundColor: theme.colors.surface }]}>
            <Text style={styles.kpiLabel}>Bu Ay</Text>
            <Text style={styles.kpiValue}>{monthlyBillsTotal.toFixed(0)} ₺</Text>
          </View>
          <View style={[styles.kpiCard, { backgroundColor: theme.colors.surface }]}>
            <Text style={styles.kpiLabel}>Denge</Text>
            <Text style={[styles.kpiValue, { color: netBalance >= 0 ? theme.colors.success?.[600] : theme.colors.error?.[600] }]}>
              {netBalance.toFixed(0)} ₺
            </Text>
          </View>
        </View>

        {/* Üye Listesi */}
        <View style={[CommonStyles.card, { marginTop: 20 }]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>👥 Ev Arkadaşları</Text>
            <TouchableOpacity 
              style={styles.addBtn}
              onPress={() => setInviteModalVisible(true)}
            >
              <Text style={styles.addBtnText}>➕ Davet</Text>
            </TouchableOpacity>
          </View>
          
          {friends.map((item) => {
            const isCurrentUser = user && user.id === item.id;
            const balanceColor = item.balance > 0 ? theme.colors.success?.[600] : (item.balance < 0 ? theme.colors.error?.[600] : theme.colors.text.secondary);
            
            return (
              <View key={item.id} style={styles.memberItem}>
                <View style={[styles.avatar, { backgroundColor: theme.colors.primary?.[500] }]}>
                  <Text style={styles.avatarText}>{item.fullName.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.memberName}>{item.fullName} {isCurrentUser && '(Siz)'}</Text>
                  <Text style={styles.memberEmail}>{item.email}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.memberBalance, { color: balanceColor }]}>
                    {item.balance !== 0 ? `${item.balance.toFixed(0)} ₺` : 'Nötr'}
                  </Text>
                  {user?.id === creatorUserId && !isCurrentUser && (
                    <TouchableOpacity onPress={() => handleRemoveMember(item.id, item.fullName)} style={{ marginTop: 4 }}>
                      <Text style={{ fontSize: 16 }}>🗑️</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {/* Menü Grid */}
        <View style={{ marginTop: 20, flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <MenuBtn icon="📄" title="Faturalar" sub="Bu ay" onPress={() => navigation.navigate('BillsOverviewScreen', { houseId, houseName })} color={theme.colors.info?.[50]} />
          <MenuBtn icon="📋" title="Harcamalar" sub="Tümü" onPress={() => navigation.navigate('TumHarcamalar', { houseId, houseName })} color={theme.colors.success?.[50]} />
          <MenuBtn icon="⏳" title="Bekleyen" sub="Onaylar" onPress={() => navigation.navigate('BekleyenOdemeler', { houseId, houseName })} color={theme.colors.warning?.[50]} />
          <MenuBtn icon="💰" title="Bakiye" sub="Net durum" onPress={() => navigation.navigate('DebtSummaryScreen', { houseId, houseName })} color={theme.colors.error?.[50]} />
        </View>

        {/* Ayrıl Butonu */}
        <TouchableOpacity 
          style={styles.leaveBtn}
          onPress={() => handleRemoveMember(user?.id, 'Kendim')}
        >
          <Text style={styles.leaveBtnText}>🚪 Evden Ayrıl</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={hideToast} />

      <Modal visible={inviteModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
            <Text style={styles.modalTitle}>Davet Et</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="E-posta adresi"
              value={inviteEmail}
              onChangeText={setInviteEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={[styles.mBtn, { backgroundColor: theme.colors.neutral?.[200] }]} onPress={() => setInviteModalVisible(false)}>
                <Text>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.mBtn, { backgroundColor: theme.colors.primary?.[600] }]} onPress={handleSendInvitation} disabled={inviting}>
                <Text style={{ color: '#fff' }}>Gönder</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const MenuBtn = ({ icon, title, sub, onPress, color }) => (
  <TouchableOpacity style={[styles.menuBtn, { backgroundColor: color }]} onPress={onPress}>
    <Text style={{ fontSize: 24, marginBottom: 4 }}>{icon}</Text>
    <Text style={{ fontWeight: 'bold' }}>{title}</Text>
    <Text style={{ fontSize: 10, opacity: 0.6 }}>{sub}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  kpiRow: { flexDirection: 'row', gap: 10 },
  kpiCard: { flex: 1, padding: 12, borderRadius: 12, alignItems: 'center', borderWeight: 1, borderColor: '#eee' },
  kpiLabel: { fontSize: 12, opacity: 0.6 },
  kpiValue: { fontSize: 16, fontWeight: 'bold' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold' },
  addBtn: { backgroundColor: '#007AFF', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  addBtnText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  memberItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  avatar: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { color: '#fff', fontWeight: 'bold' },
  memberName: { fontWeight: 'bold' },
  memberEmail: { fontSize: 12, opacity: 0.5 },
  memberBalance: { fontWeight: 'bold' },
  menuBtn: { flex: 1, minWidth: '45%', padding: 15, borderRadius: 15, alignItems: 'center' },
  leaveBtn: { marginTop: 30, padding: 15, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ff3b30', alignItems: 'center' },
  leaveBtnText: { color: '#ff3b30', fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { padding: 20, borderRadius: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  modalInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, marginBottom: 20 },
  mBtn: { flex: 1, padding: 12, borderRadius: 10, alignItems: 'center' }
});

export default HouseMembersScreen;
