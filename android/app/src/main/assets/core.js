(function(root) {
  const A = typeof Astronomy !== "undefined" ? Astronomy : require("astronomy-engine");
  const names = ["\u0AAA\u0AA1\u0AB5\u0ACB", "\u0AAC\u0AC0\u0A9C", "\u0AA4\u0ACD\u0AB0\u0AC0\u0A9C", "\u0A9A\u0ACB\u0AA5", "\u0AAA\u0ABE\u0A82\u0A9A\u0AAE", "\u0A9B\u0AA0", "\u0AB8\u0ABE\u0AA4\u0AAE", "\u0A86\u0AA0\u0AAE", "\u0AA8\u0ACB\u0AAE", "\u0AA6\u0AB6\u0AAE", "\u0A85\u0A97\u0ABF\u0AAF\u0ABE\u0AB0\u0AB8", "\u0AAC\u0ABE\u0AB0\u0AB8", "\u0AA4\u0AC7\u0AB0\u0AB8", "\u0A9A\u0ACC\u0AA6\u0AB6", "\u0AAA\u0AC2\u0AA8\u0AAE"];
  const months = ["\u0A9A\u0AC8\u0AA4\u0ACD\u0AB0", "\u0AB5\u0AC8\u0AB6\u0ABE\u0A96", "\u0A9C\u0AC7\u0AA0", "\u0A85\u0AB7\u0ABE\u0AA2", "\u0AB6\u0ACD\u0AB0\u0ABE\u0AB5\u0AA3", "\u0AAD\u0ABE\u0AA6\u0AB0\u0AB5\u0ACB", "\u0A86\u0AB8\u0ACB", "\u0A95\u0ABE\u0AB0\u0AA4\u0A95", "\u0AAE\u0ABE\u0A97\u0AB6\u0AB0", "\u0AAA\u0ACB\u0AB7", "\u0AAE\u0AB9\u0ABE", "\u0AAB\u0ABE\u0A97\u0AA3"];
  const nak = ["\u0A85\u0AB6\u0ACD\u0AB5\u0ABF\u0AA8\u0AC0", "\u0AAD\u0AB0\u0AA3\u0AC0", "\u0A95\u0AC3\u0AA4\u0ACD\u0AA4\u0ABF\u0A95\u0ABE", "\u0AB0\u0ACB\u0AB9\u0ABF\u0AA3\u0AC0", "\u0AAE\u0AC3\u0A97\u0AB6\u0AC0\u0AB0\u0ACD\u0AB7", "\u0A86\u0AB0\u0ACD\u0AA6\u0ACD\u0AB0\u0ABE", "\u0AAA\u0AC1\u0AA8\u0AB0\u0ACD\u0AB5\u0AB8\u0AC1", "\u0AAA\u0AC1\u0AB7\u0ACD\u0AAF", "\u0A86\u0AB6\u0ACD\u0AB2\u0AC7\u0AB7\u0ABE", "\u0AAE\u0A98\u0ABE", "\u0AAA\u0AC2\u0AB0\u0ACD\u0AB5\u0ABE \u0AAB\u0ABE\u0AB2\u0ACD\u0A97\u0AC1\u0AA8\u0AC0", "\u0A89\u0AA4\u0ACD\u0AA4\u0AB0\u0ABE \u0AAB\u0ABE\u0AB2\u0ACD\u0A97\u0AC1\u0AA8\u0AC0", "\u0AB9\u0AB8\u0ACD\u0AA4", "\u0A9A\u0ABF\u0AA4\u0ACD\u0AB0\u0ABE", "\u0AB8\u0ACD\u0AB5\u0ABE\u0AA4\u0ABF", "\u0AB5\u0ABF\u0AB6\u0ABE\u0A96\u0ABE", "\u0A85\u0AA8\u0AC1\u0AB0\u0ABE\u0AA7\u0ABE", "\u0A9C\u0ACD\u0AAF\u0AC7\u0AB7\u0ACD\u0AA0\u0ABE", "\u0AAE\u0AC2\u0AB3", "\u0AAA\u0AC2\u0AB0\u0ACD\u0AB5\u0ABE\u0AB7\u0ABE\u0AA2\u0ABE", "\u0A89\u0AA4\u0ACD\u0AA4\u0AB0\u0ABE\u0AB7\u0ABE\u0AA2\u0ABE", "\u0AB6\u0ACD\u0AB0\u0AB5\u0AA3", "\u0AA7\u0AA8\u0ABF\u0AB7\u0ACD\u0AA0\u0ABE", "\u0AB6\u0AA4\u0AAD\u0ABF\u0AB7\u0ABE", "\u0AAA\u0AC2\u0AB0\u0ACD\u0AB5\u0ABE \u0AAD\u0ABE\u0AA6\u0ACD\u0AB0\u0AAA\u0AA6\u0ABE", "\u0A89\u0AA4\u0ACD\u0AA4\u0AB0\u0ABE \u0AAD\u0ABE\u0AA6\u0ACD\u0AB0\u0AAA\u0AA6\u0ABE", "\u0AB0\u0AC7\u0AB5\u0AA4\u0AC0"];
  const mod = (x) => (x % 360 + 360) % 360;
  function parts(d, z) {
    return Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: z, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(d).filter((x) => x.type !== "literal").map((x) => [x.type, x.value]));
  }
  function instant(day, time, z) {
    const target = Date.parse(day + "T" + time + ":00Z");
    let t = target;
    for (let i = 0; i < 4; i++) {
      const p = parts(new Date(t), z);
      t += target - Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
    }
    return new Date(t);
  }
  function dateKey(d, z) {
    const p = parts(d, z);
    return `${p.year}-${p.month}-${p.day}`;
  }
  function addDay(day, n) {
    return new Date(Date.parse(day + "T12:00Z") + n * 864e5).toISOString().slice(0, 10);
  }
  function tithi(d) {
    const angle = A.MoonPhase(d), index = Math.floor(angle / 12);
    return { angle, index, label: (index < 15 ? "\u0AB8\u0AC1\u0AA6 " : "\u0AB5\u0AA6 ") + (index === 29 ? "\u0A85\u0AAE\u0ABE\u0AB8" : names[index % 15]), end: A.SearchMoonPhase((index + 1) * 12 % 360, d, 3).date, start: A.SearchMoonPhase(index * 12, new Date(+d - 3 * 864e5), 4).date };
  }
  function ayan(d) {
    return 23.85675 + (+d - Date.UTC(2e3, 0, 1, 12)) / 864e5 / 365.2425 * 0.013968;
  }
  function sidereal(d) {
    return mod(A.EclipticGeoMoon(d).lon - ayan(d));
  }
  function month(d) {
    const prev = A.SearchMoonPhase(0, new Date(+d - 32 * 864e5), 35);
    let p = prev.date;
    let next = A.SearchMoonPhase(0, /* @__PURE__ */ new Date(+p + 864e5), 35).date;
    if (next <= d) {
      p = next;
      next = A.SearchMoonPhase(0, /* @__PURE__ */ new Date(+p + 864e5), 35).date;
    }
    const sign = (x) => Math.floor(mod(A.SunPosition(x).elon - ayan(x)) / 30);
    const s = sign(next);
    return (s === sign(p) ? "\u0A85\u0AA7\u0ABF\u0A95 " : "") + months[s];
  }
  function dayData(day, loc) {
    const start = instant(day, "00:00", loc.zone), end = instant(addDay(day, 1), "00:00", loc.zone), obs = new A.Observer(loc.lat, loc.lon, 0);
    const rise = (body, dir) => {
      const r = A.SearchRiseSet(body, obs, dir, start, 1.2);
      return r && r.date < end ? r.date : null;
    };
    const sunrise = rise("Sun", 1), sunset = rise("Sun", -1);
    let cursor = start, items = [];
    while (cursor < end && items.length < 4) {
      const t = tithi(cursor);
      items.push(t);
      cursor = /* @__PURE__ */ new Date(+t.end + 1e3);
    }
    return { start, end, sunrise, sunset, moonrise: rise("Moon", 1), moonset: rise("Moon", -1), atSunrise: sunrise ? tithi(sunrise) : null, items };
  }
  function reduce(s) {
    let n = String(s).replace(/\D/g, "").split("").reduce((a, b) => a + Number(b), 0);
    while (n > 9) n = String(n).split("").reduce((a, b) => a + Number(b), 0);
    return n;
  }
  const api = { names, nak, mod, parts, instant, dateKey, addDay, tithi, month, sidereal, ayan, dayData, reduce };
  if (typeof module !== "undefined") module.exports = api;
  root.Kaal = api;
})(typeof window !== "undefined" ? window : globalThis);
