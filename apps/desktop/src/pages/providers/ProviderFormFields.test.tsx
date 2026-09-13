// @vitest-environment jsdom

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ProviderWebsocketControl } from "./ProviderFormFields";

describe("ProviderWebsocketControl", () => {
  it("allows WebSocket forwarding for a compatible provider", () => {
    const html = renderToStaticMarkup(
      <ProviderWebsocketControl enabled available saving={false} onChange={vi.fn()} />,
    );

    expect(html).toContain('id="provider-websocket-enabled"');
    expect(html).toContain("checked");
    expect(html).not.toContain("disabled");
  });

  it("disables WebSocket forwarding for an incompatible provider", () => {
    const html = renderToStaticMarkup(
      <ProviderWebsocketControl enabled={false} available={false} saving={false}
        onChange={vi.fn()} />,
    );

    expect(html).toContain("disabled");
  });
});
