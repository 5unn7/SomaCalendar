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
  private static final Class<?>[] PROVIDERS = {Sun.class, Moon.class, Festival.class, Now.class, Day.class, Sky.class};

  /** Redraw every placed widget of this family and schedule the next wake-up. Called by the app after a new feed. */
  static void refreshAll(Context c) { refreshAll(c, null); }

  /**
   * As above; when a Sky widget is placed and live weather is on and due, also fetch a new forecast and redraw again
   * once it lands. A receiver passes its goAsync() result so the process stays alive for the fetch.
   */
  static void refreshAll(Context c, BroadcastReceiver.PendingResult pending) {
    AppWidgetManager m = AppWidgetManager.getInstance(c);
    long now = System.currentTimeMillis();
    Feed f = Feed.load(c, now);
    boolean any = false, sky = false;
    for (Class<?> k : PROVIDERS) {
      int[] ids = m.getAppWidgetIds(new ComponentName(c, k));
      for (int id : ids) { any = true; if (k == Sky.class) sky = true; push(c, m, id, k, f); }
    }
    long next = any ? f.next : 0;
    // The weather layer changes with the forecast hour, so a Sky widget wakes at least at the top of each hour.
    if (sky) next = Math.min(next, (now / 3600_000L + 1) * 3600_000L);
    schedule(c, next);
    if (sky && Weather.due(c, f.lat, f.lon, now)) {
      final Context app = c.getApplicationContext();
      Weather.refresh(app, f.lat, f.lon, false, changed -> {
        if (changed) refreshSky(app);
        if (pending != null) pending.finish();
      });
    } else if (pending != null) pending.finish();
  }

  /** Redraw only the Sky widgets (after a new forecast). */
  static void refreshSky(Context c) {
    AppWidgetManager m = AppWidgetManager.getInstance(c);
    Feed f = Feed.load(c, System.currentTimeMillis());
    for (int id : m.getAppWidgetIds(new ComponentName(c, Sky.class))) push(c, m, id, Sky.class, f);
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
    if (k == Sky.class) return new float[][]{{110, 110}, {250, 110}, {250, 250}, {450, 250}};
    return new float[][]{{250, 250}, {450, 300}};
  }

  private static RemoteViews render(Context c, Class<?> k, Feed f, float w, float h) {
    SomaWidget.Palette p = SomaWidget.Palette.of(c);
    RemoteViews v;
    if (k == Sun.class) v = sun(c, f, p, w, h);
    else if (k == Moon.class) v = moon(c, f, p, w, h);
    else if (k == Festival.class) v = festival(c, f, p, w, h);
    else if (k == Now.class) v = now(c, f, p, w, h);
    else if (k == Sky.class) v = sky(c, f, w, h);
    else v = day(c, f, p, w, h);
    Intent open = new Intent(c, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    v.setOnClickPendingIntent(R.id.widgetRoot, PendingIntent.getActivity(c, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));
    return v;
  }

  // ---- Sun ----------------------------------------------------------------------------------------------------

  private static RemoteViews sun(Context c, Feed f, SomaWidget.Palette p, float w, float h) {
    boolean small = h < 100, large = w >= 300 && h >= 220;
    RemoteViews v = new RemoteViews(c.getPackageName(), small ? R.layout.panchang_sun_small : large ? R.layout.panchang_sun_large : R.layout.panchang_sun);
    // Sun times follow the civil day; the sunrise-to-sunrise Vedic day is only for Choghadiya.
    JSONObject d = f.today != null ? f.today : f.vedic;
    if (!f.ok || d == null) {
      if (small) v.setTextViewText(R.id.pHeadline, "Soma");
      v.setTextViewText(R.id.pRise, f.ok ? f.t("wNoSunrise", "No sunrise today") : f.t("wOpenOnce", "Open Soma once"));
      v.setTextViewText(R.id.pSet, "");
      if (!small) { v.setTextViewText(R.id.pHeadline, f.ok ? f.t("wPolar", "Polar night or day") : f.t("wSetCity", "Set your city in Soma")); v.setImageViewBitmap(R.id.pArt, f.art("sun0", () -> sunArc(null, f, p))); }
      return v;
    }
    long rise = d.optLong("rise"), set = d.optLong("set"), next = d.optLong("next");
    boolean day = f.now >= rise && f.now < set;
    long nextRise = f.now < rise ? rise : next;
    v.setTextViewText(R.id.pRise, (small ? "↑ " : f.t("sunrise", "Sunrise") + " ") + f.time(rise));
    v.setTextViewText(R.id.pSet, (small ? "↓ " : f.t("sunset", "Sunset") + " ") + f.time(set));
    if (small) {
      v.setTextViewText(R.id.pHeadline, day ? f.t("wSetsIn", "Sets in {x}", f.span(set - f.now)) : f.t("wRisesIn", "Rises in {x}", f.span(nextRise - f.now)));
      return v;
    }
    String headline;
    if (day) headline = f.t("wSunsetIn", "Sunset in {x}", f.span(set - f.now));
    else headline = f.t("wSunriseIn", "Sunrise in {x}", f.span(nextRise - f.now));
    JSONArray brahma = f.nextBrahma();
    if (brahma != null && f.now >= brahma.optLong(0) && f.now < brahma.optLong(1)) headline = f.t("wBrahmaNow", "Brahma muhurat now");
    v.setTextViewText(R.id.pHeadline, headline);
    v.setTextViewText(R.id.pSub, f.span(set - rise) + " of daylight · " + f.dateLabel());
    v.setImageViewBitmap(R.id.pArt, f.art("sun", () -> sunArc(d, f, p)));
    if (large) {
      StringBuilder b = new StringBuilder();
      if (brahma != null) b.append(f.t("brahma", "Brahma muhurat")).append("  ").append(f.range(brahma.optLong(0), brahma.optLong(1))).append('\n');
      b.append(f.t("wNoon", "Solar noon")).append("  ").append(f.time(d.optLong("noon")));
      JSONArray ab = d.optJSONArray("abhijit");
      if (ab != null) b.append("   ·   Abhijit  ").append(f.range(ab.optLong(0), ab.optLong(1)));
      b.append('\n');
      long mr = d.optLong("mrise"), ms = d.optLong("mset");
      b.append(f.t("moonrise", "Moonrise")).append("  ").append(mr > 0 ? f.time(mr) : "—").append("   ·   ").append(f.t("moonset", "Moonset")).append("  ").append(ms > 0 ? f.time(ms) : "—");
      if (f.tomorrow != null) b.append('\n').append(f.dayLabel(f.tomorrowKey)).append("  ↑ ").append(f.time(f.tomorrow.optLong("rise"))).append("  ↓ ").append(f.time(f.tomorrow.optLong("set")));
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
    if (!f.ok) { v.setTextViewText(R.id.pHeadline, "Soma"); v.setTextViewText(R.id.pSub, f.t("wOpenOnce", "Open Soma once")); return v; }
    v.setTextViewText(R.id.pHeadline, f.tithiName());
    int lit = (int) Math.round(f.illumination() * 100);
    v.setTextViewText(R.id.pSub, f.t("wLit", "{x}% lit", String.valueOf(lit)) + " · " + (f.tithiIndex < 15 ? f.t("wWaxing", "Shukla, waxing") : f.t("wWaning", "Krishna, waning")));
    if (!wide) return v;
    JSONObject ph = f.nextPhase(f.tithiIndex < 15 ? 2 : 0);
    String nextLine = ph == null ? "" : (ph.optInt("k") == 2 ? f.t("purnima", "Purnima") : f.t("amavasya", "Amavasya")) + " " + f.when(ph.optLong("t"));
    v.setTextViewText(R.id.pDetail, nextLine);
    JSONObject civil = f.today;
    if (civil != null) {
      long mr = civil.optLong("mrise"), ms = civil.optLong("mset");
      v.setTextViewText(R.id.pRise, f.t("moonrise", "Moonrise") + " " + (mr > 0 ? f.time(mr) : "—") + "  ·  " + f.t("moonset", "Moonset") + " " + (ms > 0 ? f.time(ms) : "—"));
    }
    if (large) {
      StringBuilder b = new StringBuilder();
      String[] names = {f.t("phase0", "New moon"), f.t("phase1", "First quarter"), f.t("phase2", "Full moon"), f.t("phase3", "Last quarter")};
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
      v.setTextViewText(R.id.pHeadline, f.ok ? f.t("wNothing", "Nothing in the next weeks") : f.t("wOpenOnce", "Open Soma once"));
      return v;
    }
    int days = f.daysUntil(first.optString("date"));
    v.setTextViewText(R.id.pBig, days == 0 ? f.t("today2", "Today") : String.valueOf(days));
    v.setTextViewText(R.id.pUnit, days == 0 ? "" : days == 1 ? f.t("wDayTo", "day to") : f.t("wDaysTo", "days to"));
    v.setTextViewText(R.id.pHeadline, name(first));
    if (wide) {
      v.setTextViewText(R.id.pSub, f.dayLabel(first.optString("date")));
      v.setTextViewText(R.id.pDetail, first.optString("d"));
    }
    if (large) v.setTextViewText(R.id.pList, list.toString());
    return v;
  }

  private static String name(JSONObject x) { String l = x.optString("l"); if (!l.isEmpty()) return l; String en = x.optString("en"); return en.isEmpty() ? x.optString("n") : en; }
  /** A Choghadiya, tithi or nakshatra in the app language when the feed carries it. */
  static String local(JSONObject x) { return x == null ? "" : !x.optString("l").isEmpty() ? x.optString("l") : !x.optString("en").isEmpty() ? x.optString("en") : x.optString("n"); }

  // ---- Now: Choghadiya strip ----------------------------------------------------------------------------------

  private static RemoteViews now(Context c, Feed f, SomaWidget.Palette p, float w, float h) {
    boolean small = w < 250, tall = !small && h >= 110;
    RemoteViews v = new RemoteViews(c.getPackageName(), small ? R.layout.panchang_now_small : tall ? R.layout.panchang_now_tall : R.layout.panchang_now);
    if (!f.ok || f.chog == null) {
      v.setTextViewText(R.id.pHeadline, f.ok ? f.t("wNoSunrise", "No sunrise today") : f.t("wOpenOnce", "Open Soma once"));
      v.setTextViewText(R.id.pSub, "");
      return v;
    }
    String q = f.chog.optString("q");
    boolean rahu = f.inRahu();
    v.setTextViewText(R.id.pHeadline, rahu ? f.t("rahu", "Rahu Kaal") : local(f.chog));
    v.setTextColor(R.id.pHeadline, rahu ? p.bad : p.quality(q));
    long until = rahu ? f.rahuEnd() : f.chog.optLong("e");
    v.setTextViewText(R.id.pSub, (rahu ? f.t("wHold", "Hold new starts") : meaning(f, q)) + " · " + f.t("until", "until {x}", f.time(until)));
    if (!small) v.setImageViewBitmap(R.id.pArt, f.art("strip", () -> strip(f, p)));
    if (tall) {
      StringBuilder b = new StringBuilder();
      int shown = 0;
      for (int i = f.chogIdx + 1; i < f.chogs.length() && shown < 3; i++, shown++) {
        JSONObject x = f.chogs.optJSONObject(i);
        if (shown > 0) b.append("   ·   ");
        b.append(f.time(x.optLong("s"))).append(' ').append(local(x));
      }
      v.setTextViewText(R.id.pDetail, b.toString());
      JSONObject d = f.today;
      if (d != null) {
        JSONArray r = d.optJSONArray("rahu");
        if (r != null) v.setTextViewText(R.id.pRise, f.t("rahu", "Rahu Kaal") + " " + f.range(r.optLong(0), r.optLong(1)));
      }
    }
    return v;
  }

  static String meaning(Feed f, String q) { return "good".equals(q) ? f.t("wGoodBegin", "Good to begin") : "bad".equals(q) ? f.t("wAvoidBegin", "Avoid new beginnings") : f.t("wGoodTravel", "Good for travel"); }

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
    v.setTextViewText(R.id.pSub, f.ok ? f.dateLabel() + (f.city.isEmpty() ? "" : " · " + f.city) : f.t("wSetCityOnce", "Open Soma once to set your city"));
    if (!f.ok) return v;
    v.setTextViewText(R.id.pHeadline, f.tithiName() + (f.nak == null ? "" : " · " + local(f.nak)));
    v.setImageViewBitmap(R.id.pArt, f.art("moon", () -> SomaWidget.moon(f.tithiIndex, p, 200)));
    JSONObject civil = f.today != null ? f.today : f.vedic, d = f.vedic;
    if (civil != null) {
      v.setTextViewText(R.id.pRise, f.t("sunrise", "Sunrise") + " " + f.time(civil.optLong("rise")) + "   ·   " + f.t("sunset", "Sunset") + " " + f.time(civil.optLong("set")));
      StringBuilder k = new StringBuilder();
      appendRange(k, f, f.t("rahu", "Rahu Kaal"), civil.optJSONArray("rahu"));
      appendRange(k, f, f.t("yamaganda", "Yamaganda"), civil.optJSONArray("yama"));
      appendRange(k, f, f.t("gulika", "Gulika"), civil.optJSONArray("gulika"));
      appendRange(k, f, f.t("abhijit", "Abhijit"), civil.optJSONArray("abhijit"));
      v.setTextViewText(R.id.pDetail, k.toString());
    }
    if (d != null) {
      int di = 0, ni = 0;
      for (int i = 0; i < f.chogs.length(); i++) {
        JSONObject x = f.chogs.optJSONObject(i);
        if (x.optLong("s") < d.optLong("rise") - 60_000L || x.optLong("s") >= d.optLong("next") - 60_000L) continue;
        boolean isDay = x.optInt("day", 1) == 1;
        int[] rows = isDay ? DAY_ROWS : NIGHT_ROWS;
        int at = isDay ? di++ : ni++;
        if (at >= rows.length) continue;
        boolean current = f.chogIdx == i;
        v.setTextViewText(rows[at], (current ? "● " : "") + f.time(x.optLong("s")) + "   " + local(x));
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

  // ---- Sky and weather ----------------------------------------------------------------------------------------

  private static final int[] HOUR_CELLS = {R.id.wC1, R.id.wC2, R.id.wC3, R.id.wC4, R.id.wC5, R.id.wC6, R.id.wC7, R.id.wC8};
  private static final int[] HOUR_TIMES = {R.id.wH1, R.id.wH2, R.id.wH3, R.id.wH4, R.id.wH5, R.id.wH6, R.id.wH7, R.id.wH8};
  private static final int[] HOUR_ICONS = {R.id.wI1, R.id.wI2, R.id.wI3, R.id.wI4, R.id.wI5, R.id.wI6, R.id.wI7, R.id.wI8};
  private static final int[] HOUR_TEMPS = {R.id.wT1, R.id.wT2, R.id.wT3, R.id.wT4, R.id.wT5, R.id.wT6, R.id.wT7, R.id.wT8};
  private static final int[] FX = {R.id.fxGlow, R.id.fxStars, R.id.fxFog, R.id.fxClouds, R.id.fxRain, R.id.fxSnow, R.id.fxWind, R.id.fxFlash};

  /**
   * Temperature and the sky as it is now: a time-of-day and weather gradient, moving rain, snow, wind, clouds, fog,
   * lightning, a breathing sun or twinkling stars, plus sunrise, sunset and the moon. Without live weather (off, or
   * no forecast yet) it is still a useful sun-and-moon widget, all offline.
   */
  private static RemoteViews sky(Context c, Feed f, float w, float h) {
    boolean small = w < 250, large = !small && h >= 250, xl = large && w >= 450;
    RemoteViews v = new RemoteViews(c.getPackageName(), small ? R.layout.wx_small : large ? R.layout.wx_large : R.layout.wx_wide);
    boolean on = Weather.on(c), fahr = Weather.fahrenheit(c);
    JSONObject civil = f.today != null ? f.today : f.vedic;
    long rise = civil == null ? 0 : civil.optLong("rise"), set = civil == null ? 0 : civil.optLong("set");
    long nextRise = f.now < rise ? rise : f.tomorrow != null ? f.tomorrow.optLong("rise") : 0;
    boolean day = f.isDay(f.now);
    String phase = rise > 0 && Math.abs(f.now - rise) < 40 * 60_000L ? "dawn" : set > 0 && Math.abs(f.now - set) < 40 * 60_000L ? "dusk" : day ? "day" : "night";
    // Only a forecast for the place on the widget: right after a change of city the old one is not shown.
    Weather.Now wx = Weather.Now.at(Weather.storedFor(c, f.lat, f.lon), f.now, f.endOfToday());
    String kind = wx.ok ? wx.kind : "";

    v.setInt(R.id.widgetRoot, "setBackgroundResource", background(kind, phase, day));
    for (int id : FX) v.setViewVisibility(id, View.GONE);
    if (wx.ok) effects(v, kind, day, wx.windy);
    // A windy, dry sky shows the wind rather than a plain sun or cloud.
    boolean dryWind = wx.ok && wx.windy && ("clear".equals(kind) || "fair".equals(kind) || "partly".equals(kind) || "cloudy".equals(kind));
    v.setImageViewResource(R.id.wIcon, dryWind ? R.drawable.wx_ic_wind : icon(kind, day));

    String place = f.city.isEmpty() ? "SKY" : f.city.toUpperCase(Locale.ROOT);
    v.setTextViewText(R.id.wPlace, place);
    String sunNext = !f.ok || civil == null ? "" : day ? f.t("sunset", "Sunset") + " " + f.time(set) : nextRise > 0 ? f.t("sunrise", "Sunrise") + " " + f.time(nextRise) : "";
    String sunIn = !f.ok || civil == null ? "" : day ? f.t("wSunsetIn", "Sunset in {x}", Feed.span(set - f.now)) : nextRise > 0 ? f.t("wSunriseIn", "Sunrise in {x}", Feed.span(nextRise - f.now)) : "";
    String cond = wx.ok ? f.t("wx_" + kind, Weather.label(kind)) + (wx.windy && !"thunder".equals(kind) ? " · " + f.t("wxWindy", "Windy") : "") : "";
    String hiLo = wx.ok ? "H " + Weather.deg(wx.hi, fahr) + "  L " + Weather.deg(wx.lo, fahr) : "";
    String hint = on ? f.t("wFetching", "Fetching the weather…") : f.t("wTurnOn", "Turn on live weather in Soma");
    if (!f.ok) hint = f.t("wSetCityOnce", "Open Soma once to set your city");
    if (wx.ok) {
      v.setTextViewText(R.id.wTemp, Weather.deg(wx.temp, fahr));
      v.setTextViewText(R.id.wCond, cond);
    } else {
      // No forecast: the next sun event takes the temperature's place.
      v.setTextViewTextSize(R.id.wTemp, android.util.TypedValue.COMPLEX_UNIT_SP, small ? 24 : 30);
      v.setTextViewText(R.id.wTemp, f.ok && civil != null ? f.time(day ? set : nextRise > 0 ? nextRise : set) : "—");
      v.setTextViewText(R.id.wCond, f.ok ? sunIn : "Soma");
    }
    if (small) {
      v.setTextViewText(R.id.wSun, wx.ok ? (day ? "↓ " + f.time(set) : nextRise > 0 ? "↑ " + f.time(nextRise) : hiLo) : hint);
    } else {
      v.setTextViewText(R.id.wHiLo, wx.ok ? hiLo : hint);
      v.setTextViewText(R.id.wRise, civil == null ? "" : "↑ " + f.time(day || nextRise == 0 ? rise : nextRise));
      v.setTextViewText(R.id.wSet, civil == null ? "" : "↓ " + f.time(set));
      SomaWidget.Palette white = new SomaWidget.Palette();
      white.ink = 0xFFF4EEDF; white.muted = 0xFFFFFFFF;
      v.setImageViewBitmap(R.id.wMoon, f.art("skymoon", () -> SomaWidget.moon(f.tithiIndex, white, 64)));
      v.setTextViewText(R.id.wMoonText, f.ok ? Math.round(f.illumination() * 100) + "%" : "");
    }
    if (large) {
      StringBuilder d = new StringBuilder();
      if (wx.ok) {
        d.append(f.t("wWind", "Wind")).append(' ').append(fahr ? Math.round(wx.wind * 2.237) + " " + f.t("mph", "mph") : Math.round(wx.wind * 3.6) + " " + f.t("kmh", "km/h"));
        d.append("  ·  ").append(f.t("wHumidity", "Humidity")).append(' ').append(wx.humidity).append('%');
        JSONObject h0 = wx.hour(0);
        double mm = h0 == null ? 0 : h0.optDouble("p");
        if (mm >= 0.1) d.append("  ·  ").append(String.format(Locale.US, "%.1f mm", mm)).append(' ').append(f.t("wThisHour", "this hour"));
      } else {
        if (civil != null) d.append(f.t("wDaylight", "{x} of daylight", Feed.span(set - rise))).append("  ·  ");
        d.append(f.tithiName());
      }
      v.setTextViewText(R.id.wDetail, d.toString());
      v.setViewVisibility(R.id.wHours, wx.ok ? View.VISIBLE : View.GONE);
      for (int i = 0; i < HOUR_CELLS.length; i++) {
        JSONObject x = wx.hour(i + 1);
        boolean show = wx.ok && x != null && (i < 6 || xl);
        v.setViewVisibility(HOUR_CELLS[i], show ? View.VISIBLE : View.GONE);
        if (!show) continue;
        long t = x.optLong("t");
        v.setTextViewText(HOUR_TIMES[i], f.hourLabel(t));
        v.setImageViewResource(HOUR_ICONS[i], icon(x.optString("k"), f.isDay(t + 1800_000L)));
        v.setTextViewText(HOUR_TEMPS[i], Weather.deg(x.optDouble("c"), fahr));
      }
    }
    v.setContentDescription(R.id.widgetRoot, f.city + ". " + (wx.ok ? Weather.deg(wx.temp, fahr) + ", " + cond + ". High " + Weather.deg(wx.hi, fahr) + ", low " + Weather.deg(wx.lo, fahr) + ". " : "") + sunNext + ".");
    return v;
  }

  private static int background(String kind, String phase, boolean day) {
    switch (kind) {
      case "thunder": return R.drawable.wx_bg_storm;
      case "drizzle": case "rain": case "heavyrain": case "showers": case "sleet": return day ? R.drawable.wx_bg_rain : R.drawable.wx_bg_night_cloud;
      case "lightsnow": case "snow": case "heavysnow": return day ? R.drawable.wx_bg_snow : R.drawable.wx_bg_night_cloud;
      case "fog": return day ? R.drawable.wx_bg_fog : R.drawable.wx_bg_night_cloud;
      case "cloudy": return day ? R.drawable.wx_bg_cloud_day : R.drawable.wx_bg_night_cloud;
      default:
        if ("dawn".equals(phase)) return R.drawable.wx_bg_dawn;
        if ("dusk".equals(phase)) return R.drawable.wx_bg_dusk;
        return day ? R.drawable.wx_bg_clear_day : R.drawable.wx_bg_night;
    }
  }

  /** Which moving layers the weather calls for, and how strong each one is. */
  private static void effects(RemoteViews v, String kind, boolean day, boolean windy) {
    int clouds = 0, rain = 0, snow = 0;
    boolean clearish = false;
    switch (kind) {
      case "clear": clearish = true; break;
      case "fair": clearish = true; clouds = 110; break;
      case "partly": clearish = true; clouds = 200; break;
      case "cloudy": clouds = 255; break;
      case "fog": v.setViewVisibility(R.id.fxFog, View.VISIBLE); clouds = 120; break;
      case "drizzle": clouds = 230; rain = 110; break;
      case "showers": clouds = 200; rain = 190; break;
      case "rain": clouds = 255; rain = 210; break;
      case "heavyrain": clouds = 255; rain = 255; break;
      case "sleet": clouds = 255; rain = 140; snow = 190; break;
      case "lightsnow": clouds = 220; snow = 150; break;
      case "snow": clouds = 255; snow = 220; break;
      case "heavysnow": clouds = 255; snow = 255; break;
      case "thunder": clouds = 255; rain = 230; v.setViewVisibility(R.id.fxFlash, View.VISIBLE); break;
      default: break;
    }
    if (clearish) v.setViewVisibility(day ? R.id.fxGlow : R.id.fxStars, View.VISIBLE);
    if (clouds > 0) { v.setViewVisibility(R.id.fxClouds, View.VISIBLE); v.setInt(R.id.fxCloud1, "setImageAlpha", clouds); v.setInt(R.id.fxCloud2, "setImageAlpha", clouds); }
    if (rain > 0) { v.setViewVisibility(R.id.fxRain, View.VISIBLE); v.setInt(R.id.fxRain1, "setImageAlpha", rain); v.setInt(R.id.fxRain2, "setImageAlpha", rain); }
    if (snow > 0) { v.setViewVisibility(R.id.fxSnow, View.VISIBLE); v.setInt(R.id.fxSnow1, "setImageAlpha", snow); v.setInt(R.id.fxSnow2, "setImageAlpha", snow); }
    if (windy) v.setViewVisibility(R.id.fxWind, View.VISIBLE);
  }

  private static int icon(String kind, boolean day) {
    switch (kind) {
      case "fair": case "clear": case "": return day ? R.drawable.wx_ic_sun : R.drawable.wx_ic_moon;
      case "partly": return day ? R.drawable.wx_ic_partly_day : R.drawable.wx_ic_partly_night;
      case "fog": return R.drawable.wx_ic_fog;
      case "drizzle": return R.drawable.wx_ic_drizzle;
      case "rain": case "heavyrain": case "showers": return R.drawable.wx_ic_rain;
      case "sleet": return R.drawable.wx_ic_sleet;
      case "lightsnow": case "snow": case "heavysnow": return R.drawable.wx_ic_snow;
      case "thunder": return R.drawable.wx_ic_thunder;
      default: return R.drawable.wx_ic_cloud;
    }
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
    String city = "", todayKey = "", tomorrowKey = "", lang = "en";
    JSONObject tx = new JSONObject();
    double lat = Double.NaN, lon = Double.NaN;
    TimeZone tz = TimeZone.getDefault();
    private SimpleDateFormat timeFmt, keyFmt, dayFmt, dateFmt, hourFmt;
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
      lang = j.optString("lang", "en");
      JSONObject words = j.optJSONObject("t"); if (words != null) tx = words;
      Locale words2 = "gu".equals(lang) ? new Locale("gu", "IN") : "hi".equals(lang) ? new Locale("hi", "IN") : Locale.US;
      timeFmt = fmt("h:mm a"); hourFmt = fmt("h a"); keyFmt = fmt("yyyy-MM-dd"); dayFmt = fmt("EEE d MMM", words2); dateFmt = fmt("EEEE d MMMM", words2);
      city = j.optString("city", "");
      lat = j.optDouble("lat", Double.NaN); lon = j.optDouble("lon", Double.NaN);
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
    String hourLabel(long t) { return hourFmt.format(new Date(t)).toLowerCase(Locale.ROOT); }
    long endOfToday() { return startOfNextDay(); }
    /** Is the sun up at t? Uses the civil day that t falls in; polar days fall back to 6 am to 6 pm. */
    boolean isDay(long t) {
      JSONArray days = feed.optJSONArray("days");
      String key = keyFmt.format(new Date(t));
      if (days != null) for (int i = 0; i < days.length(); i++) {
        JSONObject d = days.optJSONObject(i);
        if (d != null && key.equals(d.optString("date"))) return d.optLong("rise") <= t && t < d.optLong("set");
      }
      Calendar cal = Calendar.getInstance(tz); cal.setTimeInMillis(t);
      int hr = cal.get(Calendar.HOUR_OF_DAY);
      return hr >= 6 && hr < 18;
    }
    String range(long a, long b) { return time(a) + " – " + time(b); }
    String dateLabel() { return dateFmt.format(new Date(now)); }
    String dayLabel(String key) {
      if (key.equals(todayKey)) return t("today2", "Today");
      if (key.equals(tomorrowKey)) return cap(t("tomorrow", "Tomorrow"));
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
    private SimpleDateFormat fmt(String pattern) { return fmt(pattern, Locale.US); }
    private SimpleDateFormat fmt(String pattern, Locale locale) { SimpleDateFormat f = new SimpleDateFormat(pattern, locale); f.setTimeZone(tz); return f; }
    /** A word in the app language, as the app wrote it into the feed; the English fallback covers older feeds. */
    String t(String key, String fallback) { String s = tx.optString(key, ""); return s.isEmpty() ? fallback : s; }
    String t(String key, String fallback, String x) { return t(key, fallback).replace("{x}", x); }
    String tithiName() { return tithi != null && !tithi.optString("l").isEmpty() ? tithi.optString("l") : SomaWidget.tithiEnglish(tithiIndex); }
    static String cap(String s) { return s.isEmpty() ? s : Character.toUpperCase(s.charAt(0)) + s.substring(1); }
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
  /** Sky and weather: needs the network now and then, so it keeps the process alive for a fetch. */
  public static final class Sky extends Base {
    @Override public void onUpdate(Context c, AppWidgetManager m, int[] ids) { refreshAll(c, goAsync()); }
  }

  /** Alarm, boot and clock changes. */
  public static final class Tick extends BroadcastReceiver {
    @Override public void onReceive(Context c, Intent i) { refreshAll(c, goAsync()); }
  }
}
