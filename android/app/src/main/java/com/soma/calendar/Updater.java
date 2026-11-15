package com.soma.calendar;

import android.app.Activity;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageInstaller;
import android.net.Uri;
import android.os.Build;
import android.util.Log;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import org.json.JSONObject;

/**
 * Self-update for sideloaded preview builds. CI publishes every build of main to the
 * rolling "preview" GitHub release (soma-preview.apk + version.json). This class reads version.json,
 * downloads the APK, checks its SHA-256 and hands it to Android's own installer, which asks the person
 * to confirm. Android only accepts it because every preview build is signed with the same key.
 *
 * Store builds update through Google Play / the App Store: they ship with an empty UPDATE_FEED
 * (see app/build.gradle) and without REQUEST_INSTALL_PACKAGES, so all of this switches off.
 */
final class Updater {
  interface Sink { void send(String json); }
  static final String ACTION_STATUS = "com.soma.calendar.UPDATE_STATUS";
  private static final String TAG = "SomaUpdate";
  private static final long MAX_APK = 60L * 1024 * 1024;
  private static volatile boolean busy;
  /** The page that asked; install status from UpdateReceiver goes back to it. */
  static volatile Sink sink;

  static boolean enabled() { return BuildConfig.UPDATE_FEED != null && !BuildConfig.UPDATE_FEED.isEmpty(); }

  static long installedCode(Context c) {
    try {
      PackageInfo p = c.getPackageManager().getPackageInfo(c.getPackageName(), 0);
      return Build.VERSION.SDK_INT >= 28 ? p.getLongVersionCode() : p.versionCode;
    } catch (Exception e) { return 0; }
  }

  static String info(Context c) {
    try {
      JSONObject j = new JSONObject();
      j.put("enabled", enabled());
      j.put("versionCode", installedCode(c));
      j.put("versionName", BuildConfig.VERSION_NAME);
      return j.toString();
    } catch (Exception e) { return "{\"enabled\":false}"; }
  }

  static void emit(String state, JSONObject extra) {
    Sink s = sink;
    if (s == null) return;
    try {
      JSONObject j = extra == null ? new JSONObject() : extra;
      j.put("state", state);
      s.send(j.toString());
    } catch (Exception ignored) { }
  }

  static void error(String message) {
    try { JSONObject j = new JSONObject(); j.put("message", message); emit("error", j); } catch (Exception ignored) { }
  }

  /** Reads version.json and reports "available" (with its fields) or "latest". */
  static void check(Context c, Sink to) {
    sink = to;
    if (!enabled()) { emit("off", null); return; }
    new Thread(() -> {
      try {
        JSONObject feed = new JSONObject(fetchText(BuildConfig.UPDATE_FEED + "?t=" + System.currentTimeMillis(), 20000));
        long remote = feed.optLong("versionCode", 0);
        emit(remote > installedCode(c) ? "available" : "latest", feed);
      } catch (Exception e) {
        Log.w(TAG, "Update check failed", e);
        error("Could not reach the update server. Check the connection and try again.");
      }
    }, "SomaUpdateCheck").start();
  }

  /** Downloads the build named in version.json, verifies it, and opens the system install prompt. */
  static void install(Activity a, Sink to) {
    sink = to;
    if (!enabled() || busy) return;
    if (Build.VERSION.SDK_INT >= 26 && !a.getPackageManager().canRequestPackageInstalls()) {
      // One-time Android setting: "Install unknown apps" for Soma Preview.
      emit("permission", null);
      try {
        a.startActivity(new Intent(android.provider.Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
          Uri.parse("package:" + a.getPackageName())));
      } catch (Exception ignored) { }
      return;
    }
    busy = true;
    Context app = a.getApplicationContext();
    new Thread(() -> {
      File apk = new File(app.getCacheDir(), "soma-update.apk");
      try {
        JSONObject feed = new JSONObject(fetchText(BuildConfig.UPDATE_FEED + "?t=" + System.currentTimeMillis(), 20000));
        if (feed.optLong("versionCode", 0) <= installedCode(app)) { emit("latest", feed); return; }
        String url = feed.getString("apk"), want = feed.optString("sha256", "").toLowerCase();
        if (!url.startsWith("https://")) throw new IllegalStateException("APK link must be HTTPS");
        download(url, apk);
        if (want.length() != 64 || !want.equals(sha256(apk))) throw new SecurityException("Checksum mismatch");
        emit("installing", null);
        commit(app, apk);
      } catch (SecurityException e) {
        Log.w(TAG, "Update rejected", e);
        error("The download did not match the published build. Try again.");
      } catch (Exception e) {
        Log.w(TAG, "Update failed", e);
        error("The update could not be downloaded. Try again on a steady connection.");
      } finally {
        apk.delete();
        busy = false;
      }
    }, "SomaUpdateInstall").start();
  }

