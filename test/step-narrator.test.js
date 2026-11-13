// Run with: node test/step-narrator.test.js
// No install needed. Uses a fake browser window, so no real sound plays.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const FILE = process.env.STEP_NARRATOR_FILE || path.join(__dirname, '..', 'step-narrator.js');
const CODE = fs.readFileSync(FILE, 'utf8');
const tick = () => new Promise((r) => setImmediate(r));

function voice(name, lang, local) { return { name, lang, localService: local !== false }; }

// opts.clips: { 'url': 'ok' | 'missing' } decides what the fake audio player does with each file.
function makeEnv(opts) {
  opts = opts || {};
  const store = Object.assign({}, opts.store);
  const listeners = { doc: {}, win: {} };
  const spoken = [], played = [], timers = [];
  let cancels = 0, pauses = 0, audioEl = null;
  const on = (bag) => (type, fn) => { (bag[type] = bag[type] || []).push(fn); };
  const win = {
    setTimeout: (fn) => { timers.push(fn); },
    addEventListener: on(listeners.win),
    document: { hidden: false, addEventListener: on(listeners.doc) },
    localStorage: opts.storageThrows
      ? { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } }
      : { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } }
  };
  if (!opts.noSpeech) {
    win.speechSynthesis = {
      getVoices: () => opts.voices || [],
      addEventListener() {},
      speak: (u) => spoken.push(u),
      cancel: () => { cancels++; }
    };
    win.SpeechSynthesisUtterance = function (text) { this.text = text; };
  }
  if (opts.clips) {
    win.Audio = function () { audioEl = this; };
    win.Audio.prototype.pause = function () { pauses++; };
    win.Audio.prototype.play = function () {
      const src = this.src;
      played.push(src);
      if (opts.clips[src] === 'missing') {
        // What Chrome does with a file that is not there: an error event AND a rejected play().
        setImmediate(() => { if (this.onerror) this.onerror(); });
        return Promise.reject(Object.assign(new Error('no source'), { name: 'NotSupportedError' }));
      }
      return Promise.resolve();
    };
  }
  vm.runInNewContext(CODE, { window: win });
  return {
    N: win.StepNarrator, win, store, spoken, played,
    cancels: () => cancels, pauses: () => pauses, audio: () => audioEl,
    flush() { while (timers.length) timers.shift()(); },
    fire(where, type) { (listeners[where][type] || []).forEach((fn) => fn()); }
  };
}

function makeButton() {
  const attrs = {}, clicks = [];
  return {
    hidden: true, clicks,
    setAttribute(k, v) { attrs[k] = String(v); },
    getAttribute(k) { return k in attrs ? attrs[k] : null; },
    addEventListener(type, fn) { if (type === 'click') clicks.push(fn); },
    click() { clicks.forEach((fn) => fn()); }
  };
}

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

// ---- switch and memory

test('loads without a window (server-side rendering)', () => {
  vm.runInNewContext(CODE, {});
});

test('browser with no voice and no audio: unsupported, button hidden, say does nothing', () => {
  const e = makeEnv({ noSpeech: true });
  const b = makeButton(); b.hidden = false;
  assert.strictEqual(e.N.supported, false);
  e.N.bind(b);
  assert.strictEqual(b.hidden, true);
  e.N.setOn(true);
  assert.strictEqual(e.N.isOn(), false);
  e.N.say('hello'); e.flush();
  assert.strictEqual(e.spoken.length, 0);
});

test('audio but no voice: button hidden for text-only pages, shown with {clips: true}', () => {
  const e = makeEnv({ noSpeech: true, clips: {} });
  assert.strictEqual(e.N.supported, true);
  assert.strictEqual(e.N.canSpeak, false);
  assert.strictEqual(e.N.canPlay, true);
  const a = makeButton(), b = makeButton();
  e.N.bind(a);
  assert.strictEqual(a.hidden, true);
  e.N.bind(b, { clips: true });
  assert.strictEqual(b.hidden, false);
});

test('starts off and stays quiet until turned on', () => {
  const e = makeEnv();
  assert.strictEqual(e.N.isOn(), false);
  e.N.say('Step 1 of 3'); e.flush();
  assert.strictEqual(e.spoken.length, 0);
});

