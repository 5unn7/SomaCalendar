package com.soma.calendar;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.provider.CalendarContract;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.time.Instant;
import org.json.JSONObject;

/** Soma's own native calls, used by src/redesign/native.js: widget feed, add-to-calendar and preview self-updates. */
@CapacitorPlugin(name = "Soma")
public class SomaPlugin extends Plugin {

  /** A week of precomputed Panchang intervals for the home-screen widget (built by widget.js). */
  @PluginMethod
  public void setWidgetFeed(PluginCall call) {
    String json = call.getString("json", "");
    if (json == null || json.isEmpty() || json.length() > 300000) { call.reject("Widget feed missing or too large"); return; }
    try { new JSONObject(json); } catch (Exception e) { call.reject("Widget feed is not JSON"); return; }
    getContext().getSharedPreferences(SomaWidget.PREFS, android.content.Context.MODE_PRIVATE)
      .edit().putString(SomaWidget.FEED, json).apply();
    SomaWidget.refreshAll(getContext());
    call.resolve();
  }

  /** Opens the phone's calendar with the plan filled in; the person saves it there. Soma never reads the calendar. */
  @PluginMethod
  public void addCalendarEvent(PluginCall call) {
    try {
      Intent intent = new Intent(Intent.ACTION_INSERT)
        .setData(CalendarContract.Events.CONTENT_URI)
        .putExtra(CalendarContract.Events.TITLE, call.getString("title", "Soma"))
        .putExtra(CalendarContract.Events.EVENT_LOCATION, call.getString("place", ""))
        .putExtra(CalendarContract.Events.DESCRIPTION, call.getString("notes", ""))
        .putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME, Instant.parse(call.getString("start")).toEpochMilli())
        .putExtra(CalendarContract.EXTRA_EVENT_END_TIME, Instant.parse(call.getString("end")).toEpochMilli());
      getActivity().startActivity(intent);
      call.resolve();
    } catch (ActivityNotFoundException e) {
      android.widget.Toast.makeText(getContext(), "No calendar app available. Your plan is still saved in Soma.", android.widget.Toast.LENGTH_LONG).show();
      call.reject("No calendar app");
    } catch (Exception e) {
      call.reject("Invalid event: " + e.getMessage());
    }
  }

  /** Preview builds only: {enabled, versionCode, versionName}. Store builds report enabled:false. */
  @PluginMethod
  public void updateInfo(PluginCall call) {
    JSObject r = new JSObject();
    r.put("json", Updater.info(getContext()));
    call.resolve(r);
  }

  /** Reads the preview feed. Progress and results arrive as "update" events ({json}) for window.somaReceiveUpdate. */
  @PluginMethod
  public void checkForUpdate(PluginCall call) {
    Updater.check(getContext().getApplicationContext(), this::sendUpdate);
    call.resolve();
  }

  /** Downloads the newer preview build and opens Android's install prompt. */
  @PluginMethod
  public void installUpdate(PluginCall call) {
    getActivity().runOnUiThread(() -> Updater.install(getActivity(), this::sendUpdate));
    call.resolve();
  }

  private void sendUpdate(String json) {
    JSObject e = new JSObject();
    e.put("json", json);
    notifyListeners("update", e);
  }
}
