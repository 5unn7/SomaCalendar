package com.soma.calendar;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

/** Shows last calculated Panchang + opt-in weather. No background location tracking. */
public final class SomaWidget extends AppWidgetProvider {
  static void refreshAll(Context context){
    AppWidgetManager manager=AppWidgetManager.getInstance(context);
    int[] ids=manager.getAppWidgetIds(new ComponentName(context,SomaWidget.class));
    for(int id:ids)update(context,manager,id);
  }
  @Override public void onUpdate(Context c,AppWidgetManager m,int[] ids){
    for(int id:ids)update(c,m,id);
  }
  static void update(Context c,AppWidgetManager m,int id){
    SharedPreferences p=c.getSharedPreferences("soma_widget",Context.MODE_PRIVATE);
    RemoteViews v=new RemoteViews(c.getPackageName(),R.layout.soma_widget);
    v.setTextViewText(R.id.widgetDate,p.getString("date","Welcome to Soma"));
    v.setTextViewText(R.id.widgetPhase,p.getString("phase","Open Soma to begin"));
    v.setTextViewText(R.id.widgetTithi,p.getString("tithi","Today's Panchang"));
    v.setTextViewText(R.id.widgetCity,p.getString("city","Tap to refresh")+" · last opened");
    v.setTextViewText(R.id.widgetWeather,p.getString("temp","—")+
      "  ·  "+p.getString("cloud","Weather off"));
    v.setTextViewText(R.id.widgetWeatherLabel,p.getString("weatherStatus","Weather is opt-in"));
    PendingIntent click=PendingIntent.getActivity(c,0,new Intent(c,MainActivity.class),
      PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
    v.setOnClickPendingIntent(R.id.widgetRoot,click);
    m.updateAppWidget(id,v);
  }
}