test('bind shows the button, sets aria-pressed, click toggles and remembers', () => {
  const e = makeEnv();
  const b = makeButton();
  const seen = [];
  e.N.onChange((on) => seen.push(on));
  e.N.bind(b);
  assert.strictEqual(b.hidden, false);
  assert.strictEqual(b.getAttribute('aria-pressed'), 'false');
  b.click();
  assert.strictEqual(e.N.isOn(), true);
  assert.strictEqual(b.getAttribute('aria-pressed'), 'true');
  assert.strictEqual(e.store['stepNarrator.on'], '1');
  b.click();
  assert.strictEqual(e.N.isOn(), false);
  assert.strictEqual(e.store['stepNarrator.on'], '0');
  assert.deepStrictEqual(seen, [true, false]);
});

test('binding the same button twice adds one click handler', () => {
  const e = makeEnv();
  const b = makeButton();
  e.N.bind(b); e.N.bind(b);
  assert.strictEqual(b.clicks.length, 1);
});

test('remembers "on" from a past visit', () => {
  const e = makeEnv({ store: { 'stepNarrator.on': '1' } });
  assert.strictEqual(e.N.isOn(), true);
});

test('setDefault(true) turns it on for a visitor who never chose', () => {
  const e = makeEnv();
  e.N.setDefault(true);
  assert.strictEqual(e.N.isOn(), true);
  assert.strictEqual(e.store['stepNarrator.on'], undefined, 'a default is not saved as their choice');
});

test('setDefault never overrides the visitor\'s own choice', () => {
  const e = makeEnv({ store: { 'stepNarrator.on': '0' } });
  e.N.setDefault(true);
  assert.strictEqual(e.N.isOn(), false);
  const f = makeEnv();
  f.N.setOn(false); f.N.setDefault(true);
  assert.strictEqual(f.N.isOn(), false);
});

test('private mode (storage blocked) starts off and does not crash', () => {
  const e = makeEnv({ storageThrows: true });
  assert.strictEqual(e.N.isOn(), false);
  e.N.setOn(true);
  assert.strictEqual(e.N.isOn(), true);
});

// ---- browser voice

test('say cancels old speech, cleans spaces, uses en-US by default', () => {
  const e = makeEnv();
  e.N.setOn(true);
  const before = e.cancels();
  e.N.say('  Step 1 of 3.\n   What is   your name? ');
  assert.strictEqual(e.cancels(), before + 1);
  assert.strictEqual(e.spoken.length, 0, 'speaks after a short delay, not in the same tick');
  e.flush();
  assert.strictEqual(e.spoken.length, 1);
  assert.strictEqual(e.spoken[0].text, 'Step 1 of 3. What is your name?');
  assert.strictEqual(e.spoken[0].lang, 'en-US');
  assert.strictEqual(e.spoken[0].rate, 0.95);
});

test('empty text says nothing', () => {
  const e = makeEnv();
  e.N.setOn(true);
  e.N.say('   '); e.N.say(null); e.flush();
  assert.strictEqual(e.spoken.length, 0);
});

test('setLang("es") means es-US and prefers the clearer voice', () => {
  const e = makeEnv({ voices: [voice('Basic Spanish', 'es-US'), voice('Google español de Estados Unidos', 'es-US', false), voice('Paulina', 'es-MX')] });
  e.N.setOn(true); e.N.setLang('es'); e.N.say('Paso 1 de 3'); e.flush();
  assert.strictEqual(e.spoken[0].lang, 'es-US');
  assert.strictEqual(e.spoken[0].voice.name, 'Google español de Estados Unidos');
});

test('falls back to another region of the same language', () => {
  const e = makeEnv({ voices: [voice('Paulina', 'es-MX'), voice('Daniel', 'en-GB')] });
  e.N.setOn(true); e.N.setLang('es'); e.N.say('Hola'); e.flush();
  assert.strictEqual(e.spoken[0].voice.name, 'Paulina');
});

test('three-letter language codes match by language, not by first two letters', () => {
  const e = makeEnv({ voices: [voice('Finnish', 'fi-FI'), voice('Filipino', 'fil-PH')] });
  e.N.setOn(true); e.N.setLang('fil'); e.N.say('Kumusta'); e.flush();
  assert.strictEqual(e.spoken[0].voice.name, 'Filipino');
});

test('accepts underscores in language tags', () => {
  const e = makeEnv({ voices: [voice('Paulina', 'es_MX')] });
  e.N.setOn(true); e.N.setLang('es_MX'); e.N.say('Hola'); e.flush();
  assert.strictEqual(e.spoken[0].lang, 'es-MX');
  assert.strictEqual(e.spoken[0].voice.name, 'Paulina');
});

