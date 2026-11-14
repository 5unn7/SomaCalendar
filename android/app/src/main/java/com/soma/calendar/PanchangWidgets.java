package com.soma.calendar;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.DashPathEffect;
import android.graphics.Paint;
import android.graphics.Path;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.util.SizeF;
import android.view.View;
import android.widget.RemoteViews;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.TimeZone;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * The widget family beside the Kaal Chakra dial (SomaWidget): Sun, Moon, Festival countdown, Now (Choghadiya strip)
 * and Day (a full day sheet for tablets and unfolded foldables). All of them read the same offline feed that the app
 * writes (src/redesign/widget.js) and share one inexact alarm that wakes at the next boundary.
 *
 * Each widget offers several layouts keyed by size. On Android 12+ the launcher switches between them live as the
 * widget is resized (phones, Galaxy Fold cover and inner screens, 14-inch tablets); older versions pick one on resize.
 */
public final class PanchangWidgets {
  private PanchangWidgets() {}
  static final String ACTION_TICK = "com.soma.calendar.PANCHANG_WIDGET_TICK";
  private static final Class<?>[] PROVIDERS = {Sun.class, Moon.class, Festival.class, Now.class, Day.class};

  /** Redraw every placed widget of this family and schedule the next wake-up. Called by the app after a new feed. */
  static void refreshAll(Context c) {
    AppWidgetManager m = AppWidgetManager.getInstance(c);
    long now = System.currentTimeMillis();
    Feed f = Feed.load(c, now);
    boolean any = false;
    for (Class<?> k : PROVIDERS) {
      int[] ids = m.getAppWidgetIds(new ComponentName(c, k));
      for (int id : ids) { any = true; push(c, m, id, k, f); }
    }
    schedule(c, any ? f.next : 0);
  }

