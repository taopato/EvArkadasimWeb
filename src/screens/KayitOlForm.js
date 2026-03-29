import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTheme } from '../shared/theme/ThemeProvider';
import { authApi } from '../services/api';
import {
  PASSWORD_RULES_TEXT,
  normalizeEmail,
  validateRegistrationForm,
} from '../shared/validation/authValidation';

const RegisterScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const error = validateRegistrationForm({ fullName, email, password, confirm });
    if (error) {
      Alert.alert('Hata', error);
      return false;
    }
    return true;
  };

  const handleSignup = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      const normalizedEmail = normalizeEmail(email);
      const res = await authApi.sendVerificationCode(normalizedEmail, 'register');
      if (res?.status === 200) {
        navigation.navigate('VerificationScreen', {
          email: normalizedEmail,
          fullName: fullName.trim(),
          password,
        });
      } else {
        Alert.alert('Hata', 'Kod gonderilemedi.');
      }
    } catch (e) {
      console.error('Kayit hatasi:', e);
      const message = e?.response?.data?.message || e.message || 'Islem basarisiz.';
      if (String(message).toLowerCase().includes('zaten kayıtlı') || String(message).toLowerCase().includes('zaten kayitli')) {
        Alert.alert(
          'Hata',
          message,
          [
            { text: 'Vazgec', style: 'cancel' },
            {
              text: 'Sifremi Unuttum',
              onPress: () => navigation.navigate('ForgotPasswordScreen', { email: normalizedEmail }),
            },
          ]
        );
      } else {
        Alert.alert('Hata', message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.surface }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <ScrollView
        contentContainerStyle={{ padding: 16, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, { color: theme.colors.text.primary }]}>Hesap Olustur</Text>
        <Text style={[styles.subtitle, { color: theme.colors.text.secondary }]}>
          Ev arkadaslarinla harcamalari yonet.
        </Text>

        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.background,
              borderColor: theme.colors.neutral?.[200],
            },
          ]}
        >
          <Text style={[styles.label, { color: theme.colors.text.primary }]}>Ad Soyad</Text>
          <TextInput
            style={[
              styles.input,
              {
                borderColor: theme.colors.neutral?.[300],
                color: theme.colors.text.primary,
                backgroundColor: theme.colors.background,
              },
            ]}
            placeholder="Adiniz ve soyadiniz"
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
            placeholderTextColor={theme.colors.text.disabled}
          />

          <Text style={[styles.label, { color: theme.colors.text.primary }]}>Email</Text>
          <TextInput
            style={[
              styles.input,
              {
                borderColor: theme.colors.neutral?.[300],
                color: theme.colors.text.primary,
                backgroundColor: theme.colors.background,
              },
            ]}
            placeholder="ornek@email.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoCorrect={false}
            placeholderTextColor={theme.colors.text.disabled}
          />

          <Text style={[styles.label, { color: theme.colors.text.primary }]}>Sifre</Text>
          <TextInput
            style={[
              styles.input,
              {
                borderColor: theme.colors.neutral?.[300],
                color: theme.colors.text.primary,
                backgroundColor: theme.colors.background,
              },
            ]}
            placeholder="Guclu sifre olusturun"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholderTextColor={theme.colors.text.disabled}
          />

          <Text style={[styles.info, { color: theme.colors.text.secondary }]}>{PASSWORD_RULES_TEXT}</Text>

          <Text style={[styles.label, { color: theme.colors.text.primary }]}>Sifre Tekrar</Text>
          <TextInput
            style={[
              styles.input,
              {
                borderColor: theme.colors.neutral?.[300],
                color: theme.colors.text.primary,
                backgroundColor: theme.colors.background,
              },
            ]}
            placeholder="Sifrenizi tekrar girin"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            placeholderTextColor={theme.colors.text.disabled}
            onSubmitEditing={handleSignup}
            blurOnSubmit={false}
          />

          <Text style={[styles.info, { color: theme.colors.text.secondary }]}>
            Kayit icin e-posta adresinize dogrulama kodu gelecektir.
          </Text>

          <TouchableOpacity
            style={[
              styles.btn,
              { backgroundColor: theme.colors.primary?.[600] },
              loading && styles.btnDisabled,
            ]}
            onPress={handleSignup}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={theme.colors.text.onPrimary} />
            ) : (
              <Text style={[styles.btnText, { color: theme.colors.text.onPrimary }]}>Hesap Olustur</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, { backgroundColor: theme.colors.neutral?.[200] }]}
            onPress={() => navigation.navigate('Login')}
            activeOpacity={0.85}
          >
            <Text style={[styles.btnText, { color: theme.colors.text.primary }]}>Giris Yap</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontSize: 24, fontWeight: '800', marginBottom: 6 },
  subtitle: { marginBottom: 16 },
  card: { borderRadius: 12, padding: 16, borderWidth: 1 },
  label: { fontWeight: '700', marginTop: 10, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
  },
  info: { marginTop: 12, fontSize: 12, lineHeight: 18 },
  btn: { paddingVertical: 12, borderRadius: 10, marginTop: 14, alignItems: 'center' },
  btnDisabled: { opacity: 0.6 },
  btnText: { fontWeight: '800' },
});

export default RegisterScreen;
