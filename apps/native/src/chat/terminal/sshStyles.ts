import { createThemedStyles } from '../../theme/styles';
import { textMetrics } from '../../theme/text';

export const useSshStyles = createThemedStyles(color => ({
  content: { gap: 12, paddingBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  field: { gap: 4 },
  label: { ...textMetrics(13, 20), color: color('#17211b', 'ink'), flexShrink: 1 },
  input: { ...textMetrics(15, 23), color: color('#17211b', 'ink'), borderWidth: 1,
    borderColor: color('#dfe5df', 'border'), borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  multiline: { minHeight: 120, textAlignVertical: 'top' },
  button: { minHeight: 44, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', backgroundColor: color('#eef4f1', 'canvas') },
  selected: { borderWidth: 1, borderColor: color('#14806f', 'accent') },
  disabled: { opacity: .45 },
  hint: { ...textMetrics(12, 19), color: color('#718078', 'muted'), maxWidth: 400 },
  error: { ...textMetrics(13, 20), color: color('#c44545', 'danger'), maxWidth: 400 },
  list: { maxHeight: 180 },
}));