  private static void commit(Context c, File apk) throws Exception {
    PackageInstaller installer = c.getPackageManager().getPackageInstaller();
    PackageInstaller.SessionParams params = new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
    params.setAppPackageName(c.getPackageName());
    if (Build.VERSION.SDK_INT >= 31) params.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED);
    int id = installer.createSession(params);
    try (PackageInstaller.Session session = installer.openSession(id)) {
      try (InputStream in = new FileInputStream(apk); OutputStream out = session.openWrite("soma.apk", 0, apk.length())) {
        byte[] buf = new byte[65536]; int n;
        while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
        session.fsync(out);
      }
      Intent status = new Intent(ACTION_STATUS).setClass(c, UpdateReceiver.class).setPackage(c.getPackageName());
      int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0);
      session.commit(PendingIntent.getBroadcast(c, id, status, flags).getIntentSender());
    }
  }

  private static String fetchText(String address, int limit) throws Exception {
    HttpURLConnection conn = open(address);
    try (InputStream in = conn.getInputStream()) {
      java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
      byte[] buf = new byte[8192]; int n;
      while ((n = in.read(buf)) > 0) { out.write(buf, 0, n); if (out.size() > limit) throw new IllegalStateException("Feed too large"); }
      return out.toString("UTF-8");
    } finally { conn.disconnect(); }
  }

  private static void download(String address, File to) throws Exception {
    HttpURLConnection conn = open(address);
    try (InputStream in = conn.getInputStream(); OutputStream out = new FileOutputStream(to)) {
      long total = conn.getContentLengthLong(), got = 0; int last = -1, n;
      if (total > MAX_APK) throw new IllegalStateException("APK too large");
      byte[] buf = new byte[65536];
      while ((n = in.read(buf)) > 0) {
        out.write(buf, 0, n); got += n;
        if (got > MAX_APK) throw new IllegalStateException("APK too large");
        int pct = total > 0 ? (int) (got * 100 / total) : -1;
        if (pct != last && (pct < 0 || pct % 5 == 0)) {
          last = pct;
          JSONObject j = new JSONObject(); j.put("progress", pct); emit("downloading", j);
        }
      }
    } finally { conn.disconnect(); }
  }

  /** GitHub release links redirect (https only) to its file CDN. */
  private static HttpURLConnection open(String address) throws Exception {
    URL url = new URL(address);
    for (int hop = 0; hop < 5; hop++) {
      if (!"https".equals(url.getProtocol())) throw new SecurityException("HTTPS only");
      HttpURLConnection conn = (HttpURLConnection) url.openConnection();
      conn.setInstanceFollowRedirects(false);
      conn.setConnectTimeout(15000);
      conn.setReadTimeout(30000);
      conn.setRequestProperty("User-Agent", "SomaPreview/" + BuildConfig.VERSION_NAME);
      conn.setRequestProperty("Cache-Control", "no-cache");
      int code = conn.getResponseCode();
      if (code >= 300 && code < 400) {
        String next = conn.getHeaderField("Location");
        conn.disconnect();
        if (next == null) break;
        url = new URL(url, next);
        continue;
      }
      if (code != 200) { conn.disconnect(); throw new IllegalStateException("HTTP " + code); }
      return conn;
    }
    throw new IllegalStateException("Too many redirects");
  }

  private static String sha256(File f) throws Exception {
    MessageDigest md = MessageDigest.getInstance("SHA-256");
    try (InputStream in = new FileInputStream(f)) {
      byte[] buf = new byte[65536]; int n;
      while ((n = in.read(buf)) > 0) md.update(buf, 0, n);
    }
    StringBuilder hex = new StringBuilder();
    for (byte b : md.digest()) hex.append(String.format("%02x", b));
    return hex.toString();
  }
}