  private static void push(Context c, AppWidgetManager m, int id, Class<?> k, Feed f) {
    try {
      RemoteViews views;
      if (Build.VERSION.SDK_INT >= 31) {
        Map<SizeF, RemoteViews> map = new HashMap<>();
        for (float[] s : sizes(k)) map.put(new SizeF(s[0], s[1]), render(c, k, f, s[0], s[1]));
        views = new RemoteViews(map);
      } else {
        Bundle o = m.getAppWidgetOptions(id);
        float w = o == null ? 0 : o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH);
        float h = o == null ? 0 : o.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT);
        float[] pick = sizes(k)[0];
        if (w > 0 && h > 0) for (float[] s : sizes(k)) if (w >= s[0] && h >= s[1]) pick = s;
        views = render(c, k, f, pick[0], pick[1]);
      }
      m.updateAppWidget(id, views);
    } catch (Exception e) { Log.w("SomaWidget", "Widget render failed for " + k.getSimpleName(), e); }
  }

  /** Breakpoints in dp, smallest first. The launcher uses the largest one that fits. */
  private static float[][] sizes(Class<?> k) {
    if (k == Sun.class) return new float[][]{{110, 40}, {200, 100}, {300, 220}};
    if (k == Moon.class) return new float[][]{{110, 110}, {250, 110}, {250, 250}};
    if (k == Festival.class) return new float[][]{{110, 110}, {250, 110}, {250, 250}};
    if (k == Now.class) return new float[][]{{110, 40}, {250, 40}, {250, 110}};
    return new float[][]{{250, 250}, {450, 300}};
  }

  private static RemoteViews render(Context c, Class<?> k, Feed f, float w, float h) {
    SomaWidget.Palette p = SomaWidget.Palette.of(c);
    RemoteViews v;
    if (k == Sun.class) v = sun(c, f, p, w, h);
    else if (k == Moon.class) v = moon(c, f, p, w, h);
    else if (k == Festival.class) v = festival(c, f, p, w, h);
    else if (k == Now.class) v = now(c, f, p, w, h);
    else v = day(c, f, p, w, h);
    Intent open = new Intent(c, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    v.setOnClickPendingIntent(R.id.widgetRoot, PendingIntent.getActivity(c, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));
    return v;
  }

  // ---- Sun ----------------------------------------------------------------------------------------------------

  private static RemoteViews sun(Context c, Feed f, SomaWidget.Palette p, float w, float h) {
    boolean small = h < 100, large = w >= 300 && h >= 220;
    RemoteViews v = new RemoteViews(c.getPackageName(), small ? R.layout.panchang_sun_small : large ? R.layout.panchang_sun_large : R.layout.panchang_sun);
    if (!f.ok || f.vedic == null) {
      if (small) v.setTextViewText(R.id.pHeadline, "Soma");
      v.setTextViewText(R.id.pRise, f.ok ? "No sunrise today" : "Open Soma once");
      v.setTextViewText(R.id.pSet, "");
      if (!small) { v.setTextViewText(R.id.pHeadline, f.ok ? "Polar night or day" : "Set your city in Soma"); v.setImageViewBitmap(R.id.pArt, f.art("sun0", () -> sunArc(null, f, p))); }
      return v;
    }
    JSONObject d = f.vedic;
    long rise = d.optLong("rise"), set = d.optLong("set"), next = d.optLong("next");
    boolean day = f.now >= rise && f.now < set;
    v.setTextViewText(R.id.pRise, (small ? "↑ " : "Sunrise ") + f.time(rise));
    v.setTextViewText(R.id.pSet, (small ? "↓ " : "Sunset ") + f.time(set));
    if (small) {
      v.setTextViewText(R.id.pHeadline, day ? "Sets in " + f.span(set - f.now) : "Rises in " + f.span(next - f.now));
      return v;
    }
    String headline;
    if (day) headline = "Sunset in " + f.span(set - f.now);
    else if (f.now < rise) headline = "Sunrise in " + f.span(rise - f.now);
    else headline = "Sunrise in " + f.span(next - f.now);
    JSONArray brahma = f.nextBrahma();
    if (brahma != null && f.now >= brahma.optLong(0) && f.now < brahma.optLong(1)) headline = "Brahma muhurat now";
    v.setTextViewText(R.id.pHeadline, headline);
    v.setTextViewText(R.id.pSub, f.span(set - rise) + " of daylight · " + f.dateLabel());
    v.setImageViewBitmap(R.id.pArt, f.art("sun", () -> sunArc(d, f, p)));
    if (large) {
      StringBuilder b = new StringBuilder();
      if (brahma != null) b.append("Brahma muhurat  ").append(f.range(brahma.optLong(0), brahma.optLong(1))).append('\n');
      b.append("Solar noon  ").append(f.time(d.optLong("noon")));
      JSONArray ab = d.optJSONArray("abhijit");
      if (ab != null) b.append("   ·   Abhijit  ").append(f.range(ab.optLong(0), ab.optLong(1)));
      b.append('\n');
      JSONObject civil = f.today != null ? f.today : d;
      long mr = civil.optLong("mrise"), ms = civil.optLong("mset");
      b.append("Moonrise  ").append(mr > 0 ? f.time(mr) : "—").append("   ·   Moonset  ").append(ms > 0 ? f.time(ms) : "—");
      if (f.tomorrow != null) b.append('\n').append("Tomorrow  ↑ ").append(f.time(f.tomorrow.optLong("rise"))).append("  ↓ ").append(f.time(f.tomorrow.optLong("set")));
      v.setTextViewText(R.id.pDetail, b.toString());
    }
    return v;
  }

  /** Sun path from sunrise to sunset over a horizon line; walked part in gold, the rest dashed, the sun at now. */
  private static Bitmap sunArc(JSONObject d, Feed f, SomaWidget.Palette p) {
    int W = 480, H = 165;
    Bitmap b = Bitmap.createBitmap(W, H, Bitmap.Config.ARGB_8888);
    Canvas cv = new Canvas(b);
    float m = 16, horizon = H - 16, peak = H - 34;
    Paint line = new Paint(Paint.ANTI_ALIAS_FLAG);
    line.setColor(alpha(p.muted, 0.6f));
    line.setStrokeWidth(2);
    cv.drawLine(0, horizon, W, horizon, line);
    if (d == null) return b;
    long rise = d.optLong("rise"), set = d.optLong("set");
    double t = (f.now - rise) / (double) Math.max(1, set - rise);
    Path all = new Path(), done = new Path();
    int n = 64;
    for (int i = 0; i <= n; i++) {
      double u = i / (double) n;
      float x = (float) (m + u * (W - 2 * m)), y = (float) (horizon - peak * Math.sin(Math.PI * u));
      if (i == 0) { all.moveTo(x, y); done.moveTo(x, y); } else { all.lineTo(x, y); if (u <= t) done.lineTo(x, y); }
    }
    Paint dash = new Paint(Paint.ANTI_ALIAS_FLAG);
    dash.setStyle(Paint.Style.STROKE);
    dash.setStrokeWidth(3);
    dash.setColor(alpha(p.muted, 0.8f));
    dash.setPathEffect(new DashPathEffect(new float[]{10, 10}, 0));
    cv.drawPath(all, dash);
    if (t > 0) {
      Paint gold = new Paint(Paint.ANTI_ALIAS_FLAG);
      gold.setStyle(Paint.Style.STROKE);
      gold.setStrokeWidth(5);
      gold.setStrokeCap(Paint.Cap.ROUND);
      gold.setColor(p.gold);
      cv.drawPath(done, gold);
    }
    if (t >= 0 && t <= 1) {
      float x = (float) (m + t * (W - 2 * m)), y = (float) (horizon - peak * Math.sin(Math.PI * t));
      Paint glow = new Paint(Paint.ANTI_ALIAS_FLAG);
      glow.setColor(alpha(p.gold, 0.25f));
      cv.drawCircle(x, y, 20, glow);
      Paint disc = new Paint(Paint.ANTI_ALIAS_FLAG);
      disc.setColor(p.gold);
      cv.drawCircle(x, y, 11, disc);
    }
    return b;
  }

  // ---- Moon ---------------------------------------------------------------------------------------------------

  private static RemoteViews moon(Context c, Feed f, SomaWidget.Palette p, float w, float h) {
    boolean wide = w >= 250, large = wide && h >= 250;
    RemoteViews v = new RemoteViews(c.getPackageName(), large ? R.layout.panchang_moon_large : wide ? R.layout.panchang_moon_wide : R.layout.panchang_moon);
    v.setImageViewBitmap(R.id.pArt, f.art("moon", () -> SomaWidget.moon(f.tithiIndex, p, 200)));
    if (!f.ok) { v.setTextViewText(R.id.pHeadline, "Soma"); v.setTextViewText(R.id.pSub, "Open Soma once"); return v; }
    v.setTextViewText(R.id.pHeadline, SomaWidget.tithiEnglish(f.tithiIndex));
    int lit = (int) Math.round(f.illumination() * 100);
    v.setTextViewText(R.id.pSub, lit + "% lit · " + (f.tithiIndex < 15 ? "Shukla, waxing" : "Krishna, waning"));
    if (!wide) return v;
    JSONObject ph = f.nextPhase(f.tithiIndex < 15 ? 2 : 0);
    String nextLine = ph == null ? "" : (ph.optInt("k") == 2 ? "Purnima " : "Amavasya ") + f.when(ph.optLong("t"));
    v.setTextViewText(R.id.pDetail, nextLine);
    JSONObject civil = f.today;
    if (civil != null) {
      long mr = civil.optLong("mrise"), ms = civil.optLong("mset");
      v.setTextViewText(R.id.pRise, "Moonrise " + (mr > 0 ? f.time(mr) : "—") + "  ·  Moonset " + (ms > 0 ? f.time(ms) : "—"));
    }
    if (large) {
      StringBuilder b = new StringBuilder();
      String[] names = {"New moon", "First quarter", "Full moon", "Last quarter"};
      JSONArray phases = f.feed.optJSONArray("phases");
      int shown = 0;
      if (phases != null) for (int i = 0; i < phases.length() && shown < 4; i++) {
        JSONObject x = phases.optJSONObject(i);
        if (x == null || x.optLong("t") < f.now) continue;
        if (shown++ > 0) b.append('\n');
        b.append(names[x.optInt("k") & 3]).append("   ").append(f.when(x.optLong("t")));
      }
      v.setTextViewText(R.id.pList, b.toString());
    }
    return v;
  }

  // ---- Festival countdown -------------------------------------------------------------------------------------

  private static RemoteViews festival(Context c, Feed f, SomaWidget.Palette p, float w, float h) {
    boolean wide = w >= 250, large = wide && h >= 250;
    RemoteViews v = new RemoteViews(c.getPackageName(), large ? R.layout.panchang_count_large : wide ? R.layout.panchang_count_wide : R.layout.panchang_count);
    JSONObject first = null;
    StringBuilder list = new StringBuilder();
    int shown = 0;
    JSONArray vr = f.ok ? f.feed.optJSONArray("vrat") : null;
    if (vr != null) for (int i = 0; i < vr.length(); i++) {
      JSONObject x = vr.optJSONObject(i);
      if (x == null || x.optString("date").compareTo(f.todayKey) < 0) continue;
      if (first == null) { first = x; continue; }
      if (shown < 6) {
        if (shown++ > 0) list.append('\n');
        list.append(f.dayLabel(x.optString("date"))).append("   ").append(name(x));
      }
    }
    if (first == null) {
      v.setTextViewText(R.id.pBig, "—");
      v.setTextViewText(R.id.pUnit, "");
      v.setTextViewText(R.id.pHeadline, f.ok ? "Nothing in the next weeks" : "Open Soma once");
      return v;
    }
    int days = f.daysUntil(first.optString("date"));
    v.setTextViewText(R.id.pBig, days == 0 ? "Today" : String.valueOf(days));
    v.setTextViewText(R.id.pUnit, days == 0 ? "" : days == 1 ? "day to" : "days to");
    v.setTextViewText(R.id.pHeadline, name(first));
    if (wide) {
      v.setTextViewText(R.id.pSub, f.dayLabel(first.optString("date")));
      v.setTextViewText(R.id.pDetail, first.optString("d"));
    }
    if (large) v.setTextViewText(R.id.pList, list.toString());
    return v;
  }

  private static String name(JSONObject x) { String en = x.optString("en"); return en.isEmpty() ? x.optString("n") : en; }

  // ---- Now: Choghadiya strip ----------------------------------------------------------------------------------

  private static RemoteViews now(Context c, Feed f, SomaWidget.Palette p, float w, float h) {
    boolean small = w < 250, tall = !small && h >= 110;
    RemoteViews v = new RemoteViews(c.getPackageName(), small ? R.layout.panchang_now_small : tall ? R.layout.panchang_now_tall : R.layout.panchang_now);
    if (!f.ok || f.chog == null) {
      v.setTextViewText(R.id.pHeadline, f.ok ? "No sunrise today" : "Open Soma once");
      v.setTextViewText(R.id.pSub, "");
      return v;
    }
    String q = f.chog.optString("q");
    boolean rahu = f.inRahu();
    v.setTextViewText(R.id.pHeadline, rahu ? "Rahu Kaal" : f.chog.optString("en"));
    v.setTextColor(R.id.pHeadline, rahu ? p.bad : p.quality(q));
    long until = rahu ? f.rahuEnd() : f.chog.optLong("e");
    v.setTextViewText(R.id.pSub, (rahu ? "Hold new starts" : meaning(q)) + " · until " + f.time(until));
    if (!small) v.setImageViewBitmap(R.id.pArt, f.art("strip", () -> strip(f, p)));
    if (tall) {
      StringBuilder b = new StringBuilder();
      int shown = 0;
      for (int i = f.chogIdx + 1; i < f.chogs.length() && shown < 3; i++, shown++) {
        JSONObject x = f.chogs.optJSONObject(i);
        if (shown > 0) b.append("   ·   ");
        b.append(f.time(x.optLong("s"))).append(' ').append(x.optString("en"));
      }
      v.setTextViewText(R.id.pDetail, b.toString());
      JSONObject d = f.today;
      if (d != null) {
        JSONArray r = d.optJSONArray("rahu");
        if (r != null) v.setTextViewText(R.id.pRise, "Rahu Kaal " + f.range(r.optLong(0), r.optLong(1)));
      }
    }
    return v;
  }

  static String meaning(String q) { return "good".equals(q) ? "Good to begin" : "bad".equals(q) ? "Avoid new beginnings" : "Good for travel"; }

  /** The Vedic day from sunrise to the next sunrise as 16 Choghadiya blocks; night dimmed, Rahu Kaal outlined, a gold tick at now. */
  private static Bitmap strip(Feed f, SomaWidget.Palette p) {
    int W = 600, H = 56;
    Bitmap b = Bitmap.createBitmap(W, H, Bitmap.Config.ARGB_8888);
    Canvas cv = new Canvas(b);
    if (f.vedic == null) return b;
    long a = f.vedic.optLong("rise"), z = f.vedic.optLong("next");
    if (z <= a) return b;
    float top = 14, bottom = H - 14, gap = 3;
    Paint fill = new Paint(Paint.ANTI_ALIAS_FLAG);
    for (int i = 0; i < f.chogs.length(); i++) {
      JSONObject x = f.chogs.optJSONObject(i);
      long s = x.optLong("s"), e = x.optLong("e");
      if (e <= a || s >= z) continue;
      float x0 = (float) ((Math.max(s, a) - a) / (double) (z - a) * W), x1 = (float) ((Math.min(e, z) - a) / (double) (z - a) * W);
      fill.setColor(alpha(p.quality(x.optString("q")), x.optInt("day", 1) == 1 ? 1f : 0.35f));
      cv.drawRoundRect(x0 + gap / 2, top, x1 - gap / 2, bottom, 6, 6, fill);
    }
    JSONArray r = f.vedic.optJSONArray("rahu");
    if (r != null) {
      Paint ring = new Paint(Paint.ANTI_ALIAS_FLAG);
      ring.setStyle(Paint.Style.STROKE);
      ring.setStrokeWidth(3);
      ring.setColor(p.bad);
      float x0 = (float) ((r.optLong(0) - a) / (double) (z - a) * W), x1 = (float) ((r.optLong(1) - a) / (double) (z - a) * W);
      cv.drawRoundRect(x0, top - 6, x1, bottom + 6, 8, 8, ring);
    }
    float nx = (float) ((f.now - a) / (double) (z - a) * W);
    Paint tick = new Paint(Paint.ANTI_ALIAS_FLAG);
    tick.setColor(p.ink);
    tick.setStrokeWidth(4);
    tick.setStrokeCap(Paint.Cap.ROUND);
    cv.drawLine(nx, 3, nx, H - 3, tick);
    return b;
  }

  // ---- Day sheet (tablets, unfolded foldables) ----------------------------------------------------------------

  private static final int[] DAY_ROWS = {R.id.pD1, R.id.pD2, R.id.pD3, R.id.pD4, R.id.pD5, R.id.pD6, R.id.pD7, R.id.pD8};
  private static final int[] NIGHT_ROWS = {R.id.pN1, R.id.pN2, R.id.pN3, R.id.pN4, R.id.pN5, R.id.pN6, R.id.pN7, R.id.pN8};

  private static RemoteViews day(Context c, Feed f, SomaWidget.Palette p, float w, float h) {
    boolean wide = w >= 450;
    RemoteViews v = new RemoteViews(c.getPackageName(), wide ? R.layout.panchang_day_wide : R.layout.panchang_day);
    v.setTextViewText(R.id.pSub, f.ok ? f.dateLabel() + (f.city.isEmpty() ? "" : " · " + f.city) : "Open Soma once to set your city");
    if (!f.ok) return v;
    v.setTextViewText(R.id.pHeadline, SomaWidget.tithiEnglish(f.tithiIndex) + (f.nak == null ? "" : " · " + f.nak.optString("n")));
    v.setImageViewBitmap(R.id.pArt, f.art("moon", () -> SomaWidget.moon(f.tithiIndex, p, 200)));
    JSONObject d = f.vedic;
    if (d != null) {
      v.setTextViewText(R.id.pRise, "Sunrise " + f.time(d.optLong("rise")) + "   ·   Sunset " + f.time(d.optLong("set")));
      StringBuilder k = new StringBuilder();
      appendRange(k, f, "Rahu Kaal", d.optJSONArray("rahu"));
      appendRange(k, f, "Yamaganda", d.optJSONArray("yama"));
      appendRange(k, f, "Gulika", d.optJSONArray("gulika"));
      appendRange(k, f, "Abhijit", d.optJSONArray("abhijit"));
      v.setTextViewText(R.id.pDetail, k.toString());
      int di = 0, ni = 0;
      for (int i = 0; i < f.chogs.length(); i++) {
        JSONObject x = f.chogs.optJSONObject(i);
        if (x.optLong("s") < d.optLong("rise") - 60_000L || x.optLong("s") >= d.optLong("next") - 60_000L) continue;
        boolean isDay = x.optInt("day", 1) == 1;
        int[] rows = isDay ? DAY_ROWS : NIGHT_ROWS;
        int at = isDay ? di++ : ni++;
        if (at >= rows.length) continue;
        boolean current = f.chogIdx == i;
        v.setTextViewText(rows[at], (current ? "● " : "") + f.time(x.optLong("s")) + "   " + x.optString("en"));
        v.setTextColor(rows[at], p.quality(x.optString("q")));
      }
    }
    if (wide) {
      StringBuilder list = new StringBuilder();
      JSONArray vr = f.feed.optJSONArray("vrat");
      int shown = 0;
      if (vr != null) for (int i = 0; i < vr.length() && shown < 6; i++) {
        JSONObject x = vr.optJSONObject(i);
        if (x == null || x.optString("date").compareTo(f.todayKey) < 0) continue;
        if (shown++ > 0) list.append('\n');
        list.append(f.dayLabel(x.optString("date"))).append("   ").append(name(x));
      }
      v.setTextViewText(R.id.pList, list.toString());
    }
    return v;
  }

  /** Two per line: "Rahu Kaal … · Yamaganda …", then "Gulika … · Abhijit …". */
  private static void appendRange(StringBuilder b, Feed f, String label, JSONArray r) {
    if (r == null) return;
    int items = b.length() == 0 ? 0 : b.toString().split("   ·   |\n").length;
    if (items > 0) b.append(items % 2 == 1 ? "   ·   " : "\n");
    b.append(label).append("  ").append(f.range(r.optLong(0), r.optLong(1)));
  }

  // ---- Shared ------------------------------------------------------------------------------------------------

  static int alpha(int color, float a) { return (Math.round(a * 255) << 24) | (color & 0x00FFFFFF); }

  /** One shared inexact alarm for the family; at most 15 minutes apart so the sun and the now tick keep moving. */
  private static void schedule(Context c, long at) {
    AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
    if (am == null) return;
    Intent tick = new Intent(c, Tick.class).setAction(ACTION_TICK);
    PendingIntent pi = PendingIntent.getBroadcast(c, 7, tick, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    am.cancel(pi);
    if (at <= 0) return;
    long now = System.currentTimeMillis();
    at = Math.max(now + 30_000L, Math.min(at + 5_000L, now + 15 * 60_000L));
    am.setWindow(AlarmManager.RTC, at, 60_000L, pi);
  }

  /** What holds at one instant, read from the stored feed. */
  static final class Feed {
    boolean ok = false;
    JSONObject feed = new JSONObject(), today, tomorrow, vedic, tithi, nak, chog;
    JSONArray chogs = new JSONArray();
    int chogIdx = -1, tithiIndex = -1;
    long now, next;
    String city = "", todayKey = "", tomorrowKey = "";
    TimeZone tz = TimeZone.getDefault();
    private SimpleDateFormat timeFmt, keyFmt, dayFmt, dateFmt;
    /* Bitmaps are drawn once per refresh and shared by every size of every widget, keeping the parcel small. */
    private final Map<String, Bitmap> arts = new HashMap<>();
    interface Draw { Bitmap make(); }
    Bitmap art(String key, Draw d) { Bitmap b = arts.get(key); if (b == null) { b = d.make(); arts.put(key, b); } return b; }

    static Feed load(Context c, long now) {
      Feed f = new Feed();
      f.now = now;
      f.next = now + 60 * 60_000L;
      SharedPreferences p = c.getSharedPreferences(SomaWidget.PREFS, Context.MODE_PRIVATE);
      String raw = p.getString(SomaWidget.FEED, null);
      try { f.fill(raw == null ? new JSONObject() : new JSONObject(raw)); }
      catch (Exception e) { Log.w("SomaWidget", "Unreadable widget feed", e); f.ok = false; }
      return f;
    }

    private void fill(JSONObject j) throws Exception {
      feed = j;
      tz = TimeZone.getTimeZone(j.optString("zone", TimeZone.getDefault().getID()));
      timeFmt = fmt("h:mm a"); keyFmt = fmt("yyyy-MM-dd"); dayFmt = fmt("EEE d MMM"); dateFmt = fmt("EEEE d MMMM");
      city = j.optString("city", "");
      long midnight = startOfNextDay();
      todayKey = keyFmt.format(new Date(now));
      tomorrowKey = keyFmt.format(new Date(midnight + 60_000L));
      long soonest = midnight;
      JSONArray days = j.optJSONArray("days");
      if (days != null) for (int i = 0; i < days.length(); i++) {
        JSONObject d = days.getJSONObject(i);
        if (todayKey.equals(d.optString("date"))) today = d;
        if (tomorrowKey.equals(d.optString("date"))) tomorrow = d;
        if (d.optLong("rise") <= now && now < d.optLong("next")) vedic = d;
      }
      tithi = at(j.optJSONArray("tithi"));
      if (tithi == null) { ok = false; return; }
      ok = true;
      tithiIndex = SomaWidget.tithiIndex(tithi.optString("n"));
      soonest = Math.min(soonest, tithi.optLong("e"));
      nak = at(j.optJSONArray("nak"));
      if (nak != null) soonest = Math.min(soonest, nak.optLong("e"));
      JSONArray cs = j.optJSONArray("chog");
      if (cs != null) {
        chogs = cs;
        for (int i = 0; i < cs.length(); i++) {
          JSONObject x = cs.getJSONObject(i);
          if (x.optLong("s") <= now && now < x.optLong("e")) { chogIdx = i; chog = x; soonest = Math.min(soonest, x.optLong("e")); break; }
        }
      }
      for (JSONObject d : new JSONObject[]{vedic, today}) {
        if (d == null) continue;
        for (String key : new String[]{"rahu", "brahma", "abhijit"}) {
          JSONArray r = d.optJSONArray(key);
          if (r == null) continue;
          if (r.optLong(0) > now) soonest = Math.min(soonest, r.optLong(0));
          if (r.optLong(1) > now) soonest = Math.min(soonest, r.optLong(1));
        }
        for (String key : new String[]{"rise", "set", "next"}) if (d.optLong(key) > now) soonest = Math.min(soonest, d.optLong(key));
      }
      next = soonest;
    }

    boolean inRahu() {
      JSONObject d = vedic != null ? vedic : today;
      JSONArray r = d == null ? null : d.optJSONArray("rahu");
      return r != null && r.optLong(0) <= now && now < r.optLong(1);
    }
    long rahuEnd() { JSONObject d = vedic != null ? vedic : today; return d.optJSONArray("rahu").optLong(1); }

    /** Brahma muhurat before the coming sunrise (or today's, while it is still running). */
    JSONArray nextBrahma() {
      for (JSONObject d : new JSONObject[]{today, tomorrow}) {
        if (d == null) continue;
        JSONArray b = d.optJSONArray("brahma");
        if (b != null && b.optLong(1) > now) return b;
      }
      return null;
    }

    /** Illuminated fraction from the elongation implied by the tithi and how far through it we are. */
    double illumination() {
      if (tithi == null || tithiIndex < 0) return 0;
      long s = tithi.optLong("s"), e = tithi.optLong("e");
      double frac = e > s ? Math.max(0, Math.min(1, (now - s) / (double) (e - s))) : 0.5;
      double elong = Math.toRadians((tithiIndex + frac) * 12.0);
      return (1 - Math.cos(elong)) / 2;
    }

    JSONObject nextPhase(int k) {
      JSONArray a = feed.optJSONArray("phases");
      if (a == null) return null;
      for (int i = 0; i < a.length(); i++) { JSONObject x = a.optJSONObject(i); if (x != null && x.optInt("k") == k && x.optLong("t") > now) return x; }
      return null;
    }

    int daysUntil(String date) {
      try {
        Calendar a = Calendar.getInstance(tz), b = Calendar.getInstance(tz);
        a.setTime(keyFmt.parse(todayKey)); b.setTime(keyFmt.parse(date));
        return (int) Math.round((b.getTimeInMillis() - a.getTimeInMillis()) / 86_400_000.0);
      } catch (Exception e) { return 0; }
    }

    String time(long t) { return timeFmt.format(new Date(t)).toLowerCase(Locale.ROOT); }
    String range(long a, long b) { return time(a) + " – " + time(b); }
    String dateLabel() { return dateFmt.format(new Date(now)); }
    String dayLabel(String key) {
      if (key.equals(todayKey)) return "Today";
      if (key.equals(tomorrowKey)) return "Tomorrow";
      try { return dayFmt.format(keyFmt.parse(key)); } catch (Exception e) { return key; }
    }
    String when(long t) {
      String k = keyFmt.format(new Date(t));
      return dayLabel(k) + ", " + time(t);
    }
    static String span(long ms) {
      long m = Math.max(0, ms) / 60_000L;
      return m >= 60 ? (m / 60) + "h " + (m % 60) + "m" : m + "m";
    }

    private JSONObject at(JSONArray a) throws Exception {
      if (a == null) return null;
      for (int i = 0; i < a.length(); i++) { JSONObject o = a.getJSONObject(i); if (o.optLong("s") <= now && now < o.optLong("e")) return o; }
      return null;
    }
    private SimpleDateFormat fmt(String pattern) { SimpleDateFormat f = new SimpleDateFormat(pattern, Locale.US); f.setTimeZone(tz); return f; }
    private long startOfNextDay() {
      Calendar cal = Calendar.getInstance(tz);
      cal.setTimeInMillis(now); cal.add(Calendar.DAY_OF_MONTH, 1);
      cal.set(Calendar.HOUR_OF_DAY, 0); cal.set(Calendar.MINUTE, 0); cal.set(Calendar.SECOND, 0); cal.set(Calendar.MILLISECOND, 0);
      return cal.getTimeInMillis();
    }
  }

  // ---- Providers -----------------------------------------------------------------------------------------------

  /** Shared behaviour: any update, resize or system time change redraws the whole family. */
  public abstract static class Base extends AppWidgetProvider {
    @Override public void onUpdate(Context c, AppWidgetManager m, int[] ids) { refreshAll(c); }
    @Override public void onAppWidgetOptionsChanged(Context c, AppWidgetManager m, int id, Bundle o) { refreshAll(c); }
    @Override public void onDisabled(Context c) { refreshAll(c); }
  }
  public static final class Sun extends Base {}
  public static final class Moon extends Base {}
  public static final class Festival extends Base {}
  public static final class Now extends Base {}
  public static final class Day extends Base {}

  /** Alarm, boot and clock changes. */
  public static final class Tick extends BroadcastReceiver {
    @Override public void onReceive(Context c, Intent i) { refreshAll(c); }
  }
}
