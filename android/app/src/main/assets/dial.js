(function(root) {
  "use strict";
  const TAU = Math.PI * 2;
  const r2 = (n) => Math.round(n * 100) / 100;
  function point(c, r, h) {
    const a = h / 24 * TAU + Math.PI / 2;
    return [r2(c + r * Math.cos(a)), r2(c + r * Math.sin(a))];
  }
  function arc(c, r, h0, h1) {
    let span = h1 - h0;
    if (span <= 0) span += 24;
    const [x0, y0] = point(c, r, h0), [x1, y1] = point(c, r, h0 + span);
    return `M${x0} ${y0}A${r} ${r} 0 ${span > 12 ? 1 : 0} 1 ${x1} ${y1}`;
  }
  function svg(opts) {
    const S = opts.size || 320, c = S / 2, w = opts.ring || Math.max(8, S * 0.05), R = c - w / 2 - (opts.ticks === false ? 2 : S * 0.045);
    const H = opts.hourOf, now = opts.now, gap = 0.04;
    let s = `<circle class="dial-track" cx="${c}" cy="${c}" r="${R}" stroke-width="${w}"/>`;
    let current = null;
    for (const p of opts.chog || []) {
      const h0 = H(p.start) + gap, h1 = H(p.end) - gap, on = now && p.start <= now && now < p.end;
      if (on) current = p;
      const k = p.nature === "bad" ? 0.42 : p.nature === "neutral" ? 0.72 : 1, sw = (on ? w * 1.35 : w) * k, rr = R - (w - w * k) / 2 * (on ? 1.35 : 1);
      s += `<path class="dial-seg ${p.nature}${p.night ? " night" : ""}${on ? " on" : ""}" d="${arc(c, rr, h0, h1)}" stroke-width="${r2(sw)}" pathLength="1"/>`;
    }
    for (const p of opts.kaal || (opts.rahu ? [Object.assign({ k: "rahu" }, opts.rahu)] : [])) s += `<path class="dial-rahu ${p.k}" d="${arc(c, R - w * 1.25, H(p.start), H(p.end))}" stroke-width="${Math.max(2, w * (p.k === "rahu" ? 0.24 : 0.16))}"/>`;
    if (opts.ticks !== false) for (let h = 0; h < 24; h++) {
      const major = h % 6 === 0, [x0, y0] = point(c, R + w / 2 + 3, h), [x1, y1] = point(c, R + w / 2 + (major ? 9 : 5), h);
      s += `<line class="dial-tick${major ? " major" : ""}" x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}"/>`;
    }
    if (opts.labels !== false) for (const [h, txt] of opts.nums || [[6, "6"], [12, "12"], [18, "18"], [0, "0"]]) {
      const [x, y] = point(c, R - w * 1.25 - S * 0.065, h);
      s += `<text class="dial-num" x="${x}" y="${y}" dy="0.35em" text-anchor="middle" font-size="${r2(S * 0.042)}">${txt}</text>`;
    }
    for (const [d, cls] of [[opts.sunrise, "rise"], [opts.sunset, "set"]]) if (d) {
      const h = H(d), [x, y] = point(c, R, h), [a0, b0] = point(c, R + w / 2 + 4, h - 0.35), [a1, b1] = point(c, R + w / 2 + 4, h + 0.35);
      s += `<circle class="dial-sun ${cls}" cx="${x}" cy="${y}" r="${r2(w * 0.42)}"/><line class="dial-hz" x1="${a0}" y1="${b0}" x2="${a1}" y2="${b1}"/>`;
    }
    if (now) {
      const h = H(now), [x, y] = point(c, R, h), [hx, hy] = point(c, R * 0.5, h), deg = r2(h / 24 * 360);
      s += `<g class="dial-hand" style="--deg:${deg}deg;transform-origin:${c}px ${c}px"><line x1="${hx}" y1="${hy}" x2="${x}" y2="${y}"/><circle class="halo" cx="${x}" cy="${y}" r="${r2(w * 1.15)}"/><circle class="knob" cx="${x}" cy="${y}" r="${r2(w * 0.62)}"/></g>`;
    }
    return { svg: `<svg class="dial" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}" role="img" aria-label="${opts.label ? String(opts.label).replace(/"/g, "&quot;") : "Choghadiya dial"}">${s}</svg>`, current };
  }
  function skyPhase(now, sunrise, sunset) {
    const HR = 36e5;
    if (!now || !sunrise || !sunset) return "day";
    if (Math.abs(now - sunrise) < HR) return "dawn";
    if (Math.abs(now - sunset) < HR) return "dusk";
    return now > sunrise && now < sunset ? "day" : "night";
  }
  function moon(size, angle, cls) {
    const k = Math.cos(angle * Math.PI / 180), r = 40, rx = r2(Math.abs(k) * r), waxing = angle < 180;
    const shade = waxing ? `M50 10A40 40 0 0 0 50 90A${rx} 40 0 0 ${k > 0 ? 0 : 1} 50 10Z` : `M50 10A40 40 0 0 1 50 90A${rx} 40 0 0 ${k > 0 ? 1 : 0} 50 10Z`;
    return `<svg class="moonsvg ${cls || ""}" viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true"><circle class="glow" cx="50" cy="50" r="46"/><circle class="dark" cx="50" cy="50" r="${r}"/><image href="img/moon.webp" x="10" y="10" width="80" height="80"/><path class="shade" d="${shade}"/></svg>`;
  }
  const api = { svg, skyPhase, moon, point };
  if (typeof module !== "undefined") module.exports = api;
  root.SomaDial = api;
})(typeof window !== "undefined" ? window : globalThis);
