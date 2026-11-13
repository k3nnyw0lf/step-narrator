# step-narrator

Add a **Listen** button to any web form. When it is on, each step is read out loud.

One small file. No server. No sign-up. No tracking.

## What it does

- Reads a step out loud when you tell it to, for example "Step 2 of 3. How can we reach you?"
- Uses the voice that is already in the browser (the Web Speech API).
- Can play your own recorded clips instead. If a clip fails, it reads the text with the browser voice.
- Speaks English, Spanish, or any language the device has a voice for.
- Stops when the visitor turns it off, switches tabs, or leaves the page.
- Remembers the visitor's choice on that device.
- Hides the button if the browser cannot speak. The form keeps working.

## Try it

Open `demo/index.html` in your browser. You do not need a server.
Tap **Listen**, then go through the 3 steps. Tap **ES** for Spanish.

## Use it

```html
<button id="listen" type="button" hidden>Listen</button>
<script src="step-narrator.js"></script>
<script>
  StepNarrator.bind(document.getElementById('listen'));   // the button turns the voice on and off
  StepNarrator.say('Step 1 of 3. What is your name?');     // call this each time a step opens
</script>
```

Call `say()` each time a new step shows. It does nothing while the voice is off, so you can call it every time.

## Recorded clips (optional)

Have a recording of a step? Pass its address. If it does not load, the text is read with the browser voice.

```js
StepNarrator.say('Step 1 of 3. What is your name?', { audio: '/audio/step-1.mp3' });
```

Several in a row:

```js
StepNarrator.sayAll([
  { text: 'Step 1 of 3.', audio: '/audio/step-1.mp3' },
  { text: 'What is your name?' }
]);
```

Using clips? Bind the button with `{ clips: true }`. Then it also shows in browsers that can play audio but have no voice.

## All the options

- `StepNarrator.bind(button)`: makes a button the on/off switch. It sets `aria-pressed` for screen readers. The button stays hidden if the browser has no voice. Add `{ clips: true }` if you use clips.
- `StepNarrator.say(text)`: reads the text now. It cuts off anything still playing.
- `StepNarrator.say(text, { audio: url })`: plays the clip, or reads the text if the clip fails.
- `StepNarrator.sayAll([{ text, audio }, ...])`: the same, one after the other.
- `StepNarrator.stop()`: stops now.
- `StepNarrator.setLang('es')`: the language of the browser voice. `'en'` means US English, `'es'` means US Spanish. You can also pass a full code like `'es-MX'` or `'fr-FR'`.
- `StepNarrator.setOn(true)`, `StepNarrator.toggle()`, `StepNarrator.isOn()`: turn it on or off, or check it.
- `StepNarrator.setDefault(true)`: start it on for visitors who never chose. Call it before `bind()`. Their own choice always wins.
- `StepNarrator.onChange(fn)`: runs `fn(isOn)` every time the visitor turns it on or off.
- `StepNarrator.setLocalOnly(true)`: only use voices that run on the device. See Privacy.
- `StepNarrator.supported`, `StepNarrator.canSpeak`, `StepNarrator.canPlay`: what the browser can do.

## Why it starts off

- Browsers block sound until the visitor taps or types. Nothing can play before that.
- People who use a screen reader already hear the page. A second voice would talk over it.
- Nobody wants a page to start talking in a quiet room.

You can start it on with `setDefault(true)`. Think about screen reader users first. The visitor can still turn it off, and that choice is remembered.

If the visitor turned it on before, it is on again next time. The browser may still wait for their first tap before it talks.

## Privacy

- The script itself makes no network calls. No cookies. No analytics.
- It saves one setting on the device: `stepNarrator.on` in `localStorage` (`1` = on, `0` = off).
- If you use clips, the browser downloads them from the address you give, like any audio file on your site.
- Some voices run on the browser maker's servers, not on the device. They often have "Google", "Online" or "Natural" in the name. With those voices, the browser sends the sentence to that company to turn it into sound. The script picks those voices first because they are clearer.
- Want the words to stay on the device? Call `StepNarrator.setLocalOnly(true)`. If the device has no voice for that language, that sentence is skipped.
- Read out your instructions only. Do not read back what the visitor typed.

## Browser support

The browser voice works in browsers that have the Web Speech API for speech (`speechSynthesis`). Most current browsers on phones and computers do. Some in-app browsers do not.
Voices depend on the device. A phone may not have a voice for every language. If there is no voice for a language, the browser reads it with its default voice.
If the browser cannot speak, `bind()` keeps the button hidden and `say()` does nothing.

Tested so far: Chromium on Windows with the built-in Microsoft voices, and the unit tests in Node.

## Tips

- Keep each step's text short. Some browsers stop after about 15 seconds of speech.
- Keep the button text the same ("Listen") when it is on. `aria-pressed` already tells screen readers it is on.
- When the visitor switches language, call `setLang()` and then `say()` again.
- Read error messages out loud too, like "Please type your name."

## Tests

```
node test/step-narrator.test.js
```

No install needed. The tests use a fake browser, so no sound plays.

## License

MIT. See [LICENSE](LICENSE).
