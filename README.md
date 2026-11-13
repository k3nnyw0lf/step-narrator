# step-narrator

Add a **Listen** button to any web form or app. When it is on, each step is read out loud.

For any business: bookings, quotes, sign-ups, checkouts, applications, surveys.
For any site: plain HTML, WordPress, Shopify, Webflow, or an app built with React, Vue, Svelte or Angular.

One small file. No server. No sign-up. No tracking.

## What it does

- Reads a step out loud when it appears, for example "Step 2 of 3. Pick a day."
- Uses the voice that is already in the browser (the Web Speech API).
- Can play your own recorded clips instead. If a clip fails, it reads the text.
- Speaks any language the device has a voice for. One page can mix languages.
- Stops when the visitor turns it off, switches tabs, or leaves the page.
- Remembers the visitor's choice on that device.
- Hides the button if the browser cannot speak. The form keeps working.

## Try it

Open these in your browser. You do not need a server.

- `demo/no-code.html`: a booking form that uses only HTML attributes.
- `demo/index.html`: a contact form in English and Spanish that uses the JavaScript API.

## Add it: no code

Good for site builders and plain HTML. You only add attributes.

```html
<button type="button" data-step-narrator hidden>Listen</button>

<div data-narrate>
  <p>Step 1 of 3</p>
  <h2>What do you need?</h2>
</div>

<script src="step-narrator.js"></script>
```

- `data-step-narrator` makes the button the on/off switch.
- `data-narrate` is read out loud each time it appears on screen, and again when its words change. Put it on the step title and short instructions.
- Error messages too: add `data-narrate` and they are read when they show.
- Want different words than the screen? `data-narrate="Your own sentence."`
- A recorded clip: `data-narrate-audio="/audio/step-1.mp3"`
- Language comes from the closest `lang` attribute, like `<html lang="es">` or `<div lang="fr">`.

Settings go on the script tag:

```html
<script src="step-narrator.js" data-default-on data-rate="0.9" data-storage-key="my-shop.voice"></script>
```

- `data-default-on`: start it on for visitors who never chose.
- `data-rate`: speed, from 0.5 (slow) to 2 (fast). Default 0.95.
- `data-storage-key`: the name used to remember the choice. Give each site or app its own.
- `data-local-only`: only use voices on the device. See Privacy.
- `data-watch`: keep watching even if the page has no attributes yet (for pages that load steps later).

## Add it: a few lines of JavaScript

```html
<button id="listen" type="button" hidden>Listen</button>
<script src="step-narrator.js"></script>
<script>
  StepNarrator.bind(document.getElementById('listen'));   // the button turns the voice on and off
  StepNarrator.say('Step 1 of 3. What is your name?');     // call this each time a step opens
</script>
```

`say()` does nothing while the voice is off, so you can call it every time.

## Add it to an app

React, Next.js, Vue, Svelte, Angular and others. See [docs/apps.md](docs/apps.md).

```
npm install github:k3nnyw0lf/step-narrator#v1.3.0
```

```js
import StepNarrator from 'step-narrator';
StepNarrator.watch();   // then use data-step-narrator and data-narrate in your components
```

It is safe on the server (server-side rendering): there it does nothing. TypeScript types are included.

## Make it yours

```js
StepNarrator.configure({
  rate: 0.9,                                // speed
  pitch: 1,                                 // 0 to 2
  volume: 1,                                // 0 to 1, also for clips
  lang: 'es',                               // language of the next sentences
  regions: { en: 'en-GB', es: 'es-ES' },    // what 'en' and 'es' mean (default US)
  storageKey: 'my-app.voice',               // where the choice is saved
  remember: true,                           // false = never save the choice
  defaultOn: false,                         // true = start on for new visitors
  localOnly: false,                         // true = only voices on the device
  voice: (voices, lang) => voices.find(v => v.name === 'Samantha')   // pick your own voice
});
```

The button is yours to style. `aria-pressed="true"` means it is on.

## Recorded clips

Have a recording of a step? Pass its address. If it does not load, the text is read with the browser voice.

```js
StepNarrator.say('Step 1 of 3. What is your name?', { audio: '/audio/step-1.mp3' });
StepNarrator.sayAll([
  { text: 'Step 1 of 3.', audio: '/audio/step-1.mp3' },
  { text: 'Paso 1 de 3.', lang: 'es' }
]);
```

Using clips with the JavaScript API? Bind with `StepNarrator.bind(button, { clips: true })`. Then the button also shows in browsers that can play audio but have no voice.

## All the options

- `bind(button, { clips })` / `unbind(button)`: the on/off switch. Unbind when your app removes the button.
- `say(text, { audio, lang })`: read now. It cuts off anything still playing.
- `sayAll([{ text, audio, lang }, ...])`: the same, one after the other.
- `stop()`: stop now.
- `watch(container)` / `unwatch()`: read `data-narrate` elements when they appear. Default: the whole page.
- `configure({...})`: the settings above.
- `setOn(true)`, `toggle()`, `isOn()`: turn it on or off, or check it.
- `setDefault(true)`: start it on for visitors who never chose. Their own choice always wins.
- `setLang('fr-CA')`, `setLocalOnly(true)`: short ways to set those two settings.
- `onChange(fn)`: runs `fn(isOn)` every time the visitor turns it on or off.
- `supported`, `canSpeak`, `canPlay`: what the browser can do.

## Why it starts off

- Browsers block sound until the visitor taps or types. Nothing can play before that.
- People who use a screen reader already hear the page. A second voice would talk over it.
- Nobody wants a page to start talking in a quiet room.

You can start it on with `defaultOn` or `data-default-on`. Think about screen reader users first. If the browser blocks the first sentence, step-narrator reads it again on the visitor's first tap or key. The visitor can still turn it off, and that choice is remembered.

## Privacy

- The script itself makes no network calls. No cookies. No analytics.
- It saves one setting on the device: `stepNarrator.on` in `localStorage` (`1` = on, `0` = off). Change the name with `storageKey`, or save nothing with `remember: false`.
- It reads only text on the page. It never reads what visitors type into fields.
- If you use clips, the browser downloads them from the address you give, like any audio file on your site.
- Some voices run on the browser maker's servers, not on the device. They often have "Google", "Online" or "Natural" in the name. With those voices, the browser sends the sentence to that company to turn it into sound. The script picks those voices first because they are clearer.
- Want the words to stay on the device? Use `localOnly: true`. If the device has no voice for that language, that sentence is skipped.
- Host `step-narrator.js` on your own site. Then no other company sees your visitors.

## Browser support

The browser voice works where the Web Speech API for speech (`speechSynthesis`) exists. Most current browsers on phones and computers have it. Some in-app browsers do not.
Voices depend on the device. A phone may not have a voice for every language. If there is no voice for a language, the browser reads it with its default voice.
If the browser cannot speak, the button stays hidden and nothing breaks.

Tested so far: Chrome on Windows (real clicks, built-in Microsoft voices, and headless runs of all three demos), and the unit tests in Node.

## Tips

- Keep each step's text short. Some browsers stop after about 15 seconds of speech.
- Keep the button text the same ("Listen") when it is on. `aria-pressed` already tells screen readers it is on.
- Put `data-narrate` on the title and short instructions, not on a whole form full of choices.
- Do not put one `data-narrate` inside another.
- Keep numbers that change by themselves (a timer, a live price) outside `data-narrate`, or they are read again each time they change.

## Tests

```
node test/step-narrator.test.js
```

No install needed. The tests use a fake browser, so no sound plays.

## License

MIT. See [LICENSE](LICENSE).
