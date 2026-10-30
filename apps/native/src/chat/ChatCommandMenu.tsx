import { displayText, displayError } from '../i18n/index';
import { createThemedStyles } from '../theme/styles';
import { t, useLanguage } from '../i18n';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Skill } from './types';
import { skillDescription, skillLabel, type SkillCatalogState } from './skillCatalog';
import { palette, useStyles } from './styles';

interface Props {
  catalog: SkillCatalogState;
  query: string;
  skillsOnly: boolean;
  compactReason: string | null;
  choose: (skill: Skill) => void;
  compact: () => void;
  goal?: () => void;
  close: () => void;
}

export function ChatCommandMenu({ catalog, query, skillsOnly, compactReason, choose, compact, goal, close }: Props) {
  const menuStyles = useMenuStyles();
  const styles = useStyles();
  const language = useLanguage();
  const search = query.toLocaleLowerCase();
  const skills = catalog.skills.filter((skill) =>
    `${skill.name} ${skillLabel(skill)} ${skillDescription(skill, language)}`.toLocaleLowerCase().includes(search));
  const showCompact = !skillsOnly && `compact 压缩 上下文 ${t("client.chat.compactThisConversationSContext")}`.toLocaleLowerCase().includes(search);
  const showGoal = !!goal && !skillsOnly && `goal 目标 持续推进 ${t("client.chat.keepWorkingUntilTheGoalIsComplete")}`.toLocaleLowerCase().includes(search);
  return <View style={menuStyles.panel} accessibilityLabel={t("client.chat.commandsAndSkills")}>
    <View style={menuStyles.heading}>
      <Text style={styles.buttonText}>{t("client.chat.commandsAndSkills")}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={t("client.chat.closeCommandsAndSkills")} onPress={close} hitSlop={8}>
        <Text style={styles.buttonText}>×</Text>
      </Pressable>
    </View>
    <FlatList data={skills} keyExtractor={(skill) => skill.path} style={menuStyles.list}
      keyboardShouldPersistTaps="always" nestedScrollEnabled
      ListHeaderComponent={<>{showCompact ? <Pressable accessibilityRole="button" accessibilityLabel={t("client.chat.compactContext.d36946")}
        disabled={compactReason !== null} accessibilityState={{ disabled: compactReason !== null }}
        onPress={compact} style={[menuStyles.option, compactReason !== null && styles.disabled]}>
        <Text style={styles.buttonText}>{t("client.chat.compact")}{' '}<Text style={styles.subtitle}>/compact</Text></Text>
        <Text style={styles.subtitle}>{displayText(compactReason ?? "client.chat.compactThisConversationSContext")}</Text>
      </Pressable> : null}
      {showGoal && <Pressable accessibilityRole="button" accessibilityLabel={t("client.chat.goalMode")} onPress={goal}
        style={menuStyles.option}>
        <Text style={styles.buttonText}>{t("client.chat.goal")}{' '}<Text style={styles.subtitle}>/goal</Text></Text>
        <Text style={styles.subtitle}>{t("client.chat.keepWorkingUntilTheGoalIsComplete")}</Text>
      </Pressable>}</>}
      renderItem={({ item: skill }) => <Pressable accessibilityRole="button"
        accessibilityLabel={t("client.chat.useSkill", { value1: skillLabel(skill) })} disabled={!skill.enabled}
        accessibilityState={{ disabled: !skill.enabled }} onPress={() => choose(skill)}
        style={[menuStyles.option, !skill.enabled && styles.disabled]}>
        <Text style={styles.buttonText}>{skillLabel(skill)}{!skill.enabled && t("client.chat.disabled")}</Text>
        <Text numberOfLines={2} style={styles.subtitle}>{skillDescription(skill, language)}</Text>
      </Pressable>}
      ListFooterComponent={<>
        {!catalog.loaded && catalog.loading && <Text style={menuStyles.message}>{t("client.chat.loadingSkills")}</Text>}
        {!!catalog.error && <Text style={menuStyles.message}>{displayError(catalog.error)}</Text>}
        {catalog.loaded && !skills.length && !showCompact && !showGoal
          && <Text style={menuStyles.message}>{t("client.chat.noMatchingCommandsOrSkills")}</Text>}
      </>} />
  </View>;
}

const useMenuStyles = createThemedStyles((color) => ({
  panel: { width: '100%', maxWidth: 400, alignSelf: 'center', borderWidth: 1,
    borderColor: color(palette.border, 'border'), borderRadius: 14, overflow: 'hidden', backgroundColor: color('#fff', 'surface') },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12 },
  list: { maxHeight: 220, flexGrow: 0 },
  option: { paddingHorizontal: 12, paddingVertical: 10, gap: 4, borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color(palette.border, 'border') },
  message: { color: color(palette.muted, 'muted'), padding: 12, fontSize: 12, lineHeight: 18 },
}));
