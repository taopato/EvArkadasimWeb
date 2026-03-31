import React, { useMemo, useState } from 'react';
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
import { houseApi } from '../services/api';
import { useCommonStyles } from '../shared/ui/CommonStyles';
import { useTheme } from '../shared/theme/ThemeProvider';

const InviteFriendScreen = ({ navigation, route }) => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const CommonStyles = useCommonStyles();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const activeHouseId = Number(route?.params?.houseId || user?.defaultHouseId || 0);
  const activeHouseName = route?.params?.houseName || user?.defaultHouseName || 'Aktif Ev';
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const sendInvite = async () => {
    if (!activeHouseId || !email.trim()) {
      Alert.alert('Hata', 'Ev ve e-posta zorunludur.');
      return;
    }

    try {
      setLoading(true);
      await houseApi.sendInvitation(activeHouseId, email.trim());
      Alert.alert('Başarılı', 'Davet gönderildi.', [{ text: 'Tamam', onPress: () => navigation.goBack() }]);
    } catch (error) {
      Alert.alert('Hata', error?.response?.data?.message || error?.message || 'Davet gönderilemedi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={CommonStyles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <ScrollView
        style={CommonStyles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={CommonStyles.header}>
          <Text style={CommonStyles.title}>Arkadaş Davet Et</Text>
          <Text style={CommonStyles.subtitle}>{activeHouseName} için e-posta daveti gönder.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>E-posta adresi</Text>
          <TextInput
            style={styles.input}
            placeholder="ornek@email.com"
            placeholderTextColor={theme.colors.text.secondary}
            selectionColor={theme.colors.primary[500]}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <TouchableOpacity
            style={[styles.primaryButton, (!email.trim() || loading) && styles.disabledButton]}
            onPress={sendInvite}
            disabled={!email.trim() || loading}
            activeOpacity={0.9}
          >
            <Text style={styles.primaryButtonText}>{loading ? 'Gönderiliyor...' : 'Daveti Gönder'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const makeStyles = (theme) =>
  StyleSheet.create({
    content: { paddingBottom: 120 },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.colors.neutral?.[200],
      padding: 18,
    },
    label: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.colors.text.primary,
      marginBottom: 8,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.colors.neutral?.[300],
      backgroundColor: theme.colors.background,
      color: theme.colors.text.primary,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 13,
      fontSize: 16,
      marginBottom: 14,
    },
    primaryButton: {
      backgroundColor: theme.colors.primary[600],
      minHeight: 48,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryButtonText: {
      color: theme.colors.text.onPrimary,
      fontWeight: '800',
      fontSize: 15,
    },
    disabledButton: { opacity: 0.5 },
  });

export default InviteFriendScreen;
