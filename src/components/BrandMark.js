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
  const logoFrameHeight = size * 0.46;
  const logoImageOffsetY = -size * 0.27;

  return (
    <View style={[{ alignItems: 'center', justifyContent: 'center' }, style]}>
      {isLogo ? (
        <View
          style={{
            width: size,
            height: logoFrameHeight,
            overflow: 'hidden',
            alignItems: 'center',
          }}
        >
          <Image
            source={LOGO}
            resizeMode="contain"
            style={{
              width: size,
              height: size,
              marginTop: logoImageOffsetY,
            }}
          />
        </View>
      ) : (
        <Image
          source={ICON}
          resizeMode="contain"
          style={{
            width: size,
            height: size,
          }}
        />
      )}
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
