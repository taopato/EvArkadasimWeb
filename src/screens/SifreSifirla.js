import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useCommonStyles, makeColorThemes } from '../shared/ui/CommonStyles';
import { useTheme } from '../shared/theme/ThemeProvider';
import { authApi } from '../services/api';
import {
  isSixDigitCode,
  isStrongPassword,
  normalizeEmail,
  PASSWORD_RULES_TEXT,
} from '../shared/validation/authValidation';

const ResetPasswordScreen = ({ route, navigation }) => {
  const { email } = route.params || {};
  const commonStyles = useCommonStyles();
  const { theme } = useTheme();
  makeColorThemes(theme);
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail || !code || !newPassword) {
      Alert.alert('Hata', 'Tum alanlari doldurun.');
      return;
    }

    if (!isSixDigitCode(code)) {
      Alert.alert('Hata', 'Dogrulama kodu 6 haneli olmali.');
      return;
    }

    if (!isStrongPassword(newPassword)) {
      Alert.alert('Hata', PASSWORD_RULES_TEXT);
      return;
    }

    setLoading(true);
    try {
      await authApi.resetPassword(normalizedEmail, code.trim(), newPassword);
      Alert.alert('Basarili', 'Sifreniz guncellendi.');
      navigation.navigate('Login');
    } catch (error) {
      Alert.alert('Hata', error.response?.data?.message || error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={commonStyles.container}>
      <View style={commonStyles.content}>
        <Text style={commonStyles.title}>Sifre Sifirla</Text>
        <View style={commonStyles.card}>
          <TextInput
            style={styles.input}
            placeholder="Dogrulama Kodu"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            maxLength={6}
          />
          <TextInput
            style={styles.input}
            placeholder="Yeni sifre"
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            onSubmitEditing={handleReset}
            blurOnSubmit={false}
          />
          <Text style={styles.helper}>{PASSWORD_RULES_TEXT}</Text>
          <TouchableOpacity
            style={[styles.button, loading && { opacity: 0.5 }]}
            onPress={handleReset}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sifreyi Sifirla</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

function makeStyles(theme) {
  return StyleSheet.create({
    input: {
      borderWidth: 1,
      borderColor: theme.colors.neutral[300],
      borderRadius: 8,
      padding: 12,
      marginBottom: 12,
      backgroundColor: theme.colors.background,
      color: theme.colors.text.primary,
    },
    helper: {
      color: theme.colors.text.secondary,
      fontSize: 12,
      lineHeight: 18,
      marginBottom: 12,
    },
    button: {
      backgroundColor: theme.colors.success[600],
      padding: 14,
      borderRadius: 8,
      alignItems: 'center',
    },
    buttonText: { color: theme.colors.text.onPrimary, fontWeight: 'bold' },
  });
}

export default ResetPasswordScreen;
