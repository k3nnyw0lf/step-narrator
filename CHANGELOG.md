# Changelog

## 1.2.0 (2026-11-13)

First public release.

- New: `setLocalOnly(true)` uses only voices that run on the device.
- New: `canSpeak` and `canPlay` say what the browser can do.
- Changed: `bind(button)` keeps the button hidden when the browser has no voice. Pages that use clips pass `bind(button, { clips: true })` to show it when the browser can only play audio.
- Fixed: a clip that fails to load was read twice with the browser voice, and the next item could be skipped. The browser reports the failure two ways; now the text is read once.
- Fixed: if the browser voice fails on one item, the queue moves on to the next.
- Fixed: three-letter language codes (like `fil`) no longer match a two-letter one (like `fi`).
- Fixed: language tags with underscores (like `es_MX`) work.
- Fixed: the script no longer throws when there is no `window` (server-side rendering).
- Added: a 3-step demo in English and Spanish, and unit tests that run in Node.

## 1.1.0 (2026-11-13)

- New: `say(text, { audio })` plays a recorded clip and falls back to the browser voice.
- New: `sayAll([...])` plays items in order.
- New: `setDefault(on)` starts it on for visitors who never chose. Their own choice is remembered.

## 1.0.0 (2026-11-13)

First version, used on a live web form.

- Listen button, off until the visitor taps it, choice remembered on the device.
- English and Spanish, best voice per language.
- Stops when the tab is hidden or the page closes.
