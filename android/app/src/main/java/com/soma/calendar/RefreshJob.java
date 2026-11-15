package com.soma.calendar;

import android.app.job.JobInfo;
import android.app.job.JobParameters;
import android.app.job.JobScheduler;
import android.app.job.JobService;
import android.content.ComponentName;
import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import org.json.JSONObject;

/**
 * Twice a day, even when Soma is not opened: loads the app off-screen so it can hand the shell a fresh week for the
 * widgets and the next 30 days of reminders. Everything is computed on the phone; nothing leaves it.
 */
public final class RefreshJob extends JobService {
  private static final int JOB_ID = 2083;
  private static final long PERIOD = 12 * 60 * 60_000L;
  private static final long TIMEOUT = 45_000L;
  private final Handler main = new Handler(Looper.getMainLooper());
  private WebView web;
  private JobParameters running;

  /** Called whenever the app opens; keeps a single persisted periodic job. */
  static void schedule(Context c) {
    JobScheduler js = (JobScheduler) c.getSystemService(Context.JOB_SCHEDULER_SERVICE);
    if (js == null) return;
    for (JobInfo j : js.getAllPendingJobs()) if (j.getId() == JOB_ID) return;
    JobInfo job = new JobInfo.Builder(JOB_ID, new ComponentName(c, RefreshJob.class))
      .setPeriodic(PERIOD, 2 * 60 * 60_000L)
      .setPersisted(true)
      .setRequiresBatteryNotLow(true)
      .build();
    try { js.schedule(job); } catch (RuntimeException e) { Log.w("SomaJS", "Background refresh not scheduled", e); }
  }

  @Override public boolean onStartJob(JobParameters params) {
    running = params;
    main.post(this::load);
    main.postDelayed(() -> finish(true), TIMEOUT);
    return true;
  }

  @Override public boolean onStopJob(JobParameters params) { destroy(); return true; }

  private void load() {
    try {
      web = new WebView(getApplicationContext());
      WebSettings s = web.getSettings();
      s.setJavaScriptEnabled(true);
      s.setDomStorageEnabled(true);
      s.setAllowContentAccess(false);
      s.setAllowFileAccess(false);
      s.setBlockNetworkLoads(true);
      web.addJavascriptInterface(new Bridge(), "SomaNative");
      web.setWebViewClient(new WebViewClient() {
        @Override public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) { return MainActivity.asset(getApplicationContext(), r.getUrl()); }
        @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) { return true; }
      });
      web.loadUrl(MainActivity.ASSET_ORIGIN + "index.html?bg=1");
    } catch (Exception e) {
      Log.w("SomaJS", "Background refresh could not start", e);
      finish(true);
    }
  }

  private void finish(boolean retry) {
    JobParameters p = running;
    running = null;
    destroy();
    if (p != null) jobFinished(p, retry);
  }

  private void destroy() {
    main.removeCallbacksAndMessages(null);
    if (web != null) { web.removeJavascriptInterface("SomaNative"); web.destroy(); web = null; }
  }

  /** Only what the background run needs: no location, notifications prompts, calendar or updates. */
  public final class Bridge {
    @JavascriptInterface public float fontScale() { return 1f; }
    @JavascriptInterface public void appReady() { }
    @JavascriptInterface public void appFailure(String detail) { Log.e("SomaJS", "Background refresh: " + detail); }
    @JavascriptInterface public String weatherNow() { JSONObject w = Weather.stored(getApplicationContext()); return w == null ? "" : w.toString(); }
    @JavascriptInterface public void updateWidgetFeed(String json) {
      if (json == null || json.length() > 300000) return;
      try { new JSONObject(json); } catch (Exception e) { return; }
      Context c = getApplicationContext();
      c.getSharedPreferences(SomaWidget.PREFS, MODE_PRIVATE).edit().putString(SomaWidget.FEED, json).apply();
      main.post(() -> { SomaWidget.refreshAll(c); PanchangWidgets.refreshAll(c); });
    }
    @JavascriptInterface public void scheduleReminders(String json) { ReminderReceiver.schedule(getApplicationContext(), json); }
    @JavascriptInterface public void bgDone() { main.post(() -> finish(false)); }
  }
}
