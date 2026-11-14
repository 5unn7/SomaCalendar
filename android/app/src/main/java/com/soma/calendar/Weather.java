package com.soma.calendar;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Live weather for the Sky widget and the Today card, from MET Norway's Locationforecast 2.0 (api.met.no).
 *
 * Why MET Norway: free, no API key, commercial use allowed under CC BY 4.0 (credit "MET Norway"), worldwide
 * coverage. Its terms ask for an identifying User-Agent, at most 4 decimals of coordinates, and that clients
 * respect Expires / If-Modified-Since, which this class does.
 *
 * Privacy: off until the person turns it on. Only the chosen place, rounded to 2 decimals (about 1 km), is sent,
 * over HTTPS, with no identifier. Nothing about the person (birth details, plans) ever leaves the phone.
 *
 * The forecast is boiled down to the next ~48 hours of hourly points, so the widget can keep showing the right
 * hour from its own clock, offline, between fetches.
 */
final class Weather {
  private Weather() {}
  static final String PREFS = "soma_weather";
  private static final String ON = "on", DATA = "data", LAST_MODIFIED = "lm", EXPIRES = "exp", TRIED = "tried", TRIED_KEY = "triedKey", KEY = "key", UNITS = "units";
  private static final String USER_AGENT = "SomaCalendar/0.8 (+https://github.com/5unn7/SomaCalendar)";
  /** A forecast is shown for this long after it was fetched; after that the widget falls back to sun and moon only. */
  static final long SHOW_FOR = 12 * 3600_000L;
  /** Never ask MET more often than this, even if its Expires header says the data is older. */
  private static final long MIN_GAP = 30 * 60_000L;
  /** Windy from Beaufort 5 (fresh breeze) up. */
  static final double WINDY_MS = 8.0;
  private static volatile boolean busy = false;
  /** Bumped whenever the person changes the setting, so a fetch already in flight cannot write after weather is off. */
  private static int generation = 0;

