import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
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

const NewGroupScreen = ({ navigation }) => {
  const [houseName, setHouseName] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, setDefaultHouseId } = useAuth();
  const CommonStyles = useCommonStyles();
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const handleCreateGroup = async () => {
    if (!houseName.trim()) {
      Alert.alert('Hata', 'Lütfen ev grubu adını giriniz.');
      return;
    }

    setLoading(true);
    try {
      const response = await houseApi.createHouse({
        name: houseName.trim(),
        description: '',
        creatorUserId: user?.id,
      });
      const raw = response?.data || {};
      const house = raw?.data ?? raw ?? {};

      if (house?.id) {
        await setDefaultHouseId(house.id, house.name);
        navigation.replace('EvUyeleri', { houseId: house.id, houseName: house.name });
      } else {
        Alert.alert('Başarılı', 'Ev grubu oluşturuldu.', [{ text: 'Tamam', onPress: () => navigation.goBack() }]);
      }
    } catch (error) {
      Alert.alert('Hata', error?.response?.data?.message || error?.message || 'Oluşturulamadı');
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
          <Text style={CommonStyles.title}>Yeni Ev Grubu</Text>
          <Text style={CommonStyles.subtitle}>Ev arkadaşlarınla ortak harcamaları düzenli takip et.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Ev grubu adı</Text>
          <TextInput
            style={styles.input}
            placeholder="Örn: Edremit Ev"
            placeholderTextColor={theme.colors.text.secondary}
            value={houseName}
            onChangeText={setHouseName}
            onSubmitEditing={handleCreateGroup}
            blurOnSubmit={false}
          />

          <TouchableOpacity
            style={[styles.primaryButton, (!houseName.trim() || loading) && styles.disabledButton]}
            onPress={handleCreateGroup}
            disabled={!houseName.trim() || loading}
            activeOpacity={0.9}
          >
            {loading ? <ActivityIndicator color={theme.colors.text.onPrimary} /> : <Text style={styles.primaryButtonText}>Ev Grubunu Oluştur</Text>}
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
      backgroundColor: theme.colors.success[600],
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

export default NewGroupScreen;
