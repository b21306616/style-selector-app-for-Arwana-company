import { useState, type PropsWithChildren } from 'react';
import { Pressable, Text, View } from 'react-native';
import { typography } from '../ui/theme';
import { Icon } from './Icon';

export function Disclosure({ title, children }: PropsWithChildren<{ title: string }>) {
  const [expanded, setExpanded] = useState(false);
  return <View style={{ gap: 8 }}>
    <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ expanded }} onPress={() => setExpanded(value => !value)} style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <Text style={[typography.small, { flex: 1 }]}>{title}</Text><Icon name={expanded ? 'collapse' : 'expand'} fallback={expanded ? '−' : '+'} />
    </Pressable>
    {expanded ? children : null}
  </View>;
}
