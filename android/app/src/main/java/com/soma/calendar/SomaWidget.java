package com.soma.calendar;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.util.SizeF;
import android.view.View;
import android.widget.RemoteViews;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TimeZone;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Home-screen widget. The app hands over a week of precomputed Panchang
 * intervals (see src/redesign/widget.js); the widget picks whatever holds right
 * now and wakes itself at the next boundary (Choghadiya change, tithi or
 * nakshatra end, Rahu Kaal, midnight). Fully offline, no location tracking.
 */
public final class SomaWidget extends AppWidgetProvider {
  static final String PREFS="soma_widget";
  static final String FEED="feed";
  static final String ACTION_TICK="com.soma.calendar.WIDGET_TICK";
  private static final int SMALL=0, MEDIUM=1, LARGE=2, XLARGE=3;
  private static final int GOOD=0xFFB8D6B4, OK=0xFFDFC493, BAD=0xFFE8A091, INK=0xFFF3F0E5, MUTED=0xFF9FAEA5;
  private static final int[] ROWS={R.id.wRow1,R.id.wRow2,R.id.wRow3,R.id.wRow4,R.id.wRow5,R.id.wRow6,R.id.wRow7,R.id.wRow8};
  private static final int[] FESTS={R.id.wFest1,R.id.wFest2,R.id.wFest3,R.id.wFest4};

  static void refreshAll(Context c){
    AppWidgetManager m=AppWidgetManager.getInstance(c);
    int[] ids=m.getAppWidgetIds(new ComponentName(c,SomaWidget.class));
    Snapshot s=Snapshot.load(c,System.currentTimeMillis());
    for(int id:ids)push(c,m,id,s);
    schedule(c,ids.length>0?s.nextChange:0);
  }
  @Override public void onUpdate(Context c,AppWidgetManager m,int[] ids){
    Snapshot s=Snapshot.load(c,System.currentTimeMillis());
    for(int id:ids)push(c,m,id,s);
    schedule(c,s.nextChange);
  }
  @Override public void onAppWidgetOptionsChanged(Context c,AppWidgetManager m,int id,Bundle options){
    push(c,m,id,Snapshot.load(c,System.currentTimeMillis()));
  }
  @Override public void onDisabled(Context c){schedule(c,0);}
  @Override public void onReceive(Context c,Intent intent){
    super.onReceive(c,intent);
    String a=intent.getAction();
    if(ACTION_TICK.equals(a)||Intent.ACTION_TIME_CHANGED.equals(a)||Intent.ACTION_TIMEZONE_CHANGED.equals(a)
      ||Intent.ACTION_BOOT_COMPLETED.equals(a)||Intent.ACTION_MY_PACKAGE_REPLACED.equals(a))refreshAll(c);
  }

