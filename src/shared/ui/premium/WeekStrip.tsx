import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';
import { TouchableScale } from './TouchableScale';
import { PremiumCard } from './Card';

function startFromToday(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(d.getDate() + n);
  return x;
}

function formatDayKey(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

type DayInfo = {
  date: Date;
  label: string;
  sublabel: string;
  key: string;
};

type Props = {
  selectedKey?: string;
  onSelect?: (key: string, day: Date) => void;
};

export const WeekStrip: React.FC<Props> = ({ selectedKey, onSelect }) => {
  const { theme } = useTheme();
  const startDate = startFromToday(new Date());
  const days: DayInfo[] = Array.from({ length: 7 }).map((_, i) => {
    const d = addDays(startDate, i);
    const key = formatDayKey(d);
    const weekday = d.toLocaleDateString('tr-TR', { weekday: 'short' });
    const dd = String(d.getDate()).padStart(2, '0');
    return { date: d, key, label: weekday, sublabel: dd };
  });

  return (
    <View style={{ flexDirection: 'row', paddingHorizontal: 12, paddingTop: 10, paddingBottom: 6 }}>
      {days.map((d) => {
        const active = selectedKey ? selectedKey === d.key : false;
        return (
          <View key={d.key} style={{ marginRight: 8, flex: 1 }}>
            <TouchableScale onPress={() => onSelect && onSelect(d.key, d.date)}>
              <PremiumCard
                padding="small"
                elevation={active ? 'medium' : 'small'}
                style={{
                  alignItems: 'center',
                  backgroundColor: active ? theme.colors.pastel.blue.bg : theme.colors.surface,
                  borderColor: active ? theme.colors.primary?.[600] : theme.colors.neutral?.[200],
                }}
              >
                <Text style={{ color: active ? theme.colors.primary?.[700] : theme.colors.text.primary, fontWeight: '700', fontSize: 12 }}>
                  {d.label}
                </Text>
                <Text style={{ color: active ? theme.colors.primary?.[700] : theme.colors.text.secondary, fontSize: 11 }}>
                  {d.sublabel}
                </Text>
              </PremiumCard>
            </TouchableScale>
          </View>
        );
      })}
    </View>
  );
};