  static SharedPreferences prefs(Context c) { return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE); }
  static boolean on(Context c) { return prefs(c).getBoolean(ON, false); }
  static boolean fahrenheit(Context c) {
    String u = prefs(c).getString(UNITS, "");
    if (u.isEmpty()) { String cc = Locale.getDefault().getCountry(); return "US".equals(cc) || "LR".equals(cc) || "MM".equals(cc); }
    return "f".equals(u);
  }

  /** Called by the app. Turning weather off forgets the stored forecast at once. */
  static synchronized void configure(Context c, boolean on, String units) {
    if (on != on(c)) generation++;
    SharedPreferences.Editor e = prefs(c).edit().putBoolean(ON, on);
    if (units != null && (units.equals("c") || units.equals("f") || units.isEmpty())) e.putString(UNITS, units);
    if (!on) e.remove(DATA).remove(LAST_MODIFIED).remove(EXPIRES).remove(TRIED).remove(TRIED_KEY).remove(KEY);
    e.apply();
  }

  /** The stored forecast, or null when weather is off or nothing usable is stored. */
  /** The stored forecast if it is for this place (within ~2 km), else null. */
  static JSONObject storedFor(Context c, double lat, double lon) {
    JSONObject d = stored(c);
    if (d == null || !valid(lat, lon)) return null;
    return Math.abs(d.optDouble("lat", 999) - lat) <= 0.02 && Math.abs(d.optDouble("lon", 999) - lon) <= 0.02 ? d : null;
  }

  static JSONObject stored(Context c) {
    if (!on(c)) return null;
    String raw = prefs(c).getString(DATA, null);
    if (raw == null) return null;
    try { return new JSONObject(raw); } catch (Exception e) { return null; }
  }

  /** Round to 2 decimals for privacy and so neighbours share MET's cache. */
  static double coarse(double v) { return Math.round(v * 100.0) / 100.0; }

  /** Is a fetch due for this place? New place, nothing stored, or MET's Expires has passed (and 30 min since the last try). */
  static boolean due(Context c, double lat, double lon, long now) {
    if (!on(c) || !valid(lat, lon)) return false;
    SharedPreferences p = prefs(c);
    String key = String.format(Locale.US, "%.2f,%.2f", coarse(lat), coarse(lon));
    // A failed try for this same place still waits MIN_GAP before the next one.
    boolean triedHere = key.equals(p.getString(TRIED_KEY, ""));
    if (triedHere && now - p.getLong(TRIED, 0) < MIN_GAP) return false;
    if (!key.equals(p.getString(KEY, ""))) return true;
    return p.getString(DATA, null) == null || now >= p.getLong(EXPIRES, 0);
  }

  static boolean valid(double lat, double lon) { return Double.isFinite(lat) && Double.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && !(lat == 0 && lon == 0); }

  interface Done { void run(boolean changed); }

  /**
   * Fetch on a background thread when due (or always, with force) and report whether the stored forecast changed.
   * done always runs, at most ~20 seconds later, so a BroadcastReceiver can finish its goAsync() in it.
   */
  static void refresh(Context c, double lat, double lon, boolean force, Done done) {
    final Context app = c.getApplicationContext();
    long now = System.currentTimeMillis();
    if (busy || !on(app) || !valid(lat, lon) || (!force && !due(app, lat, lon, now))) { if (done != null) done.run(false); return; }
    busy = true;
    new Thread(() -> {
      boolean changed = false;
      try { changed = fetch(app, coarse(lat), coarse(lon)); }
      catch (Exception e) { Log.w("SomaWeather", "Weather fetch failed: " + e.getClass().getSimpleName()); }
      finally { busy = false; if (done != null) done.run(changed); }
    }, "SomaWeather").start();
  }

  private static boolean fetch(Context c, double lat, double lon) throws Exception {
    SharedPreferences p = prefs(c);
    String key = String.format(Locale.US, "%.2f,%.2f", lat, lon);
    boolean samePlace = key.equals(p.getString(KEY, ""));
    long now = System.currentTimeMillis();
    final int gen;
    synchronized (Weather.class) { gen = generation; }
    p.edit().putLong(TRIED, now).putString(TRIED_KEY, key).apply();
    HttpURLConnection conn = null;
    try {
      URL url = new URL(String.format(Locale.US, "https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=%.2f&lon=%.2f", lat, lon));
      conn = (HttpURLConnection) url.openConnection();
      conn.setRequestMethod("GET");
      conn.setConnectTimeout(8000); conn.setReadTimeout(10000);
      conn.setInstanceFollowRedirects(false);
      conn.setUseCaches(false);
      conn.setRequestProperty("User-Agent", USER_AGENT);
      conn.setRequestProperty("Accept", "application/json");
      String lm = p.getString(LAST_MODIFIED, "");
      if (samePlace && !lm.isEmpty() && p.getString(DATA, null) != null) conn.setRequestProperty("If-Modified-Since", lm);
      int code = conn.getResponseCode();
      long expires = conn.getHeaderFieldDate("Expires", now + 3600_000L);
      if (code == 304) { p.edit().putLong(EXPIRES, expires).apply(); return false; }
      if (code != 200 && code != 203) { Log.w("SomaWeather", "MET Norway HTTP " + code); return false; }
      StringBuilder text = new StringBuilder();
      try (BufferedReader r = new BufferedReader(new InputStreamReader(conn.getInputStream(), "UTF-8"))) {
        char[] buf = new char[8192]; int n;
        while ((n = r.read(buf)) > 0) { text.append(buf, 0, n); if (text.length() > 600_000) throw new IllegalStateException("Response too large"); }
      }
      JSONObject summary = summarise(new JSONObject(text.toString()), lat, lon, now);
      if (summary == null) return false;
      synchronized (Weather.class) {
        // Turned off (or toggled) while this request was in flight: drop the answer, keep nothing.
        if (gen != generation || !on(c)) return false;
        p.edit().putString(DATA, summary.toString()).putString(KEY, key).putLong(EXPIRES, expires)
          .putString(LAST_MODIFIED, conn.getHeaderField("Last-Modified") == null ? "" : conn.getHeaderField("Last-Modified")).commit();
      }
      return true;
    } finally { if (conn != null) conn.disconnect(); }
  }

  /** {v, at, lat, lon, hours:[{t, c, s, k, p, w, cl, h}]}: time, °C, MET symbol, Soma kind, mm/h, wind m/s, cloud %, humidity %. */
  static JSONObject summarise(JSONObject met, double lat, double lon, long now) throws Exception {
    JSONArray series = met.getJSONObject("properties").getJSONArray("timeseries");
    SimpleDateFormat iso = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US);
    iso.setTimeZone(TimeZone.getTimeZone("UTC"));
    JSONArray hours = new JSONArray();
    for (int i = 0; i < series.length() && hours.length() < 48; i++) {
      JSONObject row = series.getJSONObject(i), data = row.getJSONObject("data");
      Date t = iso.parse(row.getString("time"));
      if (t == null || t.getTime() < now - 3600_000L) continue;
      JSONObject next = data.optJSONObject("next_1_hours");
      if (next == null) break; // hourly steps end after ~2.5 days; the 6-hourly tail is not needed here
      JSONObject d = data.getJSONObject("instant").getJSONObject("details");
      String symbol = next.getJSONObject("summary").optString("symbol_code", "");
      JSONObject nd = next.optJSONObject("details");
      JSONObject h = new JSONObject();
      h.put("t", t.getTime());
      h.put("c", Math.round(d.optDouble("air_temperature", 0) * 10) / 10.0);
      h.put("s", symbol);
      h.put("k", kind(symbol));
      h.put("p", nd == null ? 0 : nd.optDouble("precipitation_amount", 0));
      h.put("w", Math.round(d.optDouble("wind_speed", 0) * 10) / 10.0);
      h.put("cl", Math.round(d.optDouble("cloud_area_fraction", 0)));
      h.put("h", Math.round(d.optDouble("relative_humidity", 0)));
      hours.put(h);
    }
    if (hours.length() == 0) return null;
    JSONObject out = new JSONObject();
    out.put("v", 1); out.put("at", now); out.put("lat", lat); out.put("lon", lon); out.put("src", "MET Norway");
    out.put("hours", hours);
    return out;
  }

  /**
   * MET symbol (e.g. "lightrainshowers_day") to one of Soma's kinds:
   * clear, fair, partly, cloudy, fog, drizzle, rain, heavyrain, showers, sleet, lightsnow, snow, heavysnow, thunder.
   */
  static String kind(String symbol) {
    String s = symbol == null ? "" : symbol.replaceAll("_(day|night|polartwilight)$", "");
    if (s.contains("thunder")) return "thunder";
    if (s.contains("sleet")) return "sleet";
    if (s.contains("snow")) return s.startsWith("light") ? "lightsnow" : s.startsWith("heavy") ? "heavysnow" : "snow";
    if (s.contains("rain")) {
      if (s.contains("showers")) return s.startsWith("heavy") ? "heavyrain" : "showers";
      return s.startsWith("light") ? "drizzle" : s.startsWith("heavy") ? "heavyrain" : "rain";
    }
    switch (s) {
      case "clearsky": return "clear";
      case "fair": return "fair";
      case "partlycloudy": return "partly";
      case "fog": return "fog";
      default: return "cloudy";
    }
  }

  /** What the sky is doing at one instant, read from the stored forecast. */
  static final class Now {
    boolean ok = false;
    double temp, hi, lo, wind;
    int humidity;
    String kind = "clear";
    boolean windy;
    long fetched;
    JSONArray hours = new JSONArray();
    int index = -1;

    static Now at(JSONObject data, long now, long dayEnd) {
      Now n = new Now();
      if (data == null) return n;
      n.fetched = data.optLong("at");
      if (now - n.fetched > SHOW_FOR || now < n.fetched - 3600_000L) return n;
      n.hours = data.optJSONArray("hours");
      if (n.hours == null) return n;
      for (int i = 0; i < n.hours.length(); i++) {
        JSONObject h = n.hours.optJSONObject(i);
        if (h != null && h.optLong("t") <= now && now < h.optLong("t") + 3600_000L) { n.index = i; break; }
      }
      if (n.index < 0) return n;
      JSONObject h = n.hours.optJSONObject(n.index);
      n.ok = true;
      n.temp = h.optDouble("c"); n.kind = h.optString("k", "cloudy"); n.wind = h.optDouble("w"); n.humidity = h.optInt("h");
      n.windy = n.wind >= WINDY_MS;
      // High and low for what is left of today; late at night, the next 24 hours.
      long end = dayEnd - now < 3 * 3600_000L ? now + 24 * 3600_000L : dayEnd;
      n.hi = n.temp; n.lo = n.temp;
      for (int i = n.index; i < n.hours.length(); i++) {
        JSONObject x = n.hours.optJSONObject(i);
        if (x == null || x.optLong("t") >= end) break;
        n.hi = Math.max(n.hi, x.optDouble("c")); n.lo = Math.min(n.lo, x.optDouble("c"));
      }
      return n;
    }

    JSONObject hour(int ahead) { return index < 0 ? null : hours.optJSONObject(index + ahead); }
  }

  static String deg(double celsius, boolean f) { return Math.round(f ? celsius * 9 / 5 + 32 : celsius) + "°"; }

  static String label(String kind) {
    switch (kind) {
      case "clear": return "Clear";
      case "fair": return "Mostly clear";
      case "partly": return "Partly cloudy";
      case "fog": return "Fog";
      case "drizzle": return "Light rain";
      case "rain": return "Rain";
      case "heavyrain": return "Heavy rain";
      case "showers": return "Showers";
      case "sleet": return "Sleet";
      case "lightsnow": return "Light snow";
      case "snow": return "Snow";
      case "heavysnow": return "Heavy snow";
      case "thunder": return "Thunderstorm";
      default: return "Cloudy";
    }
  }
}
