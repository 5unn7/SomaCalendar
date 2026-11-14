/* One clock for every screen. Everything that asks "what time is it" asks SomaClock.now(), and everything that
 * must move with time subscribes to SomaClock.onTick(fn). Ticks land just after each minute boundary, and also
 * fire at once when the app comes back to the front, the window regains focus, the native shell says the clock
 * or time zone changed, or the wall clock jumps (a manual change, or the phone waking after the timer was frozen).
 * Tests move time with SomaClock.set(date) / advance(ms) and call SomaClock.tick() to flush.
 * ES2017 on purpose: older Android WebViews reject `??` and `?.`. */
(function (root) {
  'use strict';
  var offset = 0, listeners = [], timer = null, last = 0;
  var JUMP = 90000; // a gap this much off the expected minute means the clock moved under us

  function now() { return new Date(Date.now() + offset); }
  function ms() { return Date.now() + offset; }
  /* Calendar date (YYYY-MM-DD) in an IANA zone: the chosen place's, never the device's. */
  function dateKey(zone, at) {
    var p = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(at || now());
    var o = {}; p.forEach(function (x) { o[x.type] = x.value; });
    return o.year + '-' + o.month + '-' + o.day;
  }
  /* Runs every listener with (now, reason). reason: 'minute', 'resume', 'focus', 'clock', 'jump', 'manual'. */
  function tick(reason) {
    var t = ms();
    if (!reason) reason = last && Math.abs(t - last - 60000) > JUMP ? 'jump' : 'minute';
    last = t;
    var at = new Date(t);
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](at, reason); } catch (e) { if (root.console) console.error('Clock listener failed: ' + e.message); }
    }
    arm();
  }
  /* Next wake: 250 ms after the coming minute boundary, so "in 5 min" and the running Choghadiya turn on time. */
  function arm() {
    if (typeof setTimeout === 'undefined') return;
    clearTimeout(timer);
    var t = ms(), wait = 60000 - (t % 60000) + 250;
    timer = setTimeout(function () { tick(); }, wait);
  }
  function onTick(fn) { listeners.push(fn); if (!timer) { last = ms(); arm(); } return function () { listeners = listeners.filter(function (f) { return f !== fn; }); }; }
  /* Test hooks: pretend the clock reads `date`, or move it on. */
  function set(date) { offset = +date - Date.now(); }
  function advance(delta) { offset += delta; }
  function reset() { offset = 0; }

  var api = { now: now, ms: ms, dateKey: dateKey, tick: tick, onTick: onTick, set: set, advance: advance, reset: reset };
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('visibilitychange', function () { if (!document.hidden) tick('resume'); });
    root.addEventListener('focus', function () { tick('focus'); });
    root.addEventListener('pageshow', function () { tick('resume'); });
  }
  /* Called by the Android shell on onResume and on TIME_SET / TIMEZONE_CHANGED / DATE_CHANGED. */
  root.somaClockChanged = function (why) { tick(why === 'resume' ? 'resume' : 'clock'); };
  if (typeof module !== 'undefined') module.exports = api;
  root.SomaClock = api;
})(typeof window !== 'undefined' ? window : globalThis);
