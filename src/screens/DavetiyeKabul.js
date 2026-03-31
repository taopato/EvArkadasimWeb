import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useCommonStyles } from '../shared/ui/CommonStyles';
import { useTheme } from '../shared/theme/ThemeProvider';

const AcceptInvitationScreen = () => {
  const CommonStyles = useCommonStyles();
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={CommonStyles.container}>
      <ScrollView style={CommonStyles.content} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={CommonStyles.header}>
          <Text style={CommonStyles.title}>Davet Kabul Et</Text>
          <Text style={CommonStyles.subtitle}>Bu eski ekran artık kullanılmıyor.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.infoText}>
            Güncel davet akışı yeni davet kabul ekranından çalışır. Bu sayfa sadece geriye dönük uyumluluk için tutuluyor.
          </Text>
        </View>
      </ScrollView>
    </View>
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
    },
    infoText: {
      fontSize: 15,
      color: theme.colors.text.secondary,
      lineHeight: 24,
      textAlign: 'center',
    },
  });
}

export default AcceptInvitationScreen;
