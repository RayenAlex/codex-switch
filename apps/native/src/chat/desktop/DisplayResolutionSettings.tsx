import type { DisplaySettingsProps } from '../../../../../shared/remote-desktop/displaySettings';
import { t } from '../../i18n';
import { ResolutionDropdown } from './ResolutionDropdown';
import { DisplaySettingsHint, DisplaySettingsSection } from './DisplaySettingsSection';

export function DisplayResolutionSettings({ resolution, settings, displays, saving }: DisplaySettingsProps) {
  const current = displays.find(display => display.id === settings.displayId);
  return <DisplaySettingsSection icon="monitor" title="client.remoteDesktop.resolution" description="client.remoteDesktop.changeTheRemoteDesktopResolution">
    {resolution?.options.length ? <ResolutionDropdown key={settings.displayId}
      current={current} options={resolution.options} change={resolution.change} saving={saving} />
      : <DisplaySettingsHint>{t("client.settings.resolutionChangesAreUnavailableOnThisComputer")}</DisplaySettingsHint>}
  </DisplaySettingsSection>;
}
