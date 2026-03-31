import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../services/api';
import { isSixDigitCode } from '../shared/validation/authValidation';
import { makeColorThemes, useCommonStyles } from '../shared/ui/CommonStyles';
import { useTheme } from '../shared/theme/ThemeProvider';

const RESEND_COOLDOWN_SECONDS = 180;

const VerificationScreen = ({ navigation, route }) => {
  const { email, fullName, password } = route.params || {};
  const { login } = useAuth();
  const commonStyles = useCommonStyles();
  const { theme } = useTheme();
  const colorThemes = makeColorThemes(theme);
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_COOLDOWN_SECONDS);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = setInterval(() => setSecondsLeft((value) => (value > 0 ? value - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [secondsLeft]);

  const handleVerification = async () => {
    if (!isSixDigitCode(verificationCode)) {
      Alert.alert('Hata', 'Lütfen 6 haneli doğrulama kodunu girin.');
      return;
    }

    setLoading(true);
    try {
      const response = await authApi.verifyCodeAndRegister(
        email,
        verificationCode.trim(),
        fullName,
        password
      );
      const payload = response?.data;

      if (payload?.token && payload?.user) {
        await login(payload.user, payload.token);
        Alert.alert('Başarılı', 'Hesabınız oluşturuldu.');
        return;
      }

      Alert.alert(
        'Başarılı',
        payload?.raw?.message || 'Kayıt tamamlandı. Şimdi giriş yapabilirsiniz.',
        [{ text: 'Tamam', onPress: () => navigation.navigate('Login') }]
      );
    } catch (error) {
      const status = error?.response?.status;
      const raw = error?.response?.data?.message || error?.response?.data || error?.message || '';
      const text = typeof raw === 'string' ? raw : JSON.stringify(raw);
      const lower = text.toLowerCase();
      let message = 'Doğrulama başarısız.';

      if (lower.includes('zaten kay') || lower.includes('already')) {
        message = 'Bu e-posta zaten kayıtlı. Lütfen giriş yapmayı deneyin.';
      } else if (lower.includes('expired') || lower.includes('süre') || lower.includes('sure') || lower.includes('geçersiz') || lower.includes('gecersiz')) {
        message = 'Kod geçersiz veya süresi dolmuş. Lütfen yeni kod isteyin.';
      } else if (status === 400 && text) {
        message = text;
      } else if (text) {
        message = text;
      }

      Alert.alert('Hata', message);
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (secondsLeft > 0) return;

    setLoading(true);
    try {
      await authApi.sendVerificationCode(email, 'register');
      Alert.alert('Başarılı', 'Yeni doğrulama kodu gönderildi.');
      setSecondsLeft(RESEND_COOLDOWN_SECONDS);
    } catch (error) {
      Alert.alert('Hata', error?.response?.data?.message || error?.message || 'Kod gönderilemedi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={commonStyles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <ScrollView
        style={commonStyles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={commonStyles.header}>
          <Text style={commonStyles.title}>E-posta Doğrulama</Text>
          <Text style={commonStyles.subtitle}>{email} adresine gönderilen kodu girin.</Text>
        </View>

        <View style={styles.card}>
          <Text style={commonStyles.label}>Doğrulama Kodu</Text>
          <TextInput
            style={styles.codeInput}
            placeholder="000000"
            placeholderTextColor={theme.colors.text.secondary}
            value={verificationCode}
            onChangeText={setVerificationCode}
            keyboardType="number-pad"
            maxLength={6}
          />

          <Text style={styles.infoText}>{email} adresine 6 haneli doğrulama kodu gönderildi.</Text>
          <Text style={styles.countdownText}>
            {secondsLeft > 0 ? `Yeniden gönderim: ${secondsLeft} sn` : 'Yeniden gönderime hazır'}
          </Text>
        </View>

        <TouchableOpacity
          style={[commonStyles.menuButton, (!verificationCode.trim() || loading) && styles.disabledButton]}
          onPress={handleVerification}
          disabled={!verificationCode.trim() || loading}
          activeOpacity={0.85}
        >
          <View style={[commonStyles.buttonContent, { backgroundColor: colorThemes.success.background }]}>
            <Text style={commonStyles.buttonText}>{loading ? 'Doğrulanıyor...' : 'Hesabı Doğrula'}</Text>
            <Text style={commonStyles.buttonSubtext}>Hesabını aktifleştir</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[commonStyles.menuButton, (loading || secondsLeft > 0) && styles.disabledButton]}
          onPress={handleResendCode}
          disabled={loading || secondsLeft > 0}
          activeOpacity={0.85}
        >
          <View style={[commonStyles.buttonContent, { backgroundColor: colorThemes.warning.background }]}>
            <Text style={commonStyles.buttonText}>
              {loading
                ? 'Gönderiliyor...'
                : secondsLeft > 0
                  ? `Kodu Tekrar Gönder (${secondsLeft})`
                  : 'Kodu Tekrar Gönder'}
            </Text>
            <Text style={commonStyles.buttonSubtext}>Yeni kod talep et</Text>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

function makeStyles(theme) {
  return StyleSheet.create({
    content: { paddingBottom: 120 },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.colors.neutral?.[200],
      padding: 18,
      marginBottom: 14,
    },
    codeInput: {
      borderWidth: 1,
      borderColor: theme.colors.neutral?.[300],
      borderRadius: 14,
      padding: 14,
      backgroundColor: theme.colors.background,
      fontSize: 20,
      color: theme.colors.text.primary,
      textAlign: 'center',
      letterSpacing: 8,
    },
    infoText: {
      fontSize: 14,
      color: theme.colors.text.secondary,
      lineHeight: 20,
      marginTop: 16,
      padding: 12,
      backgroundColor: theme.colors.neutral[50],
      borderRadius: 10,
      borderLeftWidth: 4,
      borderLeftColor: theme.colors.warning[600],
    },
    countdownText: {
      marginTop: 12,
      fontSize: 12,
      color: theme.colors.text.secondary,
    },
    disabledButton: { opacity: 0.5 },
  });
}

export default VerificationScreen;
