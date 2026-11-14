package com.soma.calendar;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.util.SizeF;
import android.widget.RemoteViews;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TimeZone;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Kaal Chakra home-screen widget. The app hands over a week of precomputed Panchang intervals
 * (src/redesign/widget.js); the widget draws the 24-hour Choghadiya ring for what holds right now and wakes itself
 * at the next boundary (Choghadiya change, tithi end, Rahu Kaal, midnight). Fully offline, no location tracking.
 *
 * Small (2x2): ring with a gold dot at now, tithi in the centre and the current window below it.
 * Medium (4x2): moon phase, NOW, "Shubh until 9:47", what comes next, the next vrat.
 * Large: ring above, the medium text below.
 */
public final class SomaWidget extends AppWidgetProvider {
  static final String PREFS = "soma_widget";
  static final String FEED = "feed";
  static final String ACTION_TICK = "com.soma.calendar.WIDGET_TICK";
  private static final int SMALL = 0, MEDIUM = 1, LARGE = 2;
  // One shared bitmap per update keeps the RemoteViews parcel well under the 1 MB binder limit.
  private static final int RING_PX = 360, MOON_PX = 144;

  static void refreshAll(Context c) {
    AppWidgetManager m = AppWidgetManager.getInstance(c);
    int[] ids = m.getAppWidgetIds(new ComponentName(c, SomaWidget.class));
    Snapshot s = Snapshot.load(c, System.currentTimeMillis());
    for (int id : ids) push(c, m, id, s);
    schedule(c, ids.length > 0 ? s.nextChange : 0);
  }
  @Override public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
    Snapshot s = Snapshot.load(c, System.currentTimeMillis());
    for (int id : ids) push(c, m, id, s);
    schedule(c, s.nextChange);
  }
  @Override public void onAppWidgetOptionsChanged(Context c, AppWidgetManager m, int id, Bundle options) {
    push(c, m, id, Snapshot.load(c, System.currentTimeMillis()));
  }
  @Override public void onDisabled(Context c) { schedule(c, 0); }
  @Override public void onReceive(Context c, Intent intent) {
    super.onReceive(c, intent);
    String a = intent.getAction();
    if (ACTION_TICK.equals(a) || Intent.ACTION_TIME_CHANGED.equals(a) || Intent.ACTION_TIMEZONE_CHANGED.equals(a)
      || Intent.ACTION_BOOT_COMPLETED.equals(a) || Intent.ACTION_MY_PACKAGE_REPLACED.equals(a)) refreshAll(c);
  }

  private static void push(Context c, AppWidgetManager m, int id, Snapshot s) {
    Palette p = Palette.of(c);
    Bitmap ring = ring(s, p, true), moon = moon(s.tithiIndex, p, MOON_PX);
    RemoteViews views;
    if (Build.VERSION.SDK_INT >= 31) {
      // The launcher picks the largest layout that fits as the user resizes.
      Map<SizeF, RemoteViews> map = new HashMap<>();
      map.put(new SizeF(110, 110), render(c, s, ring, moon, SMALL));
      map.put(new SizeF(250, 110), render(c, s, ring, moon, MEDIUM));
      map.put(new SizeF(250, 250), render(c, s, ring, moon, LARGE));
      views = new RemoteViews(map);
    } else views = render(c, s, ring, moon, sizeFor(m.getAppWidgetOptions(id)));
    m.updateAppWidget(id, views);
  }
  private static int sizeFor(Bundle o) {
    int w = o == null ? 0 : o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH);
    int h = o == null ? 0 : o.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT);
    if (w == 0 || h == 0) return SMALL;
    if (w < 250) return SMALL;
    return h >= 250 ? LARGE : MEDIUM;
  }

  private static RemoteViews render(Context c, Snapshot s, Bitmap ring, Bitmap moon, int size) {
    Palette p = Palette.of(c);
    int layout = size == SMALL ? R.layout.soma_widget_small : size == MEDIUM ? R.layout.soma_widget : R.layout.soma_widget_large;
    RemoteViews v = new RemoteViews(c.getPackageName(), layout);
    if (size != MEDIUM) v.setImageViewBitmap(R.id.wRing, ring);
    if (size != SMALL) {
      if (size == MEDIUM) v.setImageViewBitmap(R.id.wMoon, moon);
      v.setTextViewText(R.id.wLabel, s.label);
      v.setTextViewText(R.id.wNow, s.nowLine);
      v.setTextColor(R.id.wNow, s.inRahu ? p.bad : p.ink);
      v.setTextViewText(R.id.wThen, s.thenLine);
      v.setTextViewText(R.id.wVrat, s.vratLine);
    }
    Intent open = new Intent(c, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    v.setOnClickPendingIntent(R.id.widgetRoot, PendingIntent.getActivity(c, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));
    return v;
  }

  // ---- Drawing ---------------------------------------------------------------------------------------------------

  /** Colours follow the system light/dark setting, matching values/widget.xml and values-night/widget.xml. */
  static final class Palette {
    int ground, ink, muted, gold, good, ok, bad;
    static Palette of(Context c) {
      Palette p = new Palette();
      p.ground = c.getColor(R.color.widget_ground); p.ink = c.getColor(R.color.widget_ink); p.muted = c.getColor(R.color.widget_muted);
      p.gold = c.getColor(R.color.widget_gold); p.good = c.getColor(R.color.widget_good); p.ok = c.getColor(R.color.widget_ok);
      p.bad = c.getColor(R.color.widget_bad);
      return p;
    }
    int quality(String q) { return "good".equals(q) ? good : "bad".equals(q) ? bad : ok; }
  }

  /** 24-hour dial: midnight at the bottom, noon at the top, clockwise. Canvas angle 0 is 3 o'clock, so midnight is 90°. */
  static float angle(double localHours) { return (float) (90 + localHours / 24.0 * 360.0); }

  private static Bitmap ring(Snapshot s, Palette p, boolean withCentre) {
    Bitmap b = Bitmap.createBitmap(RING_PX, RING_PX, Bitmap.Config.ARGB_8888);
    Canvas cv = new Canvas(b);
    float stroke = RING_PX * 0.075f, r = RING_PX / 2f - stroke, cx = RING_PX / 2f, cy = RING_PX / 2f;
    RectF box = new RectF(cx - r, cy - r, cx + r, cy + r);
    Paint arc = new Paint(Paint.ANTI_ALIAS_FLAG);
    arc.setStyle(Paint.Style.STROKE);
    arc.setStrokeWidth(stroke);
    arc.setStrokeCap(Paint.Cap.BUTT);
    // Hairline track under the arcs.
    Paint track = new Paint(Paint.ANTI_ALIAS_FLAG);
    track.setStyle(Paint.Style.STROKE);
    track.setStrokeWidth(2);
    track.setColor(withAlpha(p.muted, 0.35f));
    cv.drawCircle(cx, cy, r, track);
    for (Arc a : s.arcs) {
      arc.setColor(withAlpha(p.quality(a.quality), a.day ? 1f : 0.3f));
      float sweep = (float) (a.hours * 15.0) - 1.2f; // 1.2° gap between windows
      if (sweep > 0) cv.drawArc(box, angle(a.startHours) + 0.6f, sweep, false, arc);
    }
    // Hour ticks at 0, 6, 12 and 18.
    Paint tick = new Paint(Paint.ANTI_ALIAS_FLAG);
    tick.setColor(withAlpha(p.muted, 0.7f));
    tick.setStrokeWidth(3);
    for (int h = 0; h < 24; h += 6) {
      double t = Math.toRadians(angle(h));
      float inner = r - stroke * 0.95f, outer = r - stroke * 0.65f;
      cv.drawLine(cx + (float) Math.cos(t) * inner, cy + (float) Math.sin(t) * inner, cx + (float) Math.cos(t) * outer, cy + (float) Math.sin(t) * outer, tick);
    }
    if (s.hasData) {
      double t = Math.toRadians(angle(s.nowHours));
      float dx = cx + (float) Math.cos(t) * r, dy = cy + (float) Math.sin(t) * r;
      Paint hand = new Paint(Paint.ANTI_ALIAS_FLAG);
      hand.setColor(p.gold);
      hand.setStrokeWidth(3);
      cv.drawLine(cx + (float) Math.cos(t) * (r * 0.62f), cy + (float) Math.sin(t) * (r * 0.62f), dx, dy, hand);
      Paint halo = new Paint(Paint.ANTI_ALIAS_FLAG);
      halo.setColor(p.ground);
      cv.drawCircle(dx, dy, stroke * 0.85f, halo);
      hand.setStyle(Paint.Style.FILL);
      cv.drawCircle(dx, dy, stroke * 0.62f, hand);
    }
    if (withCentre) {
      Paint serif = new Paint(Paint.ANTI_ALIAS_FLAG);
      serif.setTypeface(Typeface.create(Typeface.SERIF, Typeface.NORMAL));
      serif.setColor(p.ink);
      serif.setTextAlign(Paint.Align.CENTER);
      serif.setTextSize(r * 0.30f);
      fit(serif, s.tithiName, r * 1.3f);
      cv.drawText(s.tithiName, cx, cy + r * 0.06f, serif);
      Paint caps = new Paint(Paint.ANTI_ALIAS_FLAG);
      caps.setTypeface(Typeface.create("sans-serif-medium", Typeface.NORMAL));
      caps.setColor(s.inRahu ? p.bad : p.quality(s.quality));
      caps.setTextAlign(Paint.Align.CENTER);
      caps.setTextSize(r * 0.12f);
      caps.setLetterSpacing(0.14f);
      fit(caps, s.caption, r * 1.25f);
      cv.drawText(s.caption, cx, cy + r * 0.30f, caps);
    }
    return b;
  }

  private static void fit(Paint p, String text, float max) {
    while (p.measureText(text) > max && p.getTextSize() > 8) p.setTextSize(p.getTextSize() * 0.92f);
  }

  /** Moon disc lit by tithi: waxing lights the right side, waning the left; the terminator is a half-ellipse. */
  static Bitmap moon(int tithiIndex, Palette p, int px) {
    Bitmap b = Bitmap.createBitmap(px, px, Bitmap.Config.ARGB_8888);
    Canvas cv = new Canvas(b);
    float r = px / 2f - 2, cx = px / 2f, cy = px / 2f;
    Paint dark = new Paint(Paint.ANTI_ALIAS_FLAG);
    dark.setColor(withAlpha(p.muted, 0.28f));
    cv.drawCircle(cx, cy, r, dark);
    if (tithiIndex < 0) return b;
    Paint lit = new Paint(Paint.ANTI_ALIAS_FLAG);
    lit.setColor(p.ink);
    cv.drawPath(moonPath(tithiIndex, cx, cy, r), lit);
    return b;
  }

  static Path moonPath(int tithiIndex, float cx, float cy, float r) {
    boolean waxing = tithiIndex < 15;
    double theta = Math.toRadians((tithiIndex + 0.5) * 12.0);
    double k = waxing ? Math.cos(theta) : Math.cos(2 * Math.PI - theta);
    int side = waxing ? 1 : -1, n = 48;
    Path path = new Path();
    // Outer limb on the lit side, top to bottom.
    for (int i = 0; i <= n; i++) {
      double y = -r + 2.0 * r * i / n, w = Math.sqrt(Math.max(0, r * r - y * y));
      float x = (float) (cx + side * w), yy = (float) (cy + y);
      if (i == 0) path.moveTo(x, yy); else path.lineTo(x, yy);
    }
    // Terminator back to the top.
    for (int i = n; i >= 0; i--) {
      double y = -r + 2.0 * r * i / n, w = Math.sqrt(Math.max(0, r * r - y * y));
      path.lineTo((float) (cx + side * k * w), (float) (cy + y));
    }
    path.close();
    return path;
  }

  private static int withAlpha(int color, float a) { return (Math.round(a * 255) << 24) | (color & 0x00FFFFFF); }

  /** Wake at the next boundary. Inexact RTC alarm: no exact-alarm permission, and no wakeups while the screen is off. */
  private static void schedule(Context c, long at) {
    AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
    if (am == null) return;
    Intent tick = new Intent(c, SomaWidget.class).setAction(ACTION_TICK);
    PendingIntent pi = PendingIntent.getBroadcast(c, 1, tick, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    am.cancel(pi);
    if (at <= 0) return;
    long now = System.currentTimeMillis();
    // At most 15 minutes apart, so the dot on the ring keeps moving.
    at = Math.max(now + 30_000L, Math.min(at + 5_000L, now + 15 * 60_000L));
    am.setWindow(AlarmManager.RTC, at, 60_000L, pi);
  }

  // ---- What holds now --------------------------------------------------------------------------------------------

  static final class Arc { double startHours, hours; String quality; boolean day; }

  static final String[] TITHI_GU = {"પડવો", "બીજ", "ત્રીજ", "ચોથ", "પાંચમ", "છઠ", "સાતમ", "આઠમ", "નોમ", "દશમ", "અગિયારસ", "બારસ", "તેરસ", "ચૌદશ", "પૂનમ"};
  static final String[] TITHI_EN = {"Pratipada", "Dwitiya", "Tritiya", "Chaturthi", "Panchami", "Shashthi", "Saptami", "Ashtami", "Navami", "Dashami", "Ekadashi", "Dwadashi", "Trayodashi", "Chaturdashi", "Purnima"};

  /** "સુદ પાંચમ" → 4, "વદ પાંચમ" → 19, "વદ અમાસ" → 29; -1 if unknown. */
  static int tithiIndex(String label) {
    if (label == null) return -1;
    if (label.contains("અમાસ")) return 29;
    boolean vad = label.startsWith("વદ");
    for (int i = 0; i < TITHI_GU.length; i++) if (label.endsWith(TITHI_GU[i])) return (vad ? 15 : 0) + i;
    return -1;
  }
  static String tithiEnglish(int i) { return i < 0 ? "Soma" : i == 29 ? "Amavasya" : TITHI_EN[i % 15]; }

  /** Everything the widget shows at one instant, derived from the stored feed. */
  static final class Snapshot {
    boolean hasData = false, inRahu = false;
    String tithiName = "Soma", caption = "OPEN SOMA", label = "NOW", nowLine = "Soma", thenLine = "Open Soma once to set your city",
      vratLine = "", quality = "ok";
    int tithiIndex = -1;
    double nowHours = 0;
    long nextChange = 0;
    final List<Arc> arcs = new ArrayList<>();

    static Snapshot load(Context c, long now) {
      Snapshot s = new Snapshot();
      SharedPreferences p = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
      String raw = p.getString(FEED, null);
      try { if (raw != null) s.fill(new JSONObject(raw), now); }
      catch (Exception e) { Log.w("SomaWidget", "Unreadable widget feed", e); }
      if (s.nextChange == 0) s.nextChange = now + 60 * 60_000L;
      return s;
    }

    void fill(JSONObject f, long now) throws Exception {
      TimeZone tz = TimeZone.getTimeZone(f.optString("zone", "Asia/Kolkata"));
      SimpleDateFormat time = fmt("h:mm", tz), key = fmt("yyyy-MM-dd", tz), day = fmt("EEE d MMM", tz);
      long midnight = startOfNextDay(now, tz);
      String today = key.format(new Date(now)), tomorrow = key.format(new Date(midnight + 60_000L));
      long soonest = midnight;

      JSONObject t = at(f.optJSONArray("tithi"), now);
      JSONArray chogs = f.optJSONArray("chog");
      int ci = index(chogs, now);
      if (t == null || ci < 0) { thenLine = "Open Soma to refresh this week"; nextChange = now + 60 * 60_000L; return; }
      hasData = true;
      tithiIndex = tithiIndex(t.optString("n"));
      tithiName = tithiEnglish(tithiIndex);
      soonest = Math.min(soonest, t.getLong("e"));
      nowHours = hours(now, tz);

      // The ring: every window inside the 24 hours centred on now, so arcs never overlap.
      long lo = now - 12 * 3_600_000L, hi = now + 12 * 3_600_000L;
      for (int i = 0; i < chogs.length(); i++) {
        JSONObject x = chogs.getJSONObject(i);
        long s = Math.max(lo, x.getLong("s")), e = Math.min(hi, x.getLong("e"));
        if (e <= s) continue;
        Arc a = new Arc();
        a.startHours = hours(s, tz);
        a.hours = (e - s) / 3_600_000.0;
        a.quality = x.optString("q");
        a.day = x.optInt("day", 1) == 1;
        arcs.add(a);
      }

      JSONObject ch = chogs.getJSONObject(ci);
      long chEnd = ch.getLong("e");
      quality = ch.optString("q");
      String name = ch.optString("en");
      soonest = Math.min(soonest, chEnd);

      // Rahu Kaal for today's daylight.
      long rs = 0, re = 0;
      JSONObject d = byDate(f.optJSONArray("days"), today);
      if (d != null) { JSONArray r = d.getJSONArray("rahu"); rs = r.getLong(0); re = r.getLong(1); }
      inRahu = rs <= now && now < re;
      if (inRahu) {
        soonest = Math.min(soonest, re);
        caption = "RAHU · " + time.format(new Date(re));
        nowLine = "Rahu Kaal until " + time.format(new Date(re));
        thenLine = "Hold new starts. Then " + nextName(chogs, re) + ".";
      } else {
        if (now < rs) soonest = Math.min(soonest, rs);
        caption = name.toUpperCase(Locale.ROOT) + " · " + time.format(new Date(chEnd));
        nowLine = name + " until " + time.format(new Date(chEnd));
        if (rs > now && rs - chEnd < 3 * 3_600_000L) thenLine = "Then Rahu Kaal " + time.format(new Date(rs)) + " – " + time.format(new Date(re));
        else if (ci + 1 < chogs.length()) {
          JSONObject nx = chogs.getJSONObject(ci + 1);
          thenLine = "Then " + nx.optString("en") + " until " + time.format(new Date(nx.getLong("e")));
        } else thenLine = "";
      }

      JSONArray vr = f.optJSONArray("vrat");
      if (vr != null) for (int i = 0; i < vr.length(); i++) {
        JSONObject x = vr.getJSONObject(i);
        String on = x.optString("date");
        if (on.compareTo(today) < 0) continue;
        String when = on.equals(today) ? "Today" : on.equals(tomorrow) ? "Tomorrow" : day.format(key.parse(on));
        String vname = x.optString("en").isEmpty() ? x.optString("n") : x.optString("en");
        vratLine = when + " · " + vname;
        break;
      }
      nextChange = soonest;
    }

    private static String nextName(JSONArray chogs, long at) throws Exception {
      for (int i = 0; i < chogs.length(); i++) {
        JSONObject x = chogs.getJSONObject(i);
        if (x.getLong("s") <= at && at < x.getLong("e")) return x.optString("en");
      }
      return "the next window";
    }
    private static double hours(long t, TimeZone tz) {
      Calendar cal = Calendar.getInstance(tz);
      cal.setTimeInMillis(t);
      return cal.get(Calendar.HOUR_OF_DAY) + cal.get(Calendar.MINUTE) / 60.0 + cal.get(Calendar.SECOND) / 3600.0;
    }
    private static SimpleDateFormat fmt(String pattern, TimeZone tz) { SimpleDateFormat f = new SimpleDateFormat(pattern, Locale.US); f.setTimeZone(tz); return f; }
    private static long startOfNextDay(long now, TimeZone tz) {
      Calendar cal = Calendar.getInstance(tz);
      cal.setTimeInMillis(now); cal.add(Calendar.DAY_OF_MONTH, 1);
      cal.set(Calendar.HOUR_OF_DAY, 0); cal.set(Calendar.MINUTE, 0); cal.set(Calendar.SECOND, 0); cal.set(Calendar.MILLISECOND, 0);
      return cal.getTimeInMillis();
    }
    private static int index(JSONArray a, long now) throws Exception {
      if (a == null) return -1;
      for (int i = 0; i < a.length(); i++) { JSONObject o = a.getJSONObject(i); if (o.getLong("s") <= now && now < o.getLong("e")) return i; }
      return -1;
    }
    private static JSONObject at(JSONArray a, long now) throws Exception { int i = index(a, now); return i < 0 ? null : a.getJSONObject(i); }
    private static JSONObject byDate(JSONArray a, String date) throws Exception {
      if (a == null) return null;
      for (int i = 0; i < a.length(); i++) if (date.equals(a.getJSONObject(i).optString("date"))) return a.getJSONObject(i);
      return null;
    }
  }
}
