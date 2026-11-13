/*! step-narrator 1.2.0 | MIT License
 * Reads each step of a web form out loud: a recorded clip when you have one, otherwise the
 * browser's own voice (Web Speech API). No server, no tracking. The visitor's on/off choice is
 * remembered on the device. Browsers block sound until the visitor taps or types, so nothing plays before that.
 *
 * API on window.StepNarrator:
 *   supported              true when the browser can speak or play a clip
 *   canSpeak / canPlay     true when the browser has a voice / can play audio files
 *   setDefault(on)         on/off for visitors who never chose (call before bind); their own choice always wins
 *   bind(button, {clips})  makes a <button> the on/off switch (sets aria-pressed). The button stays hidden
 *                          if the browser has no voice, unless you pass {clips: true} because you use clips
 *   toggle() / setOn(b)    turn it on or off (remembered on this device)
 *   isOn()                 current state
 *   setLang('en'|'es'|'es-MX'|...)  language of the browser voice ('en' = en-US, 'es' = es-US)
 *   setLocalOnly(b)        true = only use voices that run on the device; skip the sentence if there is none
 *   say(text, {audio})     play the clip at the audio address (falls back to speaking the text), replacing anything playing
 *   sayAll([{text, audio}, ...])  the same, one after the other
 *   stop()                 stop now
 *   onChange(fn)           fn(isOn) after every switch
 * say and sayAll do nothing while it is off.
 */
(function (root) {
  'use strict';
  if (!root) return;
  var KEY = 'stepNarrator.on';
  var synth = root.speechSynthesis;
  var canSpeak = !!(synth && root.SpeechSynthesisUtterance);
  var canPlay = typeof root.Audio === 'function';
  var supported = canSpeak || canPlay;
  var state = { on: false, lang: 'en-US', rate: 0.95, chosen: false, localOnly: false };
  var buttons = [], listeners = [], voices = [], audio = null, queue = [], seq = 0;

  try {
    var saved = root.localStorage.getItem(KEY);
    if (saved === '1' || saved === '0') { state.on = saved === '1'; state.chosen = true; }
  } catch (e) { /* private mode: no saved choice */ }

  function loadVoices() { try { voices = synth.getVoices() || []; } catch (e) { voices = []; } }
  if (canSpeak) {
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

  // Best browser voice: same language and region first, then the same language;
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

  function stop() {
    seq++; queue = [];
    if (audio) { try { audio.pause(); } catch (e) { } }
    if (canSpeak) { try { synth.cancel(); } catch (e) { } }
  }

  function next(my) {
    if (my !== seq || !queue.length) return;
    var item = queue.shift();
    var text = String(item.text == null ? '' : item.text).replace(/\s+/g, ' ').trim();
    var spoke = false;
    function speak() {
      if (spoke || my !== seq) return; // a failed clip can report twice (error event and play()); speak once
      spoke = true;
      var v = canSpeak && text ? pick(state.lang) : null;
      if (!canSpeak || !text || (!v && state.localOnly)) { next(my); return; }
      var u = new root.SpeechSynthesisUtterance(text);
      u.lang = state.lang; u.rate = state.rate;
      if (v) u.voice = v;
      u.onend = function () { next(my); };
      u.onerror = function () { next(my); };
      // Chrome sometimes drops a speak() that follows cancel() in the same tick.
      root.setTimeout(function () { if (my === seq) { try { synth.speak(u); } catch (e) { next(my); } } }, 60);
    }
    if (item.audio && canPlay) {
      // One element for the whole visit: phones let it play again once a tap has started it.
      if (!audio) { audio = new root.Audio(); audio.preload = 'auto'; }
      audio.onended = function () { if (my === seq) next(my); };
      audio.onerror = function () { speak(); };
      try {
        audio.src = item.audio;
        var p = audio.play();
        if (p && typeof p.catch === 'function') p.catch(function (err) { if (!err || err.name !== 'AbortError') speak(); });
      } catch (e) { speak(); }
      return;
    }
    speak();
  }

  function sayAll(items) {
    if (!supported || !state.on) return;
    stop();
    queue = (items || []).filter(function (x) { return x && (x.text || x.audio); });
    next(seq);
  }

  function paint() { buttons.forEach(function (b) { b.setAttribute('aria-pressed', state.on ? 'true' : 'false'); }); }
  function setOn(on) {
    state.on = !!on; state.chosen = true;
    try { root.localStorage.setItem(KEY, state.on ? '1' : '0'); } catch (e) { }
    if (!state.on) stop();
    paint();
    listeners.forEach(function (fn) { try { fn(state.on); } catch (e) { } });
  }

  function bind(btn, opt) {
    if (!btn) return;
    var usable = opt && opt.clips ? supported : canSpeak;
    if (!usable) { btn.hidden = true; return; }
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
    canSpeak: canSpeak,
    canPlay: canPlay,
    setDefault: function (on) { if (!state.chosen) { state.on = !!on; paint(); } },
    bind: bind,
    toggle: function () { setOn(!state.on); },
    setOn: setOn,
    isOn: function () { return supported && state.on; },
    setLang: function (l) { state.lang = full(l); },
    setLocalOnly: function (b) { state.localOnly = !!b; },
    say: function (text, opt) { sayAll([{ text: text, audio: opt && opt.audio }]); },
    sayAll: sayAll,
    stop: stop,
    onChange: function (fn) { if (typeof fn === 'function') listeners.push(fn); }
  };
})(typeof window !== 'undefined' ? window : null);
