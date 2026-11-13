# Changelog

## 1.1.0 (2026-11-13)

First public release.

- New: `setLocalOnly(true)` uses only voices that run on the device.
- Fixed: three-letter language codes (like `fil`) no longer match a two-letter one (like `fi`).
- Fixed: language tags with underscores (like `es_MX`) work.
- Fixed: the script no longer throws when there is no `window` (server-side rendering).
- Added: a 3-step demo in English and Spanish, and unit tests that run in Node.

## 1.0.0 (2026-11-13)

First version, used on a live web form.

- Listen button, off until the visitor taps it, choice remembered on the device.
- English and Spanish, best voice per language.
- Stops when the tab is hidden or the page closes.
