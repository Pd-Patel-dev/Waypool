// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolWeight } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type IconMapping = Record<string, ComponentProps<typeof MaterialIcons>['name']>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING: IconMapping = {
  'house.fill': 'home',
  'house': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  'chevron.left': 'chevron-left',
  'dollarsign.circle.fill': 'attach-money',
  'chart.bar.fill': 'bar-chart',
  'chart.bar': 'bar-chart',
  'envelope.fill': 'email',
  'envelope': 'email',
  'line.3.horizontal': 'menu',
  'line.3.horizontal.decrease': 'tune',
  'location': 'location-on',
  'location.fill': 'location-on',
  'target': 'place',
  'clock': 'schedule',
  'mappin': 'room',
  'flag': 'flag',
  'car': 'directions-car',
  'car.fill': 'directions-car',
  'arrow.right.circle.fill': 'arrow-forward-ios',
  'star': 'star',
  'money': 'attach-money',
  'checkmark': 'check-circle',
  'checkmark.circle.fill': 'check-circle',
  'eye': 'visibility',
  'xmark': 'close',
  'bookmark': 'bookmark-border',
  'route': 'navigation',
  'trash': 'delete',
  'play.fill': 'play-arrow',
  'calendar': 'calendar-today',
  'xmark.circle.fill': 'cancel',
  'person.fill': 'person',
  'person.2.fill': 'people',
  'phone.fill': 'phone',
  'message.fill': 'message',
  'info.circle': 'info',
  'chevron.up': 'keyboard-arrow-up',
  'chevron.down': 'keyboard-arrow-down',
  'exclamationmark.triangle.fill': 'error',
  'repeat': 'repeat',
  // Add maneuver icons
  'arrow.up': 'arrow-upward',
  'arrow.turn.up.left': 'turn-left',
  'arrow.turn.up.right': 'turn-right',
  'arrow.uturn.down': 'u-turn-left',
  'arrow.up.right': 'trending-up',
};

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
