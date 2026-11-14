package com.soma.calendar;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.provider.CalendarContract;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.time.Instant;
import org.json.JSONObject;

/** Soma's own native calls, used by src/redesign/native.js: the home-screen widget feed and add-to-calendar. */
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
}
