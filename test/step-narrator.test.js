// Run with: node test/step-narrator.test.js
// No install needed. Uses a fake browser window, so no real voice plays.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const CODE = fs.readFileSync(path.join(__dirname, '..', 'step-narrator.js'), 'utf8');

function voice(name, lang, local) { return { name, lang, localService: local !== false }; }

function makeEnv(opts) {
  opts = opts || {};
  const store = Object.assign({}, opts.store);
  const listeners = { doc: {}, win: {} };
  const spoken = [];
  const timers = [];
  let cancels = 0;
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
  vm.runInNewContext(CODE, { window: win });
  return {
    N: win.StepNarrator, win, store, spoken,
    cancels: () => cancels,
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

test('loads without a window (server-side rendering)', () => {
  vm.runInNewContext(CODE, {});
});

test('browser without speech: unsupported, button hidden, say does nothing', () => {
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

test('private mode (storage blocked) starts off and does not crash', () => {
  const e = makeEnv({ storageThrows: true });
  assert.strictEqual(e.N.isOn(), false);
  e.N.setOn(true);
  assert.strictEqual(e.N.isOn(), true);
});

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

let failed = 0;
for (const [name, fn] of tests) {
  try { fn(); console.log('ok   ' + name); }
  catch (err) { failed++; console.log('FAIL ' + name + '\n     ' + err.message); }
}
console.log('\n' + (tests.length - failed) + ' of ' + tests.length + ' passed');
process.exit(failed ? 1 : 0);
