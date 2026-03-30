import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Image,
} from 'react-native';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import Constants from 'expo-constants';
import { useAuth } from '../context/AuthContext';
import { authApi, houseApi } from '../services/api';
import { useCommonStyles } from '../shared/ui/CommonStyles';
import { useTheme } from '../shared/theme/ThemeProvider';
import { TextInput as ThemedTextInput } from '../shared/ui/TextInput';
import { Button as ThemedButton } from '../shared/ui/Button';
import { GOOGLE_CLIENT_IDS } from '../shared/config/env';
import { isValidEmail, normalizeEmail } from '../shared/validation/authValidation';

WebBrowser.maybeCompleteAuthSession();

const LOGO = require('../assets/icon.png');

const extractIdTokenFromUrlHash = () => {
  if (typeof window === 'undefined') return null;
  const { pathname, hash } = window.location;
  if (pathname !== '/oauthredirect' || !hash) return null;

  const params = new URLSearchParams(hash.replace(/^#/, ''));
  return params.get('id_token');
};

const GoogleLoginButton = ({
  isExpoGo,
  projectNameForProxy,
  googleConfigured,
  googleClientConfig,
  theme,
  login,
}) => {
  const [googleLoading, setGoogleLoading] = useState(false);
  const isWeb = Platform.OS === 'web';

  const finishGoogleLogin = async (idToken) => {
    const apiResponse = await authApi.googleLogin(idToken);
    const payload = apiResponse?.data || {};
    const token = payload?.token;
    const user = payload?.user;

    if (!token || !user) {
        throw new Error('Google giriş yanıtı eksik.');
    }

    await login(user, token);

    if (typeof window !== 'undefined') {
      window.history.replaceState({}, '', `${window.location.origin}/`);
    }
  };

  const googleRedirectUri = useMemo(() => {
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

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: googleClientConfig.clientId,
    expoClientId: googleClientConfig.expoClientId,
    webClientId: googleClientConfig.webClientId,
    androidClientId: googleClientConfig.androidClientId,
    iosClientId: googleClientConfig.iosClientId,
    redirectUri: googleRedirectUri,
    scopes: ['openid', 'profile', 'email'],
  });

  const handleGoogleLogin = async () => {
    try {
      setGoogleLoading(true);
      await promptAsync(
        isWeb
          ? {
              windowName: '_self',
            }
          : undefined
      );
    } catch (error) {
      Alert.alert('Google girişi başarısız', error?.message || 'İşlem başlatılamadı.');
      setGoogleLoading(false);
    }
  };

  useEffect(() => {
    const runGoogleLogin = async () => {
      if (response?.type !== 'success') {
        if (response?.type && response.type !== 'dismiss') {
          setGoogleLoading(false);
        }
        return;
      }

      const idToken = response?.params?.id_token || response?.authentication?.idToken;
      if (!idToken) {
        setGoogleLoading(false);
        Alert.alert('Google girişi başarısız', 'Google kimlik belirteci alınamadı.');
        return;
      }

      try {
        await finishGoogleLogin(idToken);
      } catch (error) {
        Alert.alert(
          'Google girişi başarısız',
          error?.response?.data?.message || error?.message || 'Sunucuya giriş yapılamadı.'
        );
      } finally {
        setGoogleLoading(false);
      }
    };

    runGoogleLogin();
  }, [response, login]);

  useEffect(() => {
    if (!isWeb) return;

    const idToken = extractIdTokenFromUrlHash();
    if (!idToken) return;

    let cancelled = false;

    const runGoogleLoginFromHash = async () => {
      try {
        setGoogleLoading(true);
        await finishGoogleLogin(idToken);
      } catch (error) {
        if (!cancelled) {
          Alert.alert(
            'Google girişi başarısız',
            error?.response?.data?.message || error?.message || 'Sunucuya giriş yapılamadı.'
          );
        }
      } finally {
        if (!cancelled) {
          setGoogleLoading(false);
        }
      }
    };

    runGoogleLoginFromHash();

    return () => {
      cancelled = true;
    };
  }, [isWeb, login]);

  return (
    <>
      <TouchableOpacity
        style={[
          styles.googleButton,
          {
            borderColor: theme.colors.neutral[200],
            backgroundColor: theme.colors.background,
          },
        ]}
        onPress={handleGoogleLogin}
        disabled={!request || googleLoading}
        activeOpacity={0.85}
      >
        <Text style={[styles.googleIcon, { color: theme.colors.primary[600] }]}>G</Text>
        <Text style={[styles.googleText, { color: theme.colors.text.primary }]}>
          {googleLoading ? 'Google ile bağlanılıyor...' : 'Google ile giriş yap'}
        </Text>
      </TouchableOpacity>

      {googleConfigured && isExpoGo && (
        <Text style={[styles.helper, { color: theme.colors.warning[600] }]}>
          Expo Go ile denemek için ayrıca GOOGLE_EXPO_CLIENT_ID tanımlanmalı.
        </Text>
      )}
    </>
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
  const isExpoGo = Constants?.appOwnership === 'expo';
  const projectNameForProxy = Constants?.expoConfig?.owner && Constants?.expoConfig?.slug
    ? `@${Constants.expoConfig.owner}/${Constants.expoConfig.slug}`
    : undefined;
  const googleEnabledForCurrentPlatform = Platform.OS === 'web'
    ? Boolean(GOOGLE_CLIENT_IDS.web)
    : isExpoGo
      ? Boolean(GOOGLE_CLIENT_IDS.expo || GOOGLE_CLIENT_IDS.web)
      : Boolean(
          GOOGLE_CLIENT_IDS.android ||
            GOOGLE_CLIENT_IDS.ios ||
            GOOGLE_CLIENT_IDS.expo ||
            GOOGLE_CLIENT_IDS.web
        );

  const googleConfigured = useMemo(
    () =>
      Boolean(
        GOOGLE_CLIENT_IDS.web ||
          GOOGLE_CLIENT_IDS.android ||
          GOOGLE_CLIENT_IDS.ios ||
          GOOGLE_CLIENT_IDS.expo
      ),
    []
  );

  const invitationToken = route?.params?.invitationToken || '';
  const invitationHouseId = Number(route?.params?.invitationHouseId) || 0;
  const invitationEmail = route?.params?.invitationEmail || '';

  const finalizeInvitationIfNeeded = async () => {
    if (!invitationToken) {
      return;
    }

    const response = await houseApi.acceptInvitation(invitationToken);
    const joinedHouseId = Number(response?.data?.houseId) || invitationHouseId;

    if (joinedHouseId) {
      try {
        const houseResponse = await houseApi.getById(joinedHouseId);
        const house = houseResponse?.data;
        await setDefaultHouseId(joinedHouseId, house?.name);
      } catch {
        await setDefaultHouseId(joinedHouseId);
      }
    }

    Alert.alert('Başarılı', response?.data?.message || 'Davetiniz kabul edildi.');
  };

  const googleClientConfig = useMemo(
    () => ({
      expoClientId: GOOGLE_CLIENT_IDS.expo || undefined,
      webClientId: GOOGLE_CLIENT_IDS.web || undefined,
      androidClientId: GOOGLE_CLIENT_IDS.android || undefined,
      iosClientId: GOOGLE_CLIENT_IDS.ios || undefined,
      clientId: GOOGLE_CLIENT_IDS.web || GOOGLE_CLIENT_IDS.expo || undefined,
    }),
    []
  );

  const handleLogin = async () => {
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !password.trim()) {
      setErrorMessage('Lütfen e-posta ve şifrenizi girin.');
      Alert.alert('Hata', 'Lütfen e-posta ve şifrenizi girin.');
      return;
    }

    if (!isValidEmail(normalizedEmail)) {
      setErrorMessage('Lütfen geçerli bir e-posta adresi girin.');
      Alert.alert('Hata', 'Lütfen geçerli bir e-posta adresi girin.');
      return;
    }

    setErrorMessage('');
    setLoading(true);
    try {
      const response = await authApi.login({
        email: normalizedEmail,
        password,
      });
      const raw = response?.data || {};
      const data = raw?.data ?? raw ?? {};

      const getDeep = (obj, predicate) => {
        const stack = [obj];
        while (stack.length) {
          const current = stack.pop();
          if (!current || typeof current !== 'object') continue;
          if (predicate(current)) return current;
          for (const key of Object.keys(current)) {
            const value = current[key];
            if (value && typeof value === 'object') stack.push(value);
          }
        }
        return null;
      };

      const findValueByKeyList = (obj, keys) => {
        const lowered = keys.map((key) => key.toLowerCase());
        const node = getDeep(obj, (candidate) =>
          Object.keys(candidate).some((key) => lowered.includes(key.toLowerCase()))
        );

        if (!node) return undefined;
        for (const key of Object.keys(node)) {
          if (lowered.includes(key.toLowerCase())) return node[key];
        }
        return undefined;
      };

      const token = findValueByKeyList(data, ['token', 'accessToken', 'jwt', 'jwtToken']);
      let user = findValueByKeyList(data, ['user', 'userDto', 'account', 'profile', 'userInfo']);

      if (!user) {
        const userId = findValueByKeyList(data, ['userId', 'id']);
        const fullName = findValueByKeyList(data, ['fullName', 'name']);
        const emailFromApi = findValueByKeyList(data, ['email', 'mail']);
        if (userId || fullName || emailFromApi) {
          user = {
            id: userId ?? 0,
            fullName: fullName ?? normalizedEmail,
            email: emailFromApi ?? normalizedEmail,
          };
        }
      }

      if (token && user) {
        setErrorMessage('');
        await login(user, token);
        await finalizeInvitationIfNeeded();
        return;
      }

      setErrorMessage(raw?.message || 'Lütfen bilgilerinizi kontrol edin.');
      Alert.alert('Giriş başarısız', raw?.message || 'Lütfen bilgilerinizi kontrol edin.');
    } catch (error) {
      const status = error?.response?.status;
      const validationErrors = error?.response?.data?.errors;
      const raw =
        error?.response?.data?.message || error?.response?.data || error?.message || '';
      const text = typeof raw === 'string' ? raw : JSON.stringify(raw);
      const lower = text.toLowerCase();

      let message = 'Giriş başarısız. Lütfen bilgilerinizi kontrol edin.';
      if (Array.isArray(validationErrors) && validationErrors.length > 0) {
        message = validationErrors.map((item) => item?.message).filter(Boolean).join('\n');
      } else
      if (status === 401 && (lower.includes('kayitli bir kullanici bulunamadi') || lower.includes('uye olun'))) {
        message = 'Bu e-posta ile kayıtlı bir hesap bulunamadı. Lütfen önce üye olun.';
      } else if (status === 401 && (lower.includes('sifreniz yanlis') || lower.includes('wrong password'))) {
        message = 'Şifreniz yanlış. Lütfen tekrar deneyin.';
      } else if (status === 401) {
        message = 'E-posta veya şifre hatalı.';
      } else if (text) {
        message = text;
      }

      setErrorMessage(message);
      Alert.alert('Giriş başarısız', message);
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
        <View
          style={[
            CommonStyles.content,
            styles.content,
            { backgroundColor: theme.colors.background },
          ]}
        >
          <View style={styles.hero}>
            <View
              style={[
                styles.logoWrap,
                {
                  backgroundColor: theme.colors.primary[50],
                  borderColor: theme.colors.primary[200],
                },
              ]}
            >
              <Image source={LOGO} style={styles.logo} resizeMode="contain" />
            </View>
            <Text style={[styles.heading, { color: theme.colors.text.primary }]}>
              Ev Arkadaşım
            </Text>
            <Text style={[styles.subheading, { color: theme.colors.text.secondary }]}>
              Harcamaları paylaş, borçları gör, ödemeleri tek yerden yönet.
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
                Bu davet {invitationEmail} adresi için gönderildi. Giriş yaptığınızda eve otomatik katılacaksınız.
              </Text>
            )}
            <ThemedTextInput
              style={{ marginBottom: 12 }}
              placeholder="Şifre"
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
                <Text style={[styles.errorText, { color: theme.colors.error[700] }]}>
                  {errorMessage}
                </Text>
              </View>
            )}

            <ThemedButton title="Giriş Yap" onPress={handleLogin} loading={loading} />

            {!googleEnabledForCurrentPlatform && (
              <Text style={[styles.helper, { color: theme.colors.warning[600] }]}>
                Google girişi bu ortam için henüz yapılandırılmamış. Ekranın geri kalanı sorunsuz çalışmaya devam eder.
              </Text>
            )}

            {googleEnabledForCurrentPlatform && (
              <GoogleLoginButton
                isExpoGo={isExpoGo}
                projectNameForProxy={projectNameForProxy}
              googleConfigured={googleConfigured}
              googleClientConfig={googleClientConfig}
              theme={theme}
              login={login}
            />
          )}

            <TouchableOpacity onPress={() => navigation.navigate('ForgotPasswordScreen')}>
              <Text style={[styles.link, { color: theme.colors.text.secondary }]}>
                Şifremi unuttum
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate('SignupScreen')}>
              <Text style={[styles.link, { color: theme.colors.primary[600] }]}>
                Hesabın yok mu? Kayıt ol
              </Text>
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
    width: 96,
    height: 96,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logo: {
    width: 72,
    height: 72,
  },
  heading: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
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
