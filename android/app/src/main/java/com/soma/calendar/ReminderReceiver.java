package com.soma.calendar;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Local vrat, parana, daily panchang and Rahu Kaal reminders. The web layer computes the next 30 days of reminders
 * and hands them over as JSON; this class schedules them with AlarmManager, re-arms them after a reboot or an app
 * update, and posts the notification when an alarm fires. Nothing leaves the phone.
 */
public final class ReminderReceiver extends BroadcastReceiver {
  static final String CHANNEL = "soma_reminders";
  private static final String PREFS = "soma_reminders";
  private static final String ACTION_FIRE = "com.soma.calendar.REMINDER";

  /** Replaces every scheduled reminder with the given list: [{id, at (epoch ms), title, body}]. */
  static void schedule(Context c, String json) {
    SharedPreferences p = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    cancelAll(c, p.getString("ids", "[]"));
    JSONArray scheduled = new JSONArray();
    try {
      JSONArray list = new JSONArray(json == null ? "[]" : json);
      long now = System.currentTimeMillis();
      for (int i = 0; i < list.length() && i < 150; i++) {
        JSONObject r = list.optJSONObject(i);
        if (r == null) continue;
        long at = r.optLong("at", 0);
        String id = r.optString("id", "");
        if (at <= now || id.isEmpty()) continue;
        arm(c, at, id, r.optString("title", "Soma"), r.optString("body", ""));
        scheduled.put(id);
      }
      p.edit().putString("json", json).putString("ids", scheduled.toString()).apply();
    } catch (Exception e) {
      p.edit().putString("ids", scheduled.toString()).apply();
    }
  }

  private static PendingIntent intent(Context c, String id, String title, String body, int flags) {
    Intent i = new Intent(c, ReminderReceiver.class).setAction(ACTION_FIRE)
      .putExtra("id", id).putExtra("title", title).putExtra("body", body);
    return PendingIntent.getBroadcast(c, id.hashCode(), i, flags | PendingIntent.FLAG_IMMUTABLE);
  }

  private static void arm(Context c, long at, String id, String title, String body) {
    AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
    if (am == null) return;
    PendingIntent pi = intent(c, id, title, body, PendingIntent.FLAG_UPDATE_CURRENT);
    boolean exact = Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms();
    try {
      if (exact) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
      else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
    } catch (SecurityException e) {
      am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
    }
  }

  private static void cancelAll(Context c, String idsJson) {
    AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
    if (am == null) return;
    try {
      JSONArray ids = new JSONArray(idsJson);
      for (int i = 0; i < ids.length(); i++) {
        PendingIntent pi = intent(c, ids.getString(i), "", "", PendingIntent.FLAG_NO_CREATE);
        if (pi != null) { am.cancel(pi); pi.cancel(); }
      }
    } catch (Exception ignored) { }
  }

  static void ensureChannel(Context c) {
    NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
    if (nm == null || nm.getNotificationChannel(CHANNEL) != null) return;
    NotificationChannel ch = new NotificationChannel(CHANNEL, "Vrat and muhurat reminders", NotificationManager.IMPORTANCE_DEFAULT);
    ch.setDescription("Ekadashi, festivals, parana time, daily panchang and Rahu Kaal");
    nm.createNotificationChannel(ch);
  }

  @Override public void onReceive(Context c, Intent in) {
    String action = in.getAction();
    if (Intent.ACTION_BOOT_COMPLETED.equals(action) || Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) {
      schedule(c, c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("json", "[]"));
      return;
    }
    if (!ACTION_FIRE.equals(action)) return;
    ensureChannel(c);
    NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
    if (nm == null) return;
    if (Build.VERSION.SDK_INT >= 33 && !nm.areNotificationsEnabled()) return;
    PendingIntent open = PendingIntent.getActivity(c, 0, new Intent(c, MainActivity.class),
      PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    String body = in.getStringExtra("body");
    Notification n = new Notification.Builder(c, CHANNEL)
      .setSmallIcon(R.drawable.ic_notify)
      .setContentTitle(in.getStringExtra("title"))
      .setContentText(body)
      .setStyle(new Notification.BigTextStyle().bigText(body))
      .setContentIntent(open)
      .setAutoCancel(true)
      .build();
    String id = in.getStringExtra("id");
    nm.notify(id == null ? 0 : id.hashCode(), n);
  }
}
