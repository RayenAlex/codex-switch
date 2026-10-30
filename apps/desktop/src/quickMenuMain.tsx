import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QuickMenu } from "./components/QuickMenu";
import { applyThemeMode, loadThemeMode } from "./utils/themeMode";
import { installBrowserDefaultsGuard } from '../../../shared/browser/installBrowserDefaultsGuard';

applyThemeMode(loadThemeMode());
const stopBrowserDefaultsGuard = installBrowserDefaultsGuard();
if (import.meta.hot) import.meta.hot.dispose(stopBrowserDefaultsGuard);
createRoot(document.getElementById("root")!).render(<StrictMode><QuickMenu /></StrictMode>);
