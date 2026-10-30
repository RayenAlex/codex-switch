import { MenuPanel } from "./MenuPanel";
import { useQuickMenu } from "./useQuickMenu";
import { useApplicationFontSize } from '../../../../../shared/appearance/useApplicationFontSize';
import "./styles.css";

export function QuickMenu() {
  useApplicationFontSize();
  const menu = useQuickMenu();
  return <MenuPanel key={menu.snapshot?.revision ?? 0} {...menu} />;
}
