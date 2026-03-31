import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTheme } from '../shared/theme/ThemeProvider';
import { authApi, houseApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Toast from '../components/Toast';
import { useToast } from '../hooks/useToast';
import {
  PASSWORD_RULES_TEXT,
  getPasswordValidationErrors,
  validateRegistrationForm,
} from '../shared/validation/authValidation';

const getWebInviteParams = () => {
  if (typeof window === 'undefined') {
    return { token: '', houseId: 0, email: '' };
  }

  const params = new URLSearchParams(window.location.search || '');
  return {
    token: params.get('token') || '',
    houseId: Number(params.get('houseId')) || 0,
    email: params.get('email') || '',
  };
};

const redirectWebToHome = () => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  window.history.replaceState({}, '', `${window.location.origin}/`);
};

export default function DavetKabul({ navigation, route }) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { user, login, logout, setDefaultHouseId } = useAuth();
  const { toast, showSuccess, showError, hideToast } = useToast();

  const webInviteParams = useMemo(() => getWebInviteParams(), []);
  const token = route?.params?.token || webInviteParams.token || '';
  const houseId = Number(route?.params?.houseId) || webInviteParams.houseId || 0;
  const invitedEmail = route?.params?.email || webInviteParams.email || '';

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState(invitedEmail);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [joiningExisting, setJoiningExisting] = useState(false);

  useEffect(() => {
    if (!token) {
      showError('Geçersiz davet linki.');
    }
  }, [token, showError]);

  const activeUserMatchesInvite =
    !!user?.email &&
    !!invitedEmail &&
    String(user.email).trim().toLowerCase() === String(invitedEmail).trim().toLowerCase();

  const finalizeJoin = async (joinedHouseId) => {
    const safeHouseId = Number(joinedHouseId) || houseId;
    if (safeHouseId) {
      try {
        const houseResponse = await houseApi.getById(safeHouseId);
        await setDefaultHouseId(safeHouseId, houseResponse?.data?.name);
      } catch {
        await setDefaultHouseId(safeHouseId);
      }
    }

    redirectWebToHome();
    navigation.reset({
      index: 0,
      routes: [{ name: 'Home' }],
    });
  };

  const handleJoinWithExistingAccount = async () => {
    if (!token) {
      showError('Davet linki geçersiz.');
      return;
    }

    setJoiningExisting(true);
    try {
      const response = await houseApi.acceptInvitation(token);
      showSuccess(response?.data?.message || 'Eve başarıyla katıldınız.');
      await finalizeJoin(response?.data?.houseId);
    } catch (error) {
      showError(error?.response?.data?.message || error?.message || 'Davet kabul edilemedi.');
    } finally {
      setJoiningExisting(false);
    }
  };

  const handleKayitOl = async () => {
    const error = validateRegistrationForm({ fullName, email, password, confirm });
    if (error) {
      showError(error);
      return;
    }
    if (!token) {
      showError('Davet tokeni bulunamadı.');
      return;
    }

    setLoading(true);
    try {
      const res = await authApi.verifyCodeAndRegister(
        email.trim().toLowerCase(),
        '',
        fullName.trim(),
        password,
        token,
      );

      const data = res?.data;
      if (!data?.token || !data?.user) {
        throw new Error(data?.raw?.message || 'Kayıt işlemi başarısız.');
      }

      await login(data.user, data.token);
      showSuccess('Hesabınız oluşturuldu ve eve eklendiniz.');
      await finalizeJoin(data?.joinedHouseId);
    } catch (e) {
      const errMsg = e?.response?.data?.message || e?.message || 'Kayıt sırasında bir hata oluştu.';
      showError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: theme.colors.background }]}>
        <Text style={styles.heroEmoji}>!</Text>
        <Text style={[styles.title, { color: theme.colors.text.primary }]}>Geçersiz Davet Linki</Text>
        <Text style={[styles.subtitle, { color: theme.colors.text.secondary }]}>
          Bu davet linki geçersiz veya süresi dolmuş olabilir.
        </Text>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: theme.colors.primary?.[600], width: '100%' }]}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={[styles.btnText, { color: theme.colors.text.onPrimary }]}>Giriş Sayfasına Dön</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.surface }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroSection}>
          <Text style={styles.heroEmoji}>EV</Text>
          <Text style={[styles.title, { color: theme.colors.text.primary }]}>Bu eve davet edildiniz</Text>
          <Text style={[styles.subtitle, { color: theme.colors.text.secondary }]}>
            Hesabınız varsa doğrudan katılın, yoksa bu ekrandan yeni hesap oluşturun.
          </Text>
        </View>

        {!!user && (
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.colors.background,
                borderColor: theme.colors.neutral?.[200],
                marginBottom: 14,
              },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: theme.colors.text.primary }]}>Mevcut hesapla devam et</Text>
            <Text style={[styles.info, { color: theme.colors.text.secondary }]}>
              Giriş yaptığınız hesap: {user?.email || 'Bilinmeyen hesap'}
            </Text>

            {invitedEmail && !activeUserMatchesInvite ? (
              <>
                <Text style={[styles.warning, { color: theme.colors.warning?.[700] || '#b45309' }]}>
                  Bu davet {invitedEmail} adresine gönderildi. Bu eve katılmak için o hesapla giriş yapmanız gerekir.
                </Text>
                <TouchableOpacity
                  style={[styles.secondaryBtn, { borderColor: theme.colors.neutral?.[300] }]}
                  onPress={async () => {
                    await logout();
                    navigation.navigate('Login', {
                      invitationToken: token,
                      invitationHouseId: houseId,
                      invitationEmail: invitedEmail,
                    });
                  }}
                >
                  <Text style={[styles.secondaryBtnText, { color: theme.colors.text.primary }]}>Hesabı değiştir</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: theme.colors.primary?.[600] }]}
                onPress={handleJoinWithExistingAccount}
                disabled={joiningExisting}
              >
                {joiningExisting ? (
                  <ActivityIndicator color={theme.colors.text.onPrimary} />
                ) : (
                  <Text style={[styles.btnText, { color: theme.colors.text.onPrimary }]}>Mevcut hesabımla eve katıl</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}

        {!user && (
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.colors.background,
                borderColor: theme.colors.neutral?.[200],
                marginBottom: 14,
              },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: theme.colors.text.primary }]}>Zaten hesabınız var mı?</Text>
            <Text style={[styles.info, { color: theme.colors.text.secondary }]}>
              Önce giriş yapın, sonra bu davet otomatik olarak hesabınıza bağlanıp evi açsın.
            </Text>
            <TouchableOpacity
              style={[styles.secondaryBtn, { borderColor: theme.colors.primary?.[300] }]}
              onPress={() =>
                navigation.navigate('Login', {
                  invitationToken: token,
                  invitationHouseId: houseId,
                  invitationEmail: invitedEmail,
                })
              }
            >
              <Text style={[styles.secondaryBtnText, { color: theme.colors.primary?.[700] }]}>Hesabım var, giriş yapacağım</Text>
            </TouchableOpacity>
          </View>
        )}

        {!user && (
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.colors.background,
                borderColor: theme.colors.neutral?.[200],
              },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: theme.colors.text.primary }]}>Yeni hesap oluştur</Text>

            <Text style={[styles.label, { color: theme.colors.text.primary }]}>Ad Soyad</Text>
            <TextInput
              style={[
                styles.input,
                {
                  borderColor: theme.colors.neutral?.[300],
                  color: theme.colors.text.primary,
                  backgroundColor: theme.colors.surface,
                },
              ]}
              placeholder="Adınız ve soyadınız"
              placeholderTextColor={theme.colors.text.disabled}
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
              autoCorrect={false}
            />

            <Text style={[styles.label, { color: theme.colors.text.primary }]}>E-posta</Text>
            <TextInput
              style={[
                styles.input,
                {
                  borderColor: theme.colors.neutral?.[300],
                  color: theme.colors.text.primary,
                  backgroundColor: invitedEmail ? theme.colors.neutral?.[100] : theme.colors.surface,
                },
              ]}
              placeholder="E-posta adresiniz"
              placeholderTextColor={theme.colors.text.disabled}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!invitedEmail}
            />
            {!!invitedEmail && (
              <Text style={[styles.hint, { color: theme.colors.text.secondary }]}>
                Davet bu e-posta adresine gönderildi.
              </Text>
            )}

            <Text style={[styles.label, { color: theme.colors.text.primary }]}>Şifre</Text>
            <TextInput
              style={[
                styles.input,
                {
                  borderColor: theme.colors.neutral?.[300],
                  color: theme.colors.text.primary,
                  backgroundColor: theme.colors.surface,
                },
              ]}
              placeholder="Güçlü bir şifre oluşturun"
              placeholderTextColor={theme.colors.text.disabled}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={[styles.info, { color: theme.colors.text.secondary }]}>{PASSWORD_RULES_TEXT}</Text>
            {getPasswordValidationErrors(password).map((message) => (
              <Text key={message} style={[styles.passwordRule, { color: theme.colors.warning?.[700] || '#b45309' }]}>
                • {message}
              </Text>
            ))}

            <Text style={[styles.label, { color: theme.colors.text.primary }]}>Şifre Tekrar</Text>
            <TextInput
              style={[
                styles.input,
                {
                  borderColor: theme.colors.neutral?.[300],
                  color: theme.colors.text.primary,
                  backgroundColor: theme.colors.surface,
                },
              ]}
              placeholder="Şifrenizi tekrar girin"
              placeholderTextColor={theme.colors.text.disabled}
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
            {!!confirm && password !== confirm && (
              <Text style={[styles.passwordRule, { color: theme.colors.error?.[700] || '#b91c1c' }]}>
                • Şifreler birebir aynı olmalıdır.
              </Text>
            )}

            <TouchableOpacity
              style={[styles.btn, { backgroundColor: theme.colors.success?.[600] || theme.colors.primary?.[600] }]}
              onPress={handleKayitOl}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={theme.colors.text.onPrimary} />
              ) : (
                <Text style={[styles.btnText, { color: theme.colors.text.onPrimary }]}>Hesap oluştur ve eve katıl</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={hideToast} />
    </KeyboardAvoidingView>
  );
}

