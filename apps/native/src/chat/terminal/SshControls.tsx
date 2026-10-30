import { Pressable, Text, TextInput, View, type TextInputProps } from 'react-native';
import { useSshStyles } from './sshStyles';

export function SshButton({ label, onPress, disabled, selected }: {
  label: string; onPress: () => void; disabled?: boolean; selected?: boolean;
}) {
  const styles = useSshStyles();
  return <Pressable accessibilityRole="button" accessibilityLabel={label}
    accessibilityState={{ disabled, selected }} disabled={disabled} onPress={onPress}
    style={[styles.button, selected && styles.selected, disabled && styles.disabled]}>
    <Text style={styles.label}>{label}</Text>
  </Pressable>;
}

export function SshField({ label, ...props }: TextInputProps & { label: string }) {
  const styles = useSshStyles();
  return <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <TextInput autoCapitalize="none" autoCorrect={false} {...props} accessibilityLabel={label}
      style={[styles.input, props.multiline && styles.multiline, props.style]} />
  </View>;
}