test('setLocalOnly skips online voices', () => {
  const e = makeEnv({ voices: [voice('Google US English', 'en-US', false), voice('Microsoft Zira', 'en-US', true)] });
  e.N.setOn(true); e.N.setLocalOnly(true); e.N.say('Hello'); e.flush();
  assert.strictEqual(e.spoken[0].voice.name, 'Microsoft Zira');
});

test('setLocalOnly stays quiet when no on-device voice exists', () => {
  const e = makeEnv({ voices: [voice('Google US English', 'en-US', false)] });
  e.N.setOn(true); e.N.setLocalOnly(true); e.N.say('Hello'); e.flush();
  assert.strictEqual(e.spoken.length, 0);
});

// ---- queue and clips

test('sayAll reads items in order, each after the last one ends', () => {
  const e = makeEnv();
  e.N.setOn(true);
  e.N.sayAll([{ text: 'One' }, { text: 'Two' }, null, { text: '' }, { text: 'Three' }]);
  e.flush();
  assert.deepStrictEqual(e.spoken.map((u) => u.text), ['One']);
  e.spoken[0].onend(); e.flush();
  e.spoken[1].onend(); e.flush();
  assert.deepStrictEqual(e.spoken.map((u) => u.text), ['One', 'Two', 'Three']);
});

test('a voice error moves on to the next item', () => {
  const e = makeEnv();
  e.N.setOn(true);
  e.N.sayAll([{ text: 'One' }, { text: 'Two' }]);
  e.flush(); e.spoken[0].onerror(); e.flush();
  assert.deepStrictEqual(e.spoken.map((u) => u.text), ['One', 'Two']);
});

test('a clip plays instead of the voice, then the queue moves on', async () => {
  const e = makeEnv({ clips: { 'a.mp3': 'ok' } });
  e.N.setOn(true);
  e.N.sayAll([{ text: 'Step one', audio: 'a.mp3' }, { text: 'Step two' }]);
  await tick(); e.flush();
  assert.deepStrictEqual(e.played, ['a.mp3']);
  assert.strictEqual(e.spoken.length, 0);
  e.audio().onended(); e.flush();
  assert.deepStrictEqual(e.spoken.map((u) => u.text), ['Step two']);
});

test('a missing clip falls back to the voice ONCE (error event and play() both report it)', async () => {
  const e = makeEnv({ clips: { 'gone.mp3': 'missing' } });
  e.N.setOn(true);
  e.N.sayAll([{ text: 'Step one', audio: 'gone.mp3' }, { text: 'Step two' }]);
  await tick(); await tick(); e.flush();
  assert.deepStrictEqual(e.spoken.map((u) => u.text), ['Step one']);
  e.spoken[0].onend(); e.flush();
  assert.deepStrictEqual(e.spoken.map((u) => u.text), ['Step one', 'Step two']);
});

test('stop() empties the queue and pauses the clip', async () => {
  const e = makeEnv({ clips: { 'a.mp3': 'ok' } });
  e.N.setOn(true);
  e.N.sayAll([{ text: 'One', audio: 'a.mp3' }, { text: 'Two' }]);
  await tick();
  const p = e.pauses();
  e.N.stop();
  assert.strictEqual(e.pauses(), p + 1);
  e.audio().onended(); e.flush();
  assert.strictEqual(e.spoken.length, 0);
});

// ---- staying polite

test('turning off, hiding the tab, or leaving the page stops the voice', () => {
  const e = makeEnv();
  e.N.setOn(true);
  let c = e.cancels();
  e.N.setOn(false);
  assert.strictEqual(e.cancels(), c + 1);
  c = e.cancels();
  e.win.document.hidden = true; e.fire('doc', 'visibilitychange');
  assert.strictEqual(e.cancels(), c + 1);
  c = e.cancels();
  e.fire('win', 'pagehide');
  assert.strictEqual(e.cancels(), c + 1);
});

test('a listener that throws does not break the switch', () => {
  const e = makeEnv();
  e.N.onChange(() => { throw new Error('boom'); });
  e.N.setOn(true);
  assert.strictEqual(e.N.isOn(), true);
});

(async () => {
  let failed = 0;
  for (const [name, fn] of tests) {
    try { await fn(); console.log('ok   ' + name); }
    catch (err) { failed++; console.log('FAIL ' + name + '\n     ' + err.message); }
  }
  console.log('\n' + (tests.length - failed) + ' of ' + tests.length + ' passed');
  process.exit(failed ? 1 : 0);
})();
