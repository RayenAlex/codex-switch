import { Checkbox, Input } from "antd";
import type { Translate } from "../../i18n";
import type { Provider } from "../../types";
import { ProviderBalanceSettings, type ProviderBalanceSettingsProps } from "./ProviderBalanceSettings";
import { RelayModelPicker } from "./RelayModelPicker";
import type { ModelReasoningConfig } from "./providerUtils";
import { relayApiUrl } from "./providerUtils";

interface ProviderFormFieldsProps {
  apiKey: string;
  baseUrl: string;
  supportsFastMode: boolean;
  websocketEnabled: boolean;
  modelConfigs: ModelReasoningConfig[];
  name: string;
  provider: Provider | null;
  saving: boolean;
  activeModel: string;
  balanceSettings: Omit<ProviderBalanceSettingsProps, "t">;
  onApiKeyChange: (value: string) => void;
  onBaseUrlChange: (value: string) => void;
  onSupportsFastModeChange: (value: boolean) => void;
  onWebsocketEnabledChange: (value: boolean) => void;
  onModelConfigsChange: (configs: ModelReasoningConfig[]) => void;
  onActiveModelChange: (model: string) => void;
  onNameChange: (value: string) => void;
  t: Translate;
}

interface ProviderFastModeSupportControlProps {
  supportsFastMode: boolean;
  saving: boolean;
  onChange: (value: boolean) => void;
  t: Translate;
}

export function ProviderFastModeSupportControl({
  supportsFastMode,
  saving,
  onChange,
  t,
}: ProviderFastModeSupportControlProps) {
  return <div className="provider-form-switch">
    <div>
      <label htmlFor="provider-supports-fast-mode">{t("providers.form.supportsFastMode")}</label>
      <small>{t("providers.form.supportsFastModeHint")}</small>
    </div>
    <Checkbox id="provider-supports-fast-mode" checked={supportsFastMode} disabled={saving}
      onChange={(event) => onChange(event.target.checked)} />
  </div>;
}

interface ProviderWebsocketControlProps {
  enabled: boolean;
  available: boolean;
  saving: boolean;
  onChange: (value: boolean) => void;
}

export function ProviderWebsocketControl({
  enabled, available, saving, onChange,
}: ProviderWebsocketControlProps) {
  return <div className="provider-form-switch">
    <div>
      <label htmlFor="provider-websocket-enabled">WebSocket</label>
      <small>Codex Responses</small>
    </div>
    <Checkbox id="provider-websocket-enabled" checked={enabled} disabled={saving || !available}
      onChange={(event) => onChange(event.target.checked)} />
  </div>;
}

export function ProviderFormFields({
  apiKey,
  baseUrl,
  supportsFastMode,
  websocketEnabled,
  modelConfigs,
  name,
  provider,
  saving,
  activeModel,
  balanceSettings,
  onApiKeyChange,
  onBaseUrlChange,
  onSupportsFastModeChange,
  onWebsocketEnabledChange,
  onModelConfigsChange,
  onActiveModelChange,
  onNameChange,
  t,
}: ProviderFormFieldsProps) {
  return <div className="provider-form">
    <label htmlFor="provider-name">{t("providers.form.name")}</label>
    <Input id="provider-name" value={name} disabled={saving} placeholder="OpenRouter"
      onChange={(event) => onNameChange(event.target.value)} />
    <label htmlFor="provider-base-url">{t("providers.form.baseUrl")}</label>
    <Input id="provider-base-url" value={baseUrl} disabled={saving}
      placeholder="https://openrouter.ai/api/v1"
      onChange={(event) => onBaseUrlChange(event.target.value)} />
    <label htmlFor="provider-api-key">{t("providers.form.apiKey")}</label>
    <Input.Password id="provider-api-key" value={apiKey} disabled={saving}
      placeholder={provider?.hasApiKey ? t("providers.form.keepApiKey") : t("providers.form.newApiKey")}
      onChange={(event) => onApiKeyChange(event.target.value)} />
    <ProviderFastModeSupportControl supportsFastMode={supportsFastMode} saving={saving}
      onChange={onSupportsFastModeChange} t={t} />
    <ProviderWebsocketControl enabled={websocketEnabled}
      available={(provider?.apiFormat ?? "openaiResponses") === "openaiResponses"}
      saving={saving} onChange={onWebsocketEnabledChange} />
    <RelayModelPicker baseUrl={relayApiUrl(baseUrl)} apiKey={apiKey}
      providerId={provider?.hasApiKey && relayApiUrl(provider.baseUrl) === relayApiUrl(baseUrl)
        ? provider.id : undefined}
      enabled={Boolean(baseUrl.trim())} disabled={saving}
      modelConfigs={modelConfigs} activeModel={activeModel}
      onModelConfigsChange={onModelConfigsChange} onActiveModelChange={onActiveModelChange} t={t} />
    <ProviderBalanceSettings {...balanceSettings} t={t} />
  </div>;
}
