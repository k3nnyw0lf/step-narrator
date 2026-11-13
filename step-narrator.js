/*! step-narrator 1.3.0 | MIT License | https://github.com/k3nnyw0lf/step-narrator
 * Reads each step of a web form or app out loud: a recorded clip when you have one, otherwise the
 * browser's own voice (Web Speech API). No server, no tracking. Works as a plain <script>, with
 * HTML attributes only (no code), or imported in an app (CommonJS / bundlers, safe on the server).
 *
 * No code:  <button data-step-narrator hidden>Listen</button>  +  data-narrate on what should be read.
 *           Optional on the <script> tag: data-default-on, data-rate="0.9", data-local-only,
 *           data-storage-key="my-app.voice", data-watch.
 *
 * API on window.StepNarrator (or the module export):
 *   supported / canSpeak / canPlay   what the browser can do
 *   configure({rate, pitch, volume, lang, regions, storageKey, remember, localOnly, defaultOn, voice})
 *   bind(button, {clips}) / unbind(button)   the on/off switch (sets aria-pressed)
 *   toggle() / setOn(b) / isOn()     turn it on or off (remembered on this device)
 *   setDefault(on)                   on/off for visitors who never chose; their own choice always wins
 *   setLang('en'|'es'|'fr-CA'|...)   language of the browser voice
 *   setLocalOnly(b)                  only use voices that run on the device
 *   say(text, {audio, lang})         play the clip (or speak the text), replacing anything playing
 *   sayAll([{text, audio, lang}, ...])  the same, one after the other
 *   stop()                           stop now
 *   onChange(fn)                     fn(isOn) after every switch
 *   watch(container) / unwatch()     read [data-narrate] elements when they appear
 * say and sayAll do nothing while it is off.
 */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module && module.exports) module.exports = api;
  if (root) root.StepNarrator = api;
})(typeof window !== 'undefined' ? window : null, function (root) {
  'use strict';
  var doc = root ? root.document : null;
  var synth = root ? root.speechSynthesis : null;
  var canSpeak = !!(synth && root.SpeechSynthesisUtterance);
  var canPlay = !!root && typeof root.Audio === 'function';
  var supported = canSpeak || canPlay;
  var opt = {
    rate: 0.95, pitch: 1, volume: 1, storageKey: 'stepNarrator.on', remember: true,
    regions: { en: 'en-US', es: 'es-US' }, localOnly: false, voice: null
  };
  var state = { on: false, def: false, chosen: false, lang: 'en-US' };
  var buttons = [], handlers = [], listeners = [], voices = [], audio = null, queue = [], seq = 0;
  var lastItems = [], replayArmed = false;
  var observer = null, seen = null, scope = null, scanTimer = null;

  // ---- settings

  function readSaved() {
    state.on = state.def; state.chosen = false;
    if (!opt.remember) return;
    try {
      var saved = root.localStorage.getItem(opt.storageKey);
      if (saved === '1' || saved === '0') { state.on = saved === '1'; state.chosen = true; }
    } catch (e) { /* private mode or no storage: no saved choice */ }
  }
  readSaved();

  function num(v, lo, hi, fallback) {
    v = Number(v);
    return isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;
  }

  function configure(o) {
    o = o || {};
    if (o.rate != null) opt.rate = num(o.rate, 0.1, 10, opt.rate);
    if (o.pitch != null) opt.pitch = num(o.pitch, 0, 2, opt.pitch);
    if (o.volume != null) opt.volume = num(o.volume, 0, 1, opt.volume);
    if (o.regions && typeof o.regions === 'object') {
      for (var k in o.regions) if (Object.prototype.hasOwnProperty.call(o.regions, k)) opt.regions[k.toLowerCase()] = String(o.regions[k]);
    }
    if (o.lang) state.lang = full(o.lang);
    if ('localOnly' in o) opt.localOnly = !!o.localOnly;
    if ('voice' in o) opt.voice = typeof o.voice === 'function' ? o.voice : null;
    if ('defaultOn' in o) state.def = !!o.defaultOn;
    var reread = false;
    if (typeof o.storageKey === 'string' && o.storageKey) { opt.storageKey = o.storageKey; reread = true; }
    if ('remember' in o) { opt.remember = !!o.remember; reread = true; }
    if (reread) readSaved(); else if (!state.chosen) state.on = state.def;
    paint();
    return api;
  }

  // ---- voices

  function loadVoices() { try { voices = synth.getVoices() || []; } catch (e) { voices = []; } }
  if (canSpeak) {
    loadVoices();
    if (typeof synth.addEventListener === 'function') synth.addEventListener('voiceschanged', loadVoices);
    else synth.onvoiceschanged = loadVoices;
  }

  // 'en' -> 'en-US' (or whatever regions says); full tags like 'fr-CA' stay as they are.
  function full(l) {
    l = String(l || 'en').replace(/_/g, '-');
    var r = opt.regions[l.toLowerCase()];
    return l.indexOf('-') < 0 && r ? r : l;
  }
  function base(l) { return String(l || '').replace(/_/g, '-').split('-')[0].toLowerCase(); }

  // Best browser voice: your own picker first; then same language and region, then the same
  // language; inside each group prefer the clearer "natural / online / Google" voices.
  // With localOnly, voices that run on the browser maker's servers are skipped.
  function pick(lang) {
    if (!voices.length) loadVoices();
    if (opt.voice) { try { var mine = opt.voice(voices.slice(), lang); if (mine) return mine; } catch (e) { } }
    var want = lang.toLowerCase(), b = base(lang), good = /natural|online|google|premium|enhanced/i;
    var exact = [], same = [];
    voices.forEach(function (v) {
      if (opt.localOnly && v.localService !== true) return;
      var vl = String(v.lang || '').replace(/_/g, '-').toLowerCase();
      if (vl === want) exact.push(v);
      else if (base(vl) === b) same.push(v);
    });
    var list = exact.length ? exact : same;
    for (var i = 0; i < list.length; i++) if (good.test(list[i].name)) return list[i];
    return list[0] || null;
  }

  // ---- playing

  function stop() {
    seq++; queue = [];
    disarmReplay();
    if (audio) { try { audio.pause(); } catch (e) { } }
    if (canSpeak) { try { synth.cancel(); } catch (e) { } }
  }

  function next(my) {
    if (my !== seq || !queue.length) return;
    var item = queue.shift();
    var text = String(item.text == null ? '' : item.text).replace(/\s+/g, ' ').trim();
    var lang = item.lang ? full(item.lang) : state.lang;
    var spoke = false;
    function speak() {
      if (spoke || my !== seq) return; // a failed clip can report twice (error event and play()); speak once
      spoke = true;
      var v = canSpeak && text ? pick(lang) : null;
      if (!canSpeak || !text || (!v && opt.localOnly)) { next(my); return; }
      var u = new root.SpeechSynthesisUtterance(text);
      u.lang = lang; u.rate = opt.rate; u.pitch = opt.pitch; u.volume = opt.volume;
      if (v) u.voice = v;
      u.onend = function () { next(my); };
      u.onerror = function (e) {
        // The browser wants a tap first (voice on by default, or a remembered "on"): try again on the next tap or key.
        if (e && e.error === 'not-allowed' && my === seq) { armReplay(); return; }
        next(my);
      };
      // Chrome sometimes drops a speak() that follows cancel() in the same tick.
      root.setTimeout(function () { if (my === seq) { try { synth.speak(u); } catch (e) { next(my); } } }, 60);
    }
    if (item.audio && canPlay) {
      // One element for the whole visit: phones let it play again once a tap has started it.
      if (!audio) { audio = new root.Audio(); audio.preload = 'auto'; }
      audio.volume = opt.volume;
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
    lastItems = (items || []).filter(function (x) { return x && (x.text || x.audio); });
    queue = lastItems.slice();
    next(seq);
  }

  function replay() {
    disarmReplay();
    if (state.on && lastItems.length) sayAll(lastItems);
  }
  function armReplay() {
    if (replayArmed || !doc) return;
    replayArmed = true;
    doc.addEventListener('click', replay, true);
    doc.addEventListener('keydown', replay, true);
  }
  function disarmReplay() {
    if (!replayArmed) return;
    replayArmed = false;
    doc.removeEventListener('click', replay, true);
    doc.removeEventListener('keydown', replay, true);
  }

  // ---- the switch

  function paint() { buttons.forEach(function (b) { b.setAttribute('aria-pressed', state.on ? 'true' : 'false'); }); }
  function setOn(on) {
    state.on = !!on; state.chosen = true;
    if (opt.remember) { try { root.localStorage.setItem(opt.storageKey, state.on ? '1' : '0'); } catch (e) { } }
    if (!state.on) stop();
    paint();
    if (state.on && observer) sayAll(visibleItems());
    listeners.forEach(function (fn) { try { fn(state.on); } catch (e) { } });
  }

  function bind(btn, o) {
    if (!btn) return;
    var usable = o && o.clips ? supported : canSpeak;
    if (!usable) { btn.hidden = true; return; }
    btn.hidden = false;
    if (buttons.indexOf(btn) < 0) {
      var h = function () { setOn(!state.on); };
      buttons.push(btn); handlers.push(h);
      btn.addEventListener('click', h);
    }
    paint();
  }
  function unbind(btn) {
    var i = buttons.indexOf(btn);
    if (i < 0) return;
    btn.removeEventListener('click', handlers[i]);
    buttons.splice(i, 1); handlers.splice(i, 1);
  }

  // ---- no-code mode: read [data-narrate] elements when they appear

  var SKIP = 'input,select,textarea,option,button,script,style,template,[hidden],[aria-hidden="true"],[data-narrate-skip]';
  function matches(el, sel) { var m = el.matches || el.msMatchesSelector; return m ? m.call(el, sel) : false; }

  function shown(el) {
    if (!doc.documentElement.contains(el)) return false;
    if (el.closest && el.closest('[hidden],[aria-hidden="true"]')) return false;
    if (!el.getClientRects().length) return false;
    return root.getComputedStyle(el).visibility !== 'hidden';
  }

  // The words the visitor can see, one sentence per line or block. Never what they typed.
  function collect(node, out) {
    if (node.nodeType === 3) { out.push(node.nodeValue); return; }
    if (node.nodeType !== 1 || matches(node, SKIP)) return;
    if (node.tagName === 'BR') { out.push('\n'); return; }
    var cs = root.getComputedStyle(node);
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    var block = !/^inline/.test(cs.display);
    if (block) out.push('\n');
    for (var c = node.firstChild; c; c = c.nextSibling) collect(c, out);
    if (block) out.push('\n');
  }
  function textOf(el) {
    var own = el.getAttribute('data-narrate');
    if (own && /\S/.test(own)) return own;
    var out = [];
    for (var c = el.firstChild; c; c = c.nextSibling) collect(c, out);
    return out.join('').split(/\n+/).map(function (s) { return s.replace(/\s+/g, ' ').trim(); })
      .filter(Boolean).map(function (s) { return /[.?!:;…。？！]$/.test(s) ? s : s + '.'; }).join(' ');
  }
  function itemOf(el) {
    var l = el.closest ? el.closest('[lang]') : null;
    return { text: textOf(el), audio: el.getAttribute('data-narrate-audio') || undefined, lang: l ? l.getAttribute('lang') : undefined };
  }
  function outermost(list) {
    return list.filter(function (el) { return !list.some(function (o) { return o !== el && o.contains(el); }); });
  }
  function visibleItems() {
    if (!observer) return [];
    var els = (scope || doc).querySelectorAll('[data-narrate]'), vis = [];
    for (var i = 0; i < els.length; i++) if (shown(els[i])) vis.push(els[i]);
    return outermost(vis).map(itemOf);
  }

  function scan(announce) {
    var where = scope || doc;
    // Buttons that appear later (apps render after load) and buttons that left the page.
    var btns = where.querySelectorAll('[data-step-narrator]'), clips = !!where.querySelector('[data-narrate-audio]');
    for (var i = 0; i < btns.length; i++) if (buttons.indexOf(btns[i]) < 0) bind(btns[i], { clips: clips || btns[i].hasAttribute('data-clips') });
    buttons.slice().forEach(function (b) { if (!doc.documentElement.contains(b)) unbind(b); });

    // Read an element when it appears, and again when its words change (apps often reuse the
    // same element for the next step, or switch its language in place).
    var els = where.querySelectorAll('[data-narrate]'), fresh = [], items = [];
    for (var j = 0; j < els.length; j++) {
      var el = els[j], item = shown(el) ? itemOf(el) : null;
      var key = item ? item.text + '|' + (item.audio || '') + '|' + (item.lang || '') : '';
      if (item && key !== seen.get(el)) { fresh.push(el); items.push(item); }
      seen.set(el, key);
    }
    var keep = outermost(fresh);
    if (announce && keep.length) sayAll(items.filter(function (it, n) { return keep.indexOf(fresh[n]) >= 0; }));
  }
  function schedule() {
    if (scanTimer) return;
    // Wait a moment so the app finishes drawing the new step.
    scanTimer = root.setTimeout(function () { scanTimer = null; if (observer) scan(true); }, 40);
  }

  function watch(container) {
    if (!doc || typeof root.MutationObserver !== 'function' || typeof root.WeakMap !== 'function') return;
    unwatch();
    scope = container || null;
    seen = new root.WeakMap();
    observer = new root.MutationObserver(schedule);
    observer.observe(scope || doc.documentElement, {
      subtree: true, childList: true, characterData: true, attributes: true,
      attributeFilter: ['hidden', 'class', 'style', 'aria-hidden', 'open', 'lang', 'data-narrate', 'data-narrate-audio']
    });
    scan(true);
  }
  function unwatch() {
    if (observer) observer.disconnect();
    observer = null; seen = null; scope = null;
    if (scanTimer) { root.clearTimeout(scanTimer); scanTimer = null; }
  }

  // Never keep talking from a tab the visitor left.
  if (supported && doc) {
    doc.addEventListener('visibilitychange', function () { if (doc.hidden) stop(); });
    root.addEventListener('pagehide', stop);
  }

  var api = {
    supported: supported,
    canSpeak: canSpeak,
    canPlay: canPlay,
    configure: configure,
    setDefault: function (on) { state.def = !!on; if (!state.chosen) { state.on = state.def; paint(); } },
    bind: bind,
    unbind: unbind,
    toggle: function () { setOn(!state.on); },
    setOn: setOn,
    isOn: function () { return supported && state.on; },
    setLang: function (l) { state.lang = full(l); },
    setLocalOnly: function (b) { opt.localOnly = !!b; },
    say: function (text, o) { sayAll([{ text: text, audio: o && o.audio, lang: o && o.lang }]); },
    sayAll: sayAll,
    stop: stop,
    onChange: function (fn) { if (typeof fn === 'function') listeners.push(fn); },
    watch: watch,
    unwatch: unwatch
  };

  // Settings on the <script> tag, then no-code mode when the page uses the data attributes.
  if (doc) {
    var me = doc.currentScript, flag = function (n) { var v = me.getAttribute(n); return v !== null && v !== 'false' && v !== '0'; };
    if (me && me.getAttribute) {
      var o = {};
      if (me.hasAttribute('data-default-on')) o.defaultOn = flag('data-default-on');
      if (me.hasAttribute('data-local-only')) o.localOnly = flag('data-local-only');
      if (me.getAttribute('data-rate')) o.rate = me.getAttribute('data-rate');
      if (me.getAttribute('data-storage-key')) o.storageKey = me.getAttribute('data-storage-key');
      configure(o);
    }
    var forceWatch = !!(me && me.hasAttribute && me.hasAttribute('data-watch'));
    var start = function () {
      if (forceWatch || doc.querySelector('[data-step-narrator],[data-narrate]')) watch();
    };
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start); else start();
  }

  return api;
});
