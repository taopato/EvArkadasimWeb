import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useCommonStyles, makeColorThemes } from '../shared/ui/CommonStyles';
import { useTheme } from '../shared/theme/ThemeProvider';
import { authApi } from '../services/api';
import { isSixDigitCode } from '../shared/validation/authValidation';

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
    const id = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [secondsLeft]);

  const handleVerification = async () => {
    if (!isSixDigitCode(verificationCode)) {
      Alert.alert('Hata', 'Lutfen 6 haneli dogrulama kodunu girin.');
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
        navigation.reset({
          index: 0,
          routes: [{ name: 'Home' }],
        });
        Alert.alert('Basarili', 'Hesabiniz olusturuldu!', [{ text: 'Tamam' }]);
      } else {
        Alert.alert(
          'Basarili',
          payload?.raw?.message || 'Kayit tamamlandi. Simdi giris yapabilirsiniz.',
          [{ text: 'Tamam', onPress: () => navigation.navigate('Login') }]
        );
      }
    } catch (error) {
      const status = error?.response?.status;
      const raw = error?.response?.data?.message || error?.response?.data || error?.message || '';
      const text = typeof raw === 'string' ? raw : JSON.stringify(raw);
      const lower = text.toLowerCase();
      let message = 'Dogrulama basarisiz';
      if (lower.includes('zaten kay') || lower.includes('already')) {
        message = 'Bu e-posta zaten kayitli. Lutfen giris yapmayi deneyin.';
      } else if (lower.includes('expired') || lower.includes('sure') || lower.includes('gecersiz')) {
        message = 'Kod gecersiz veya suresi dolmus. Lutfen yeni kod isteyin.';
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
      await authApi.sendVerificationCode(email);
      Alert.alert('Basarili', 'Yeni dogrulama kodu gonderildi.');
      setSecondsLeft(RESEND_COOLDOWN_SECONDS);
    } catch (error) {
      Alert.alert('Hata', error?.response?.data?.message || error?.message || 'Kod gonderilemedi');
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
        showsVerticalScrollIndicator={false}
      >
        <View style={commonStyles.header}>
          <Text style={commonStyles.title}>Email Dogrulama</Text>
          <Text style={commonStyles.subtitle}>{email} adresine gonderilen kodu girin</Text>
        </View>

        <View style={commonStyles.card}>
          <View style={commonStyles.inputContainer}>
            <Text style={commonStyles.label}>Dogrulama Kodu</Text>
            <TextInput
              style={styles.codeInput}
              placeholder="000000"
              placeholderTextColor={theme.colors.text.secondary}
              value={verificationCode}
              onChangeText={setVerificationCode}
              keyboardType="number-pad"
              maxLength={6}
            />
          </View>

          <Text style={styles.infoText}>
            {email} adresine 6 haneli dogrulama kodu gonderildi.
          </Text>
          <Text style={[styles.countdownText, { color: theme.colors.text.secondary }]}>
            {secondsLeft > 0
              ? `Yeniden gonderim: ${secondsLeft} sn`
              : 'Yeniden gonderime hazir'}
          </Text>
        </View>

        <TouchableOpacity
          style={[commonStyles.menuButton, (!verificationCode.trim() || loading) && { opacity: 0.5 }]}
          onPress={handleVerification}
          disabled={!verificationCode.trim() || loading}
          activeOpacity={0.8}
        >
          <View style={[commonStyles.buttonContent, { backgroundColor: colorThemes.success.background }]}>
            <Text style={commonStyles.buttonText}>{loading ? 'Dogrulaniyor...' : 'Hesabi Dogrula'}</Text>
            <Text style={commonStyles.buttonSubtext}>Hesabinizi aktifestirin</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[commonStyles.menuButton, (loading || secondsLeft > 0) && { opacity: 0.5 }]}
          onPress={handleResendCode}
          disabled={loading || secondsLeft > 0}
          activeOpacity={0.8}
        >
          <View style={[commonStyles.buttonContent, { backgroundColor: colorThemes.warning.background }]}>
            <Text style={commonStyles.buttonText}>
              {loading
                ? 'Gonderiliyor...'
                : secondsLeft > 0
                  ? `Kodu Tekrar Gonder (${secondsLeft})`
                  : 'Kodu Tekrar Gonder'}
            </Text>
            <Text style={commonStyles.buttonSubtext}>Yeni kod talep edin</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={commonStyles.menuButton}
          onPress={() => navigation.navigate('SignupScreen')}
          activeOpacity={0.8}
        >
          <View style={[commonStyles.buttonContent, { backgroundColor: colorThemes.neutral.background }]}>
            <Text style={commonStyles.buttonText}>Geri Don</Text>
            <Text style={commonStyles.buttonSubtext}>Kayit sayfasina don</Text>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

function makeStyles(theme) {
  return StyleSheet.create({
    codeInput: {
      borderWidth: 1,
      borderColor: theme.colors.neutral?.[300],
      borderRadius: 8,
      padding: 12,
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
      borderRadius: 8,
      borderLeftWidth: 4,
      borderLeftColor: theme.colors.warning[600],
    },
    countdownText: {
      marginTop: 12,
      fontSize: 12,
    },
  });
}

export default VerificationScreen;