function makeStyles(theme) {
  return StyleSheet.create({
    container: { flex: 1 },
    centered: { justifyContent: 'center', alignItems: 'center', padding: 24 },
    scrollContent: { padding: 20, flexGrow: 1, paddingBottom: 32 },
    heroSection: { alignItems: 'center', paddingVertical: 24 },
    heroEmoji: { fontSize: 44, fontWeight: '900', marginBottom: 12 },
    title: { fontSize: 26, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
    subtitle: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
    sectionTitle: { fontSize: 18, fontWeight: '800', marginBottom: 6 },
    card: { borderRadius: 16, padding: 18, borderWidth: 1 },
    label: { fontWeight: '700', marginTop: 14, marginBottom: 6, fontSize: 14 },
    input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 16 },
    hint: { marginTop: 4, fontSize: 12 },
    info: { marginTop: 8, fontSize: 13, lineHeight: 19 },
    passwordRule: { marginTop: 6, fontSize: 12, lineHeight: 18 },
    warning: { marginTop: 10, fontSize: 13, lineHeight: 19, fontWeight: '600' },
    btn: { paddingVertical: 14, borderRadius: 12, marginTop: 16, alignItems: 'center' },
    btnText: { fontWeight: '800', fontSize: 15 },
    secondaryBtn: {
      borderWidth: 1,
      borderRadius: 12,
      paddingVertical: 13,
      paddingHorizontal: 14,
      alignItems: 'center',
      marginTop: 14,
    },
    secondaryBtnText: { fontWeight: '700', fontSize: 14 },
  });
}