  private static void push(Context c,AppWidgetManager m,int id,Snapshot s){
    RemoteViews views;
    if(Build.VERSION.SDK_INT>=31){
      // The launcher picks the largest layout that fits as the user resizes.
      Map<SizeF,RemoteViews> map=new HashMap<>();
      map.put(new SizeF(110,40),render(c,s,SMALL));
      map.put(new SizeF(250,110),render(c,s,MEDIUM));
      map.put(new SizeF(250,240),render(c,s,LARGE));
      map.put(new SizeF(360,360),render(c,s,XLARGE));
      views=new RemoteViews(map);
    }else views=render(c,s,sizeFor(m.getAppWidgetOptions(id)));
    m.updateAppWidget(id,views);
  }
  private static int sizeFor(Bundle o){
    int w=o==null?0:o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH);
    int h=o==null?0:o.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT);
    if(w==0||h==0)return MEDIUM;
    if(w<250||h<110)return SMALL;
    if(w>=360&&h>=360)return XLARGE;
    return h>=240?LARGE:MEDIUM;
  }

  private static RemoteViews render(Context c,Snapshot s,int size){
    int layout=size==SMALL?R.layout.soma_widget_small:size==MEDIUM?R.layout.soma_widget:R.layout.soma_widget_large;
    RemoteViews v=new RemoteViews(c.getPackageName(),layout);
    v.setTextViewText(R.id.wTithi,s.tithi);
    v.setTextViewText(R.id.wChog,size==SMALL?s.chogShort:s.chog);
    v.setTextColor(R.id.wChog,s.chogColor);
    if(size==SMALL){
      v.setTextViewText(R.id.wVerdict,s.verdict);
      v.setTextColor(R.id.wVerdict,s.inRahu?BAD:MUTED);
    }else{
      v.setTextViewText(R.id.wCity,s.header);
      v.setTextViewText(R.id.wDate,s.date);
      v.setTextViewText(R.id.wTithiSub,s.tithiSub);
      v.setTextViewText(R.id.wNak,s.nak);
      v.setTextViewText(R.id.wChogSub,s.chogSub);
      v.setProgressBar(R.id.wChogBar,100,s.chogProgress,false);
      v.setTextViewText(R.id.wRahu,s.rahu);
      v.setTextColor(R.id.wRahu,s.inRahu?BAD:MUTED);
      v.setTextViewText(R.id.wVrat,size==MEDIUM?s.vratLine:s.vratTip);
    }
    if(size>=LARGE){
      v.setTextViewText(R.id.wSun,s.sun);
      int rows=size==XLARGE?8:4;
      for(int i=0;i<ROWS.length;i++){
        boolean show=i<rows&&i<s.next.size();
        v.setViewVisibility(ROWS[i],show?View.VISIBLE:View.GONE);
        if(show){v.setTextViewText(ROWS[i],s.next.get(i).text);v.setTextColor(ROWS[i],s.next.get(i).color);}
      }
      int fests=size==XLARGE?4:3;
      for(int i=0;i<FESTS.length;i++){
        boolean show=i<fests&&i<s.fests.size();
        v.setViewVisibility(FESTS[i],show?View.VISIBLE:View.GONE);
        if(show)v.setTextViewText(FESTS[i],s.fests.get(i));
      }
    }
    Intent open=new Intent(c,MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TOP);
    v.setOnClickPendingIntent(R.id.widgetRoot,PendingIntent.getActivity(c,0,open,PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT));
    return v;
  }

  /** Wake at the next boundary. Inexact RTC alarm: no exact-alarm permission, and no wakeups while the screen is off. */
  private static void schedule(Context c,long at){
    AlarmManager am=(AlarmManager)c.getSystemService(Context.ALARM_SERVICE);
    if(am==null)return;
    Intent tick=new Intent(c,SomaWidget.class).setAction(ACTION_TICK);
    PendingIntent pi=PendingIntent.getBroadcast(c,1,tick,PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
    am.cancel(pi);
    if(at<=0)return;
    long now=System.currentTimeMillis();
    at=Math.max(now+30_000L,Math.min(at+5_000L,now+60*60_000L));
    am.setWindow(AlarmManager.RTC,at,60_000L,pi);
  }

  static final class Row{final String text;final int color;Row(String t,int c){text=t;color=c;}}

  /** Everything the widget shows at one instant, derived from the stored feed. */
  static final class Snapshot{
    String header="સોમ · SOMA",date="",tithi="Soma",tithiSub="Open Soma once to set your place",nak="",chog="",chogShort="",
      chogSub="",verdict="Open Soma once to begin",rahu="",sun="",vratLine="",vratTip="";
    int chogColor=GOOD,chogProgress=0;boolean inRahu=false;long nextChange=0;
    final List<Row> next=new ArrayList<>();final List<String> fests=new ArrayList<>();

    static Snapshot load(Context c,long now){
      Snapshot s=new Snapshot();
      SharedPreferences p=c.getSharedPreferences(PREFS,Context.MODE_PRIVATE);
      String raw=p.getString(FEED,null);
      try{
        if(raw!=null)s.fill(new JSONObject(raw),now);
        else s.legacy(p);
      }catch(Exception e){
        Log.w("SomaWidget","Unreadable widget feed",e);
        s.legacy(p);
      }
      return s;
    }
    /** Older app builds only stored four strings. */
    private void legacy(SharedPreferences p){
      date=p.getString("date","");
      tithi=p.getString("tithi","Soma");
      tithiSub=p.getString("phase","Open Soma once to begin");
      header="સોમ · "+p.getString("city","SOMA");
      nextChange=System.currentTimeMillis()+60*60_000L;
    }

    private void fill(JSONObject f,long now)throws Exception{
      TimeZone tz=TimeZone.getTimeZone(f.optString("zone","Asia/Kolkata"));
      SimpleDateFormat time=fmt("h:mm a",Locale.US,tz),key=fmt("yyyy-MM-dd",Locale.US,tz);
      SimpleDateFormat day=fmt("EEE d MMM",Locale.US,tz),dateGu=fmt("EEEE, d MMMM",new Locale("gu","IN"),tz);
      String today=key.format(new Date(now)),tomorrow=key.format(new Date(now+86_400_000L));
      String city=f.optString("city","");
      header=city.isEmpty()?"સોમ · SOMA":"સોમ · "+city.toUpperCase(Locale.ROOT);
      date=dateGu.format(new Date(now));
      long midnight=startOfNextDay(now,tz);
      long soonest=midnight;

      JSONObject t=at(f.optJSONArray("tithi"),now);
      if(t==null){
        tithi="Soma";tithiSub="Open Soma to refresh this week";verdict=tithiSub;
        nextChange=now+60*60_000L;return;
      }
      tithi=t.optString("n");
      tithiSub=t.optString("m")+" · until "+when(t.getLong("e"),now,time,day,key,today,tomorrow);
      soonest=Math.min(soonest,t.getLong("e"));

      JSONObject n=at(f.optJSONArray("nak"),now);
      if(n!=null){
        nak=n.optString("n")+" નક્ષત્ર · until "+when(n.getLong("e"),now,time,day,key,today,tomorrow);
        soonest=Math.min(soonest,n.getLong("e"));
      }

      JSONArray chogs=f.optJSONArray("chog");
      int ci=index(chogs,now);
      if(ci>=0){
        JSONObject ch=chogs.getJSONObject(ci);
        long s=ch.getLong("s"),e=ch.getLong("e");
        String q=ch.optString("q");
        chogColor=color(q);
        chog=ch.optString("n")+" · "+ch.optString("en");
        chogShort=ch.optString("n")+" ચોઘડિયું · till "+time.format(new Date(e));
        chogSub=meaning(q)+" · till "+time.format(new Date(e));
        verdict=meaning(q);
        chogProgress=(int)Math.max(0,Math.min(100,(now-s)*100/Math.max(1,e-s)));
        soonest=Math.min(soonest,e);
        for(int i=ci+1;i<chogs.length()&&next.size()<8;i++){
          JSONObject x=chogs.getJSONObject(i);
          next.add(new Row(time.format(new Date(x.getLong("s")))+"   "+x.optString("n")+" · "+x.optString("en"),color(x.optString("q"))));
        }
      }else{
        chog="—";chogShort="No sunrise today";chogSub="No sunrise here today";verdict=chogSub;chogColor=MUTED;
      }

      JSONArray days=f.optJSONArray("days");
      JSONObject d=byDate(days,today),dNext=byDate(days,tomorrow);
      if(d!=null){
        JSONArray r=d.getJSONArray("rahu");
        long rs=r.getLong(0),re=r.getLong(1);
        if(now<rs){rahu="રાહુ કાળ · Rahu Kaal "+range(rs,re,time);soonest=Math.min(soonest,rs);}
        else if(now<re){
          inRahu=true;rahu="રાહુ કાળ now · hold new starts till "+time.format(new Date(re));
          verdict="Rahu Kaal · hold new starts till "+time.format(new Date(re));
          soonest=Math.min(soonest,re);
        }else if(dNext!=null){
          JSONArray r2=dNext.getJSONArray("rahu");
          rahu="Rahu Kaal over · tomorrow "+range(r2.getLong(0),r2.getLong(1),time);
        }else rahu="Rahu Kaal is over for today";
        sun="સૂર્યોદય "+time.format(new Date(d.getLong("rise")))+"  ·  સૂર્યાસ્ત "+time.format(new Date(d.getLong("set")));
        JSONArray ab=d.optJSONArray("abhijit");
        if(ab!=null){
          sun+="  ·  Abhijit "+range(ab.getLong(0),ab.getLong(1),time);
          if(now<ab.getLong(0))soonest=Math.min(soonest,ab.getLong(0));
        }
      }

      JSONArray vr=f.optJSONArray("vrat");
      if(vr!=null)for(int i=0;i<vr.length();i++){
        JSONObject x=vr.getJSONObject(i);
        String on=x.optString("date");
        if(on.compareTo(today)<0)continue;
        String label=on.equals(today)?"આજે · Today":on.equals(tomorrow)?"કાલે · Tomorrow":day.format(key.parse(on));
        String name=x.optString("n")+(x.optString("en").isEmpty()?"":" · "+x.optString("en"));
        if(vratLine.isEmpty()){
          vratLine=(on.equals(today)?"Today: ":"Next: ")+name+(on.equals(today)?"":" · "+label);
          vratTip=label+": "+x.optString("d");
        }
        fests.add(label+"  "+name);
      }
      nextChange=soonest;
    }

    private static SimpleDateFormat fmt(String pattern,Locale l,TimeZone tz){SimpleDateFormat f=new SimpleDateFormat(pattern,l);f.setTimeZone(tz);return f;}
    private static long startOfNextDay(long now,TimeZone tz){
      java.util.Calendar cal=java.util.Calendar.getInstance(tz);
      cal.setTimeInMillis(now);cal.add(java.util.Calendar.DAY_OF_MONTH,1);
      cal.set(java.util.Calendar.HOUR_OF_DAY,0);cal.set(java.util.Calendar.MINUTE,0);
      cal.set(java.util.Calendar.SECOND,0);cal.set(java.util.Calendar.MILLISECOND,0);
      return cal.getTimeInMillis();
    }
    private static int index(JSONArray a,long now)throws Exception{
      if(a==null)return -1;
      for(int i=0;i<a.length();i++){JSONObject o=a.getJSONObject(i);if(o.getLong("s")<=now&&now<o.getLong("e"))return i;}
      return -1;
    }
    private static JSONObject at(JSONArray a,long now)throws Exception{int i=index(a,now);return i<0?null:a.getJSONObject(i);}
    private static JSONObject byDate(JSONArray a,String date)throws Exception{
      if(a==null)return null;
      for(int i=0;i<a.length();i++)if(date.equals(a.getJSONObject(i).optString("date")))return a.getJSONObject(i);
      return null;
    }
    private static String when(long t,long now,SimpleDateFormat time,SimpleDateFormat day,SimpleDateFormat key,String today,String tomorrow){
      String k=key.format(new Date(t));
      return time.format(new Date(t))+(k.equals(today)?"":k.equals(tomorrow)?" tomorrow":" "+day.format(new Date(t)));
    }
    private static String range(long a,long b,SimpleDateFormat time){return time.format(new Date(a))+"–"+time.format(new Date(b));}
    private static int color(String q){return "good".equals(q)?GOOD:"bad".equals(q)?BAD:OK;}
    private static String meaning(String q){
      return "good".equals(q)?"શુભ · good time to begin":"bad".equals(q)?"Avoid new beginnings":"Good for travel and errands";
    }
  }
}
