import React from 'react';
import { Image, Text, View } from 'react-native';
import { useTheme } from '../shared/theme/ThemeProvider';

const ICON = require('../assets/adaptive-icon.png');
const LOGO = require('../assets/icon.png');

export default function BrandMark({
  size = 28,
  variant = 'icon',
  label,
  subtle = false,
  style,
}) {
  const { theme } = useTheme();
  const isLogo = variant === 'logo';
  const tint = subtle ? theme.colors.text.secondary : theme.colors.text.primary;

  return (
    <View style={[{ alignItems: 'center', justifyContent: 'center' }, style]}>
      <Image
        source={isLogo ? LOGO : ICON}
        resizeMode="contain"
        style={{
          width: isLogo ? size * 2.8 : size,
          height: isLogo ? size * 1.35 : size,
        }}
      />
      {label ? (
        <Text
          style={{
            color: tint,
            fontSize: 12,
            fontWeight: '700',
            marginTop: 6,
            textAlign: 'center',
          }}
        >
          {label}
        </Text>
      ) : null}
    </View>
  );
}
