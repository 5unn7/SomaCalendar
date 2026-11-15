package com.soma.calendar;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebChromeClient;
import android.webkit.ConsoleMessage;
import android.webkit.WebResourceResponse;
import android.util.Log;

import android.webkit.WebResourceRequest;
import java.util.Locale;
import java.util.TimeZone;
import org.json.JSONObject;

/** Privacy-first Android shell. Location and weather are explicitly requested by the user. */
public final class MainActivity extends Activity {
  private static final int LOCATION_PERMISSION_REQUEST = 412;
  private static final int NOTIFICATION_PERMISSION_REQUEST = 413;
  private WebView web;
  private static final String ASSET_ORIGIN = "https://appassets.androidplatform.net/assets/";
  @Override public void onCreate(Bundle state) {
    super.onCreate(state);
    // Bars and WebView ground follow the phone's light/dark setting (Kaal Chakra: bone paper or OLED black).
    boolean night=(getResources().getConfiguration().uiMode&android.content.res.Configuration.UI_MODE_NIGHT_MASK)==android.content.res.Configuration.UI_MODE_NIGHT_YES;
    int ground=night?0xff050505:0xfff3efe7;
    getWindow().setStatusBarColor(ground);
    getWindow().setNavigationBarColor(ground);
    int ui=0;
    if(!night){ui|=android.view.View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;if(Build.VERSION.SDK_INT>=26)ui|=android.view.View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;}
    getWindow().getDecorView().setSystemUiVisibility(ui);
    web=new WebView(this);
    web.setBackgroundColor(ground);
    WebSettings s=web.getSettings();
    s.setJavaScriptEnabled(true);
    s.setDomStorageEnabled(true);
    s.setAllowContentAccess(false);
    s.setAllowFileAccess(false);
    s.setAllowFileAccessFromFileURLs(false);
    s.setAllowUniversalAccessFromFileURLs(false);
    s.setJavaScriptCanOpenWindowsAutomatically(false);
    // The page scales its own rem type from fontScale() (so it can cap the dial core and reflow tight rows);
    // keep WebView's own text zoom at 100 so the phone's text size is not applied twice.
    s.setTextZoom(100);
    web.addJavascriptInterface(new Bridge(),"SomaNative");

    web.setWebChromeClient(new WebChromeClient() {
      @Override public boolean onConsoleMessage(ConsoleMessage message) {
        if(message.messageLevel() == ConsoleMessage.MessageLevel.ERROR) {
          Log.e("SomaJS", message.message() + " at " + message.sourceId() + ":" + message.lineNumber());
        }
        return true;
      }
    });
    web.setWebViewClient(new WebViewClient() {
      @Override public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest request) {
        android.net.Uri uri=request.getUrl();
        if("https".equals(uri.getScheme()) && "appassets.androidplatform.net".equals(uri.getHost())) {
          String path=uri.getPath();
          if(path!=null && path.startsWith("/assets/") && !path.contains("..")) {
            try {
              String type=path.endsWith(".html")?"text/html":path.endsWith(".css")?"text/css":path.endsWith(".js")?"application/javascript":"application/octet-stream";
              return new WebResourceResponse(type,"UTF-8",getAssets().open(path.substring(8)));
            } catch(java.io.IOException ignored) { }
          }
        }
        return new WebResourceResponse("text/plain","UTF-8",new java.io.ByteArrayInputStream(new byte[0]));
      }
      @Override public void onPageFinished(WebView v, String url) {
        Log.i("SomaJS", "WebView document loaded: " + url);
      }
      @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
        if(r.getUrl().toString().startsWith(ASSET_ORIGIN)) return false;
        if ("https".equals(r.getUrl().getScheme())) {
          try { startActivity(new android.content.Intent(android.content.Intent.ACTION_VIEW,r.getUrl())); }
          catch (android.content.ActivityNotFoundException ignored) { }
        }
        return true;
      }
    });
    web.setOnApplyWindowInsetsListener((v,insets)->{
      if(Build.VERSION.SDK_INT>=30){android.graphics.Insets i=insets.getInsets(android.view.WindowInsets.Type.systemBars());v.setPadding(i.left,i.top,i.right,i.bottom);}
      return insets;
    });
    setContentView(web);
    web.loadUrl(ASSET_ORIGIN + "index.html");
  }
  private void send(String function, String payload) {
    runOnUiThread(() -> {
      if(web!=null)web.evaluateJavascript("window."+function+"("+JSONObject.quote(payload)+")",null);
    });
  }
  private void sendError(String function,String message){
    if("somaReceiveLocation".equals(function))send(function,"{\"error\":"+JSONObject.quote(message)+"}");
    else send(function,"ERROR: "+message);
  }
  @Override public void onRequestPermissionsResult(int requestCode,String[] permissions,int[] grants){
    super.onRequestPermissionsResult(requestCode,permissions,grants);
    if(requestCode==LOCATION_PERMISSION_REQUEST){
      if(hasLocationPermission())obtainLocation();
      else sendError("somaReceiveLocation","Location permission denied. Manual city selection still works.");
    }
  }
  private boolean hasLocationPermission(){
    return checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED
      ||checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION)==PackageManager.PERMISSION_GRANTED;
  }
  private void obtainLocation(){
    try{
      if(!hasLocationPermission()){sendError("somaReceiveLocation","Permission required.");return;}
      LocationManager manager=(LocationManager)getSystemService(Context.LOCATION_SERVICE);
      if(manager==null){sendError("somaReceiveLocation","Location provider not found.");return;}
      String provider=manager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)?
        LocationManager.NETWORK_PROVIDER:LocationManager.GPS_PROVIDER;
      if(!manager.isProviderEnabled(provider)){sendError("somaReceiveLocation","Turn on device location services.");return;}
      if(Build.VERSION.SDK_INT>=30){
        manager.getCurrentLocation(provider,null,command -> runOnUiThread(command),this::reportLocation);
      }else{
        Location last=manager.getLastKnownLocation(provider);
        if(last!=null)reportLocation(last);
        else manager.requestSingleUpdate(provider,new android.location.LocationListener(){
          @Override public void onLocationChanged(Location location){reportLocation(location);}
          @Override public void onProviderDisabled(String p){sendError("somaReceiveLocation","Location provider disabled.");}
        },android.os.Looper.getMainLooper());
      }
    }catch(SecurityException e){sendError("somaReceiveLocation","Location permission unavailable.");}
     catch(Exception e){sendError("somaReceiveLocation","Unable to obtain GPS fix.");}
  }
  private void reportLocation(Location loc){
    if(loc==null){sendError("somaReceiveLocation","No location fix received. Try again.");return;}
    try{
      JSONObject j=new JSONObject();
      j.put("lat",loc.getLatitude());j.put("lon",loc.getLongitude());
      j.put("accuracy",loc.hasAccuracy()?loc.getAccuracy():JSONObject.NULL);
      j.put("altitude",loc.hasAltitude()?loc.getAltitude():JSONObject.NULL);
      j.put("zone",TimeZone.getDefault().getID());
      send("somaReceiveLocation",j.toString());
    }catch(Exception e){sendError("somaReceiveLocation","Invalid device location data.");}
  }
  public final class Bridge {
    @JavascriptInterface public void addCalendarEvent(String title,String start,String end,String place,String description) {
      runOnUiThread(() -> {
        try {
          android.content.Intent intent=new android.content.Intent(android.content.Intent.ACTION_INSERT)
            .setData(android.provider.CalendarContract.Events.CONTENT_URI)
            .putExtra(android.provider.CalendarContract.Events.TITLE,title)
            .putExtra(android.provider.CalendarContract.Events.EVENT_LOCATION,place)
            .putExtra(android.provider.CalendarContract.Events.DESCRIPTION,description)
            .putExtra(android.provider.CalendarContract.EXTRA_EVENT_BEGIN_TIME,java.time.Instant.parse(start).toEpochMilli())
            .putExtra(android.provider.CalendarContract.EXTRA_EVENT_END_TIME,java.time.Instant.parse(end).toEpochMilli());
          startActivity(intent);
        } catch(Exception e) { android.widget.Toast.makeText(MainActivity.this,"No calendar app available. Your plan is still saved in Soma.",android.widget.Toast.LENGTH_LONG).show(); }
      });
    }
    /** The phone's text size (Settings › Display › Font size), 1.0 = default. */
    @JavascriptInterface public float fontScale(){return getResources().getConfiguration().fontScale;}
    @JavascriptInterface public void appReady(){
      Log.i("SomaJS","Astronomical app initialized");
      runOnUiThread(()->{
        if(web!=null)web.evaluateJavascript("window.SomaPrototype && window.SomaPrototype.health ? JSON.stringify(window.SomaPrototype.health()) : null",
          value->Log.i("SomaJS","Horizon health "+value));
      });
    }
    @JavascriptInterface public void appFailure(String detail){Log.e("SomaJS","App initialization error: "+detail);}
    /** A week of precomputed Panchang intervals for the home-screen widget (built by widget.js). */
    @JavascriptInterface public void updateWidgetFeed(String json) {
      if(json==null||json.length()>300000)return;
      try{new JSONObject(json);}catch(Exception e){Log.w("SomaJS","Rejected widget feed");return;}
      getSharedPreferences(SomaWidget.PREFS,MODE_PRIVATE).edit().putString(SomaWidget.FEED,json).apply();
      runOnUiThread(() -> { SomaWidget.refreshAll(MainActivity.this); PanchangWidgets.refreshAll(MainActivity.this); });
    }
    /** Reminders computed by the web layer: JSON [{id, at, title, body}]. Scheduled locally with AlarmManager. */
    @JavascriptInterface public void scheduleReminders(String json){
      ReminderReceiver.schedule(getApplicationContext(),json);
    }
    /** Asks for notification permission (Android 13+) when the person turns a reminder on. */
    @JavascriptInterface public void requestNotifications(){
      runOnUiThread(()->{
        ReminderReceiver.ensureChannel(MainActivity.this);
        if(Build.VERSION.SDK_INT>=33&&checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)
          requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},NOTIFICATION_PERMISSION_REQUEST);
      });
    }
    @JavascriptInterface public void requestLocation(){
      runOnUiThread(()->{
        if(hasLocationPermission())obtainLocation();
        else requestPermissions(new String[]{Manifest.permission.ACCESS_COARSE_LOCATION,Manifest.permission.ACCESS_FINE_LOCATION},LOCATION_PERMISSION_REQUEST);
      });
    }
    /**
     * Live weather (opt-in). The app turns it on or off and says which place; only that place, rounded to about 1 km,
     * goes to MET Norway (api.met.no) over HTTPS. Answers through window.somaReceiveWeather with the stored forecast.
     */
    @JavascriptInterface public void weatherConfigure(boolean on,String units,double lat,double lon){
      Weather.configure(getApplicationContext(),on,units);
      if(!on){runOnUiThread(() -> PanchangWidgets.refreshSky(MainActivity.this));send("somaReceiveWeather","");return;}
      weatherRefresh(lat,lon);
    }
    /** Fetch if due (new place, or MET's expiry passed and 30 minutes since the last try); always answers. */
    @JavascriptInterface public void weatherRefresh(double lat,double lon){
      final Context app=getApplicationContext();
      Weather.refresh(app,lat,lon,false,changed -> {
        JSONObject w=Weather.stored(app);
        send("somaReceiveWeather",w==null?"":w.toString());
        if(changed)runOnUiThread(() -> PanchangWidgets.refreshSky(app));
      });
    }
    /** The stored forecast right now, or "" when weather is off or nothing is stored yet. */
    @JavascriptInterface public String weatherNow(){JSONObject w=Weather.stored(getApplicationContext());return w==null?"":w.toString();}
    /** Preview builds only: {enabled, versionCode, versionName}. Store builds report enabled:false. */
    @JavascriptInterface public String updateInfo(){return Updater.info(MainActivity.this);}
    /** Reads the preview feed; answers through window.somaReceiveUpdate. */
    @JavascriptInterface public void checkForUpdate(){Updater.check(getApplicationContext(),json->send("somaReceiveUpdate",json));}
    /** Downloads the newer preview build and opens Android's install prompt. */
    @JavascriptInterface public void installUpdate(){runOnUiThread(()->Updater.install(MainActivity.this,json->send("somaReceiveUpdate",json)));}
    private String safe(String v){if(v==null)return "";return v.length()>100?v.substring(0,100):v;}
  }
  /* The web layer keeps one shared clock (clock.js). Tell it when time may have moved under it: coming back to the
     front (timers are throttled in the background), and the phone's clock, date or time zone changing while open. */
  private final android.content.BroadcastReceiver clockReceiver=new android.content.BroadcastReceiver(){
    @Override public void onReceive(Context c,android.content.Intent i){clockChanged("clock");}
  };
  private boolean clockRegistered=false;
  private void clockChanged(String why){
    if(web!=null)web.evaluateJavascript("window.somaClockChanged && window.somaClockChanged("+JSONObject.quote(why)+")",null);
  }
  @Override protected void onResume() {
    super.onResume();
    if(!clockRegistered){
      android.content.IntentFilter f=new android.content.IntentFilter();
      f.addAction(android.content.Intent.ACTION_TIME_CHANGED);
      f.addAction(android.content.Intent.ACTION_TIMEZONE_CHANGED);
      f.addAction(android.content.Intent.ACTION_DATE_CHANGED);
      if(Build.VERSION.SDK_INT>=33)registerReceiver(clockReceiver,f,Context.RECEIVER_NOT_EXPORTED);else registerReceiver(clockReceiver,f);
      clockRegistered=true;
    }
    if(web!=null){web.onResume();clockChanged("resume");}
  }
  @Override protected void onPause() {
    if(clockRegistered){try{unregisterReceiver(clockReceiver);}catch(IllegalArgumentException ignored){}clockRegistered=false;}
    if(web!=null)web.onPause();
    super.onPause();
  }
  @Override protected void onDestroy() {
    if(web!=null){web.removeJavascriptInterface("SomaNative");web.destroy();web=null;}
    super.onDestroy();
  }
}
