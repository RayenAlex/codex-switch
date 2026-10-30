import inlineCopy from '@remoteai/i18n/copy/inline/admin/pages/HelpQuestionsField';
import { Button, Input, Space, Typography } from "antd";
import type { HelpQuestion } from "../hooks/useHelpSettings";

export const MAX_HELP_QUESTIONS = 12;
const MAX_QUESTION_LENGTH = 200;

export function HelpQuestionsField(props: {
  value: HelpQuestion[]; disabled: boolean; zh: boolean; onChange: (questions: HelpQuestion[]) => void;
}) {
  const { value, disabled, zh, onChange } = props;
  const update = (index: number, language: "zh" | "en", text: string) =>
    onChange(value.map((question, position) => position === index ? { ...question, [language]: text } : question));
  return <div>
    <Typography.Paragraph>{zh ? inlineCopy["text_7289b763"] : inlineCopy["Suggested_questions_823a7e3a"]}</Typography.Paragraph>
    <Typography.Paragraph type="secondary">{zh
      ? inlineCopy["12_200_6f68f756"]
      : inlineCopy.descriptionEn}</Typography.Paragraph>
    <Space direction="vertical" style={{ width: "100%" }}>
      {value.map((question, index) => <div key={index} style={{ display: "flex", gap: 8, alignItems: "start" }}>
        <Space direction="vertical" style={{ flex: 1, minWidth: 0 }}>
          <Input.TextArea aria-label={`${zh ? inlineCopy["text_167ac64d"] : inlineCopy["Chinese_question_fb2726a0"]} ${index + 1}`}
            placeholder={zh ? inlineCopy["text_167ac64d"] : inlineCopy["Chinese_question_fb2726a0"]} value={question.zh} disabled={disabled}
            maxLength={MAX_QUESTION_LENGTH} autoSize={{ minRows: 1, maxRows: 4 }}
            onChange={(event) => update(index, "zh", event.target.value)} />
          <Input.TextArea aria-label={`${zh ? inlineCopy["text_25cb3c7f"] : inlineCopy["English_question_e6c86134"]} ${index + 1}`}
            placeholder={zh ? inlineCopy["text_25cb3c7f"] : inlineCopy["English_question_e6c86134"]} value={question.en} disabled={disabled}
            maxLength={MAX_QUESTION_LENGTH} autoSize={{ minRows: 1, maxRows: 4 }}
            onChange={(event) => update(index, "en", event.target.value)} />
        </Space>
        <Button disabled={disabled} aria-label={`${zh ? inlineCopy["text_d8105660"] : inlineCopy["Remove_question_9d22dcac"]} ${index + 1}`}
          onClick={() => onChange(value.filter((_, position) => position !== index))}>{zh ? inlineCopy["text_2f9daa82"] : inlineCopy["Remove_c3812fc4"]}</Button>
      </div>)}
      <Button disabled={disabled || value.length >= MAX_HELP_QUESTIONS}
        onClick={() => onChange([...value, { zh: "", en: "" }])}>{zh ? inlineCopy["text_3f8da84a"] : inlineCopy["Add_question_f9496b76"]}</Button>
    </Space>
  </div>;
}
