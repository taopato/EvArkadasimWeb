// src/screens/DavetKabul.js
// Bu ekran davet linki üzerinden açılır: /davet-kabul?token=XXX&houseId=15&email=ornek@mail.com
// Kullanıcı ad, soyad, şifre girer → kayıt olur → otomatik olarak eve eklenir
import React, { useState, useEffect, useMemo } from 'react';
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
import { useCommonStyles } from '../shared/ui/CommonStyles';
import { authApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Toast from '../components/Toast';
import { useToast } from '../hooks/useToast';
import {
  PASSWORD_RULES_TEXT,
  validateRegistrationForm,
} from '../shared/validation/authValidation';

export default function DavetKabul({ navigation, route }) {
  const { theme } = useTheme();
  const CommonStyles = useCommonStyles();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { login, setDefaultHouseId } = useAuth();
  const { toast, showSuccess, showError, hideToast } = useToast();

  // URL parametrelerini al
  const token = route?.params?.token || '';
  const houseId = Number(route?.params?.houseId) || 0;
  const invitedEmail = route?.params?.email || '';

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState(invitedEmail);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      showError('Geçersiz davet linki.');
    }
  }, [token]);

  const handleKayitOl = async () => {
    // Basit doğrulama
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
      // Davet tokenı ile kayıt: kod göndermeye gerek yok, direkt register
      const res = await authApi.verifyCodeAndRegister(
        email.trim().toLowerCase(),
        '', // code: davet akışında boş
        fullName.trim(),
        password,
        token, // invitationToken
      );

      const data = res?.data;
      if (!data?.token) {
        throw new Error(data?.raw?.message || 'Kayıt işlemi başarısız.');
      }

      // Kullanıcıyı giriş yaptır
      await login(data.token, data.user);

      // Katıldığı evi varsayılan ev olarak ata
      const joinedHouseId = data?.joinedHouseId || houseId;
      if (joinedHouseId) {
        setDefaultHouseId(joinedHouseId);
      }

      showSuccess('Hesabınız oluşturuldu ve eve eklendiniz! 🎉');

      // Kısa bir bekleme sonrası ana sayfaya yönlendir
      setTimeout(() => {
        navigation.reset({
          index: 0,
          routes: [{ name: 'MainTabs' }],
        });
      }, 1500);
    } catch (e) {
      const errMsg = e?.response?.data?.message || e?.message || 'Kayıt sırasında bir hata oluştu.';
      showError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center', padding: 30 }]}>
        <Text style={{ fontSize: 60, marginBottom: 20 }}>⚠️</Text>
        <Text style={[styles.title, { color: theme.colors.text.primary }]}>Geçersiz Davet Linki</Text>
        <Text style={[styles.subtitle, { color: theme.colors.text.secondary, marginBottom: 30 }]}>
          Bu davet linki geçersiz, süresi dolmuş veya hatalı olabilir. Lütfen ev sahibinden yeni bir davet göndermesini isteyin.
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
        contentContainerStyle={{ padding: 20, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Başlık Alanı */}
        <View style={styles.heroSection}>
          <Text style={styles.heroEmoji}>🏠</Text>
          <Text style={[styles.title, { color: theme.colors.text.primary }]}>
            Eve Davet Edildiniz!
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.text.secondary }]}>
            Birkaç bilgi girerek hemen üye olun ve ev grubuna dahil olun.
          </Text>
        </View>

        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.background,
              borderColor: theme.colors.neutral?.[200],
            },
          ]}
        >
          {/* Ad Soyad */}
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
            returnKeyType="next"
          />

          {/* E-posta (davet gönderilen mail ile kilitli) */}
          <Text style={[styles.label, { color: theme.colors.text.primary }]}>E-posta</Text>
          <TextInput
            style={[
              styles.input,
              {
                borderColor: theme.colors.neutral?.[300],
                color: theme.colors.text.primary,
                backgroundColor: invitedEmail
                  ? theme.colors.neutral?.[100]
                  : theme.colors.surface,
              },
            ]}
            placeholder="E-posta adresiniz"
            placeholderTextColor={theme.colors.text.disabled}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoCorrect={false}
            editable={!invitedEmail} // Davet ile gelen e-posta kilitli
            returnKeyType="next"
          />
          {!!invitedEmail && (
            <Text style={[styles.hint, { color: theme.colors.text.secondary }]}>
              🔒 Davet bu e-posta adresine gönderildi
            </Text>
          )}

          {/* Şifre */}
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
            returnKeyType="next"
          />
          <Text style={[styles.info, { color: theme.colors.text.secondary }]}>
            {PASSWORD_RULES_TEXT}
          </Text>

          {/* Şifre Tekrar */}
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
            returnKeyType="done"
            onSubmitEditing={handleKayitOl}
            blurOnSubmit={false}
          />

          {/* Kayıt Butonu */}
          <TouchableOpacity
            style={[
              styles.btn,
              { backgroundColor: theme.colors.primary?.[600] },
              loading && styles.btnDisabled,
            ]}
            onPress={handleKayitOl}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={theme.colors.text.onPrimary} />
            ) : (
              <Text style={[styles.btnText, { color: theme.colors.text.onPrimary }]}>
                🏠 Eve Katıl ve Kayıt Ol
              </Text>
            )}
          </TouchableOpacity>

          {/* Giriş yap linki */}
          <TouchableOpacity
            style={styles.loginLink}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={[styles.loginLinkText, { color: theme.colors.primary?.[600] }]}>
              Zaten hesabınız var mı? Giriş yapın
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={hideToast}
      />
    </KeyboardAvoidingView>
  );
}

function makeStyles(theme) {
  return StyleSheet.create({
    container: { flex: 1 },
    heroSection: {
      alignItems: 'center',
      paddingVertical: 24,
    },
    heroEmoji: {
      fontSize: 60,
      marginBottom: 12,
    },
    title: {
      fontSize: 26,
      fontWeight: '800',
      marginBottom: 8,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 15,
      textAlign: 'center',
      lineHeight: 22,
    },
    card: {
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      marginBottom: 20,
    },
    label: {
      fontWeight: '700',
      marginTop: 14,
      marginBottom: 6,
      fontSize: 14,
    },
    input: {
      borderWidth: 1,
      borderRadius: 10,
      padding: 12,
      fontSize: 16,
    },
    hint: {
      marginTop: 4,
      fontSize: 12,
    },
    info: {
      marginTop: 8,
      fontSize: 12,
      lineHeight: 18,
    },
    btn: {
      paddingVertical: 14,
      borderRadius: 12,
      marginTop: 20,
      alignItems: 'center',
    },
    btnDisabled: { opacity: 0.6 },
    btnText: {
      fontWeight: '800',
      fontSize: 16,
    },
    loginLink: {
      marginTop: 16,
      alignItems: 'center',
    },
    loginLinkText: {
      fontSize: 14,
      fontWeight: '600',
    },
  });
}
