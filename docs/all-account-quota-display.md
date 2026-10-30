# All-account average quota display

The pet dock settings have a third **All-account average** switch below the dock and label switches.
The preference is
off by default and affects both the bubble and the official Codex pet dock, independently of whether
either widget is visible. Disabling it restores the existing current-account, provider, or concurrent
routing display. It does not select accounts or change routing, API credentials, or accounting.

The desktop backend reads cached usage snapshots for every imported account, including accounts
disabled for automatic routing. API Providers are not account quota windows and are excluded.
Each account has equal weight. Five-hour (300-minute) and weekly (10,080-minute) windows have separate
denominators, identified by duration even if primary and secondary are reversed. Zero is a real value;
missing, non-finite, and out-of-range percentages are unknown. A window without any valid values shows
`--`. For example, five-hour remaining values 82%, 75%, and 50% average to 69%; weekly remaining values
78%, 75%, and 72% average to 75%. Rounding happens only for display.

Cached values remain visible when stale or an account refresh fails. The bubble tooltip reports the
number of contributing accounts for each window and warns about stale data; the dock retains its
existing stale indication. Accounts have different reset schedules, so averages have no single reset
countdown or reset-credit count. The classic bubble displays an average marker instead. Clicking the
bubble refreshes all accounts through the existing usage-refresh command. Background display polling
is single-flight every 2.5 seconds and does not issue upstream usage queries.

Desktop local mode and a browser served by that desktop use the same async backend commands. The
independent cloud Web app explains where to configure desktop widgets because it has no access to
the computer's imported accounts or windows. Four released UI languages are included.

The feature is based on upstream v2.1.1, which already contains the text-label preference and the LAN
large-response quota repair. Validate with the quota-display Rust tests, useQuotaDisplay and pet-card
UI tests, `node --test scripts/quota-display.browser.test.mjs`, and the pet-dock renderer browser tests.

The local integration also includes the independently developed pet dragging fix: transparent tray
wrappers do not intercept mascot input, actual cards stay interactive, and supported Codex renderers
anchor cards to the pet in the same layout frame with an above-pet fallback at the bottom edge.
Renderer version 15 identifies the combined implementation, preserving both average labels and the
layout repair. The combined browser suite covers all 15 renderer scenarios.
