import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import { useAuth } from '../context/AuthContext';
import { authApi, houseApi } from '../services/api';
import { GOOGLE_CLIENT_IDS } from '../shared/config/env';
import { isValidEmail, normalizeEmail } from '../shared/validation/authValidation';
import { useCommonStyles } from '../shared/ui/CommonStyles';
import { Button as ThemedButton } from '../shared/ui/Button';
import { TextInput as ThemedTextInput } from '../shared/ui/TextInput';
import { useTheme } from '../shared/theme/ThemeProvider';

WebBrowser.maybeCompleteAuthSession();

const LOGO = require('../assets/icon.png');

const showLoginAlert = (navigation, title, message, options = {}) => {
  const actions = [];

  if (options.showSignup) {
    actions.push({
      text: 'Uye Ol',
      onPress: () => navigation.navigate('SignupScreen'),
    });
  }

  if (options.showForgotPassword) {
    actions.push({
      text: 'Sifremi Unuttum',
      onPress: () =>
        navigation.navigate(
          'ForgotPasswordScreen',
          options.email ? { email: options.email } : undefined
        ),
    });
  }

  actions.push({ text: 'Tamam', style: 'cancel' });
  Alert.alert(title, message, actions);
};

const extractIdTokenFromUrlHash = () => {
  if (typeof window === 'undefined') return null;
  const { pathname, hash } = window.location;
  if (pathname !== '/oauthredirect' || !hash) return null;

  const params = new URLSearchParams(hash.replace(/^#/, ''));
  return params.get('id_token');
};

const GoogleLoginButton = ({ login, theme }) => {
  const [loading, setLoading] = useState(false);
  const isExpoGo = Constants?.appOwnership === 'expo';
  const projectNameForProxy =
    Constants?.expoConfig?.owner && Constants?.expoConfig?.slug
      ? `@${Constants.expoConfig.owner}/${Constants.expoConfig.slug}`
      : undefined;

  const redirectUri = useMemo(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return `${window.location.origin}/oauthredirect`;
    }

    if (isExpoGo) {
      try {
        return AuthSession.getRedirectUrl();
      } catch {
        if (projectNameForProxy) {
          return `https://auth.expo.io/${projectNameForProxy}`;
        }
      }
    }

    return AuthSession.makeRedirectUri({
      scheme: 'evarkadasim',
      path: 'oauthredirect',
    });
  }, [isExpoGo, projectNameForProxy]);

  const googleConfig = useMemo(
    () => ({
      clientId: GOOGLE_CLIENT_IDS.web || GOOGLE_CLIENT_IDS.expo || undefined,
      webClientId: GOOGLE_CLIENT_IDS.web || undefined,
      androidClientId: GOOGLE_CLIENT_IDS.android || undefined,
      iosClientId: GOOGLE_CLIENT_IDS.ios || undefined,
      expoClientId: GOOGLE_CLIENT_IDS.expo || undefined,
      redirectUri,
      scopes: ['openid', 'profile', 'email'],
    }),
    [redirectUri]
  );

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest(googleConfig);

  const finishGoogleLogin = async (idToken) => {
    const apiResponse = await authApi.googleLogin(idToken);
    const payload = apiResponse?.data || {};
    if (!payload?.token || !payload?.user) {
      throw new Error('Google girisi tamamlanamadi.');
    }

    await login(payload.user, payload.token);

    if (typeof window !== 'undefined') {
      window.history.replaceState({}, '', `${window.location.origin}/`);
    }
  };

  useEffect(() => {
    const run = async () => {
      if (response?.type !== 'success') {
        if (response?.type && response.type !== 'dismiss') {
          setLoading(false);
        }
        return;
      }

      try {
        const idToken = response?.params?.id_token || response?.authentication?.idToken;
        if (!idToken) throw new Error('Google kimlik bilgisi alinamadi.');
        await finishGoogleLogin(idToken);
      } catch (error) {
        Alert.alert(
          'Google Girisi Basarisiz',
          error?.response?.data?.message || error?.message || 'Google ile giris yapilamadi.'
        );
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [response]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const idToken = extractIdTokenFromUrlHash();
    if (!idToken) return;

    let cancelled = false;
    const run = async () => {
      try {
        setLoading(true);
        await finishGoogleLogin(idToken);
      } catch (error) {
        if (!cancelled) {
          Alert.alert(
            'Google Girisi Basarisiz',
            error?.response?.data?.message || error?.message || 'Google ile giris yapilamadi.'
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <TouchableOpacity
      style={[
        styles.googleButton,
        {
          borderColor: theme.colors.neutral[200],
          backgroundColor: theme.colors.background,
        },
      ]}
      onPress={async () => {
        try {
          setLoading(true);
          await promptAsync(Platform.OS === 'web' ? { windowName: '_self' } : undefined);
        } catch (error) {
          setLoading(false);
          Alert.alert('Google Girisi Basarisiz', error?.message || 'Google islemi baslatilamadi.');
        }
      }}
      disabled={!request || loading}
      activeOpacity={0.85}
    >
      <Text style={[styles.googleIcon, { color: theme.colors.primary[600] }]}>G</Text>
      <Text style={[styles.googleText, { color: theme.colors.text.primary }]}>
        {loading ? 'Google ile baglaniliyor...' : 'Google ile giris yap'}
      </Text>
    </TouchableOpacity>
  );
};

const GirisYap = ({ navigation, route }) => {
  const { login, setDefaultHouseId } = useAuth();
  const { theme } = useTheme();
  const CommonStyles = useCommonStyles();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const invitationToken = route?.params?.invitationToken || '';
  const invitationHouseId = Number(route?.params?.invitationHouseId) || 0;
  const invitationEmail = route?.params?.invitationEmail || '';

  const finalizeInvitationIfNeeded = async () => {
    if (!invitationToken) return;

    const response = await houseApi.acceptInvitation(invitationToken);
    const joinedHouseId = Number(response?.data?.houseId) || invitationHouseId;

    if (joinedHouseId) {
      try {
        const houseResponse = await houseApi.getById(joinedHouseId);
        await setDefaultHouseId(joinedHouseId, houseResponse?.data?.name);
      } catch {
        await setDefaultHouseId(joinedHouseId);
      }
    }

    if (typeof window !== 'undefined') {
      window.history.replaceState({}, '', `${window.location.origin}/`);
    }
  };

  const handleLogin = async () => {
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !password.trim()) {
      const message = 'Lutfen e-posta ve sifrenizi girin.';
      setErrorMessage(message);
      showLoginAlert(navigation, 'Eksik Bilgi', message);
      return;
    }

    if (!isValidEmail(normalizedEmail)) {
      const message = 'Lutfen gecerli bir e-posta adresi girin.';
      setErrorMessage(message);
      showLoginAlert(navigation, 'Gecersiz E-posta', message);
      return;
    }

    setErrorMessage('');
    setLoading(true);

    try {
      const response = await authApi.login({ email: normalizedEmail, password });
      const payload = response?.data || {};
      const token = payload?.token;
      const user = payload?.user;

      if (!token || !user) {
        throw new Error(payload?.raw?.message || 'Giris yapilamadi.');
      }

      await login(user, token);
      await finalizeInvitationIfNeeded();
      if (typeof window !== 'undefined') {
        window.history.replaceState({}, '', `${window.location.origin}/`);
      }
      return;
    } catch (error) {
      const status = error?.response?.status;
      const messageFromApi = error?.response?.data?.message || error?.message || '';
      const lower = String(messageFromApi).toLowerCase();

      let message = 'Giris yapilamadi. Lutfen bilgilerinizi kontrol edin.';
      let alertOptions = { email: normalizedEmail };

      if (
        status === 401 &&
        (lower.includes('kayitli bir kullanici bulunamadi') || lower.includes('once uye olun'))
      ) {
        message = 'Bu e-posta ile kayitli bir hesap bulunamadi. Isterseniz hemen uye olabilirsiniz.';
        alertOptions = { ...alertOptions, showSignup: true };
      } else if (status === 401 && lower.includes('sifreniz yanlis')) {
        message = 'Sifreniz yanlis. Tekrar deneyebilir veya sifrenizi sifirlayabilirsiniz.';
        alertOptions = { ...alertOptions, showForgotPassword: true };
      } else if (status === 401) {
        message = 'E-posta veya sifre hatali. Sifrenizi unuttuysaniz sifirlamayi deneyin.';
        alertOptions = { ...alertOptions, showForgotPassword: true };
      } else if (messageFromApi) {
        message = String(messageFromApi);
      }

      setErrorMessage(message);
      showLoginAlert(navigation, 'Giris Basarisiz', message, alertOptions);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[CommonStyles.container, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[CommonStyles.content, styles.content, { backgroundColor: theme.colors.background }]}>
          <View style={styles.hero}>
            <View style={styles.logoWrap}>
              <Image source={LOGO} style={styles.logo} resizeMode="contain" />
            </View>
            <Text style={[styles.subheading, { color: theme.colors.text.secondary }]}>
              Harcamalari paylas, borclari gor, odemeleri tek yerden yonet.
            </Text>
          </View>

          <View
            style={[
              CommonStyles.card,
              styles.card,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.neutral[200],
              },
            ]}
          >
            <ThemedTextInput
              style={{ marginBottom: 12 }}
              placeholder="E-posta"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            {!!invitationEmail && (
              <Text style={[styles.helper, { color: theme.colors.primary[700], marginTop: -4, marginBottom: 10 }]}>
                Bu davet {invitationEmail} adresi icin gonderildi. Giris yaptiginizda eve otomatik katilacaksiniz.
              </Text>
            )}

            <ThemedTextInput
              style={{ marginBottom: 12 }}
              placeholder="Sifre"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={handleLogin}
              blurOnSubmit={false}
            />

            {!!errorMessage && (
              <View
                style={[
                  styles.errorBox,
                  {
                    backgroundColor: theme.colors.error[50],
                    borderColor: theme.colors.error[200],
                  },
                ]}
              >
                <Text style={[styles.errorText, { color: theme.colors.error[700] }]}>{errorMessage}</Text>
              </View>
            )}

            <ThemedButton title="Giris Yap" onPress={handleLogin} loading={loading} />

            <GoogleLoginButton login={login} theme={theme} />

            <TouchableOpacity onPress={() => navigation.navigate('ForgotPasswordScreen', email ? { email } : undefined)}>
              <Text style={[styles.link, { color: theme.colors.text.secondary }]}>Sifremi unuttum</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate('SignupScreen')}>
              <Text style={[styles.link, { color: theme.colors.primary[600] }]}>Hesabin yok mu? Kayit ol</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    justifyContent: 'center',
    paddingVertical: 24,
  },
  hero: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoWrap: {
    width: 320,
    height: 320,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 0,
  },
  logo: {
    width: 600,
    height: 600,
  },
  subheading: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 320,
  },
  card: {
    width: '100%',
    borderWidth: 1,
  },
  googleButton: {
    marginTop: 12,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  googleIcon: {
    fontSize: 20,
    fontWeight: '800',
  },
  googleText: {
    fontSize: 15,
    fontWeight: '700',
  },
  helper: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  errorBox: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  link: {
    marginTop: 14,
    textAlign: 'center',
  },
});

export default GirisYap;
