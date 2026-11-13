/*! step-narrator 1.1.0 | MIT License
 * Reads each step of a web form out loud with the browser's own voice (Web Speech API).
 * No recordings, no server, no tracking, no network calls. Off until the visitor taps the button.
 *
 * API on window.StepNarrator:
 *   supported              true when the browser can speak
 *   bind(button)           makes a <button> the on/off switch (sets aria-pressed; hides it if the browser can't speak)
 *   toggle() / setOn(b)    turn the voice on or off (the choice is remembered on this device)
 *   isOn()                 current state
 *   setLang('en'|'es'|'es-MX'|...)  language for the next sentence ('en' = en-US, 'es' = es-US)
 *   setLocalOnly(b)        true = only use voices that run on the device; stay quiet if there is none
 *   say(text)              speak now, replacing anything still being read (does nothing while off)
 *   stop()                 stop talking
 *   onChange(fn)           fn(isOn) after every switch
 */
(function (root) {
  'use strict';
  if (!root) return;
  var KEY = 'stepNarrator.on';
  var synth = root.speechSynthesis;
  var supported = !!(synth && root.SpeechSynthesisUtterance);
  var state = { on: false, lang: 'en-US', rate: 0.95, localOnly: false };
  var buttons = [], listeners = [], voices = [];

  try { state.on = root.localStorage.getItem(KEY) === '1'; } catch (e) { /* private mode: start off */ }

  function loadVoices() { try { voices = synth.getVoices() || []; } catch (e) { voices = []; } }
  if (supported) {
    loadVoices();
    if (typeof synth.addEventListener === 'function') synth.addEventListener('voiceschanged', loadVoices);
    else synth.onvoiceschanged = loadVoices;
  }

  function full(l) {
    l = String(l || 'en').replace(/_/g, '-');
    if (/^es$/i.test(l)) return 'es-US';
    if (/^en$/i.test(l)) return 'en-US';
    return l;
  }
  function base(l) { return String(l || '').replace(/_/g, '-').split('-')[0].toLowerCase(); }

  // Best voice for a language: same language and region first, then the same language;
  // inside each group prefer the clearer "natural / online / Google" voices.
  // With localOnly, voices that run on the browser maker's servers are skipped.
  function pick(lang) {
    if (!voices.length) loadVoices();
    var want = lang.toLowerCase(), b = base(lang), good = /natural|online|google|premium|enhanced/i;
    var exact = [], same = [];
    voices.forEach(function (v) {
      if (state.localOnly && v.localService !== true) return;
      var vl = String(v.lang || '').replace(/_/g, '-').toLowerCase();
      if (vl === want) exact.push(v);
      else if (base(vl) === b) same.push(v);
    });
    var list = exact.length ? exact : same;
    for (var i = 0; i < list.length; i++) if (good.test(list[i].name)) return list[i];
    return list[0] || null;
  }

  function stop() { if (supported) { try { synth.cancel(); } catch (e) { } } }

  function say(text) {
    if (!supported || !state.on) return;
    text = String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
    if (!text) return;
    var v = pick(state.lang);
    if (!v && state.localOnly) return; // no on-device voice for this language: stay quiet
    stop();
    var u = new root.SpeechSynthesisUtterance(text);
    u.lang = state.lang; u.rate = state.rate;
    if (v) u.voice = v;
    // Chrome sometimes drops a speak() that follows cancel() in the same tick.
    root.setTimeout(function () { try { synth.speak(u); } catch (e) { } }, 60);
  }

  function paint() {
    buttons.forEach(function (b) { b.setAttribute('aria-pressed', state.on ? 'true' : 'false'); });
  }
  function setOn(on) {
    state.on = !!on;
    try { root.localStorage.setItem(KEY, state.on ? '1' : '0'); } catch (e) { }
    if (!state.on) stop();
    paint();
    listeners.forEach(function (fn) { try { fn(state.on); } catch (e) { } });
  }

  function bind(btn) {
    if (!btn) return;
    if (!supported) { btn.hidden = true; return; }
    btn.hidden = false;
    if (buttons.indexOf(btn) < 0) {
      buttons.push(btn);
      btn.addEventListener('click', function () { setOn(!state.on); });
    }
    paint();
  }

  // Never keep talking from a tab the visitor left.
  if (supported && root.document) {
    root.document.addEventListener('visibilitychange', function () { if (root.document.hidden) stop(); });
    root.addEventListener('pagehide', stop);
  }

  root.StepNarrator = {
    supported: supported,
    bind: bind,
    toggle: function () { setOn(!state.on); },
    setOn: setOn,
    isOn: function () { return supported && state.on; },
    setLang: function (l) { state.lang = full(l); },
    setLocalOnly: function (b) { state.localOnly = !!b; },
    say: say,
    stop: stop,
    onChange: function (fn) { if (typeof fn === 'function') listeners.push(fn); }
  };
})(typeof window !== 'undefined' ? window : null);
