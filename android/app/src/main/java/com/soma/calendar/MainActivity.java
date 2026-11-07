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
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import org.json.JSONArray;
import java.util.Locale;
import java.util.TimeZone;
import org.json.JSONObject;

/** Privacy-first Android shell. Location and weather are explicitly requested by the user. */
public final class MainActivity extends Activity {
  private static final int LOCATION_PERMISSION_REQUEST = 412;
  private WebView web;
  private static final String ASSET_ORIGIN = "https://appassets.androidplatform.net/assets/";
  @Override public void onCreate(Bundle state) {
    super.onCreate(state);
    getWindow().setStatusBarColor(0xff101c1a);
    getWindow().setNavigationBarColor(0xff101c1a);
    getWindow().getDecorView().setSystemUiVisibility(0);
    web=new WebView(this);
    web.setBackgroundColor(0xff101c1a);
    WebSettings s=web.getSettings();
    s.setJavaScriptEnabled(true);
    s.setDomStorageEnabled(true);
    s.setAllowContentAccess(false);
    s.setAllowFileAccess(false);
    s.setAllowFileAccessFromFileURLs(false);
    s.setAllowUniversalAccessFromFileURLs(false);
    s.setJavaScriptCanOpenWindowsAutomatically(false);
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
    @JavascriptInterface public void appReady(){
      Log.i("SomaJS","Astronomical app initialized");
      runOnUiThread(()->{
        if(web!=null)web.evaluateJavascript("window.SomaPrototype && window.SomaPrototype.health ? JSON.stringify(window.SomaPrototype.health()) : null",
          value->Log.i("SomaJS","Horizon health "+value));
      });
    }
    @JavascriptInterface public void appFailure(String detail){Log.e("SomaJS","App initialization error: "+detail);}
    @JavascriptInterface public void updateWidget(String date,String phase,String tithi,String city) {
      getSharedPreferences("soma_widget",MODE_PRIVATE).edit()
        .putString("date",safe(date)).putString("phase",safe(phase))
        .putString("tithi",safe(tithi)).putString("city",safe(city)).apply();
      runOnUiThread(() -> SomaWidget.refreshAll(MainActivity.this));
    }
    @JavascriptInterface public void updateAtmosphere(String temp,String cloud,String status) {
      getSharedPreferences("soma_widget",MODE_PRIVATE).edit()
        .putString("temp",safe(temp)).putString("cloud",safe(cloud))
        .putString("weatherStatus",safe(status)).apply();
      runOnUiThread(() -> SomaWidget.refreshAll(MainActivity.this));
    }
    /** Only the text typed into birthplace search leaves the device; birth date/time are never transmitted. */
    @JavascriptInterface public void searchBirthplaces(String query){
      final String term=query==null?"":query.trim();
      if(term.length()<3||term.length()>100){placeError("Search for a place using at least three letters.");return;}
      new Thread(()->{
        HttpURLConnection conn=null;
        try{
          String encoded=URLEncoder.encode(term,"UTF-8");
          URL url=new URL("https://geocoding-api.open-meteo.com/v1/search?name="+encoded+"&count=8&language=en");
          conn=(HttpURLConnection)url.openConnection();
          conn.setRequestMethod("GET");
          conn.setConnectTimeout(10000);conn.setReadTimeout(12000);
          conn.setInstanceFollowRedirects(false);
          if(conn.getResponseCode()!=200){placeError("Place lookup unavailable (HTTP "+conn.getResponseCode()+"). Manual coordinates still work.");return;}
          StringBuilder response=new StringBuilder();
          try(BufferedReader reader=new BufferedReader(new InputStreamReader(conn.getInputStream(),"UTF-8"))){
            String line;while((line=reader.readLine())!=null){
              if(response.length()+line.length()>60000)throw new IllegalStateException("Place search response too large");
              response.append(line);
            }
          }
          JSONObject data=new JSONObject(response.toString());
          JSONArray result=new JSONArray();
          JSONArray rows=data.optJSONArray("results");
          if(rows!=null)for(int i=0;i<Math.min(rows.length(),8);i++){
            JSONObject row=rows.optJSONObject(i);
            if(row==null||!row.has("latitude")||!row.has("longitude")||!row.has("timezone"))continue;
            JSONObject option=new JSONObject();
            String name=row.optString("name","Place");
            String region=row.optString("admin1","");
            String country=row.optString("country","");
            option.put("name",name+(region.isEmpty()?"":", "+region)+(country.isEmpty()?"":", "+country));
            option.put("lat",row.getDouble("latitude"));
            option.put("lon",row.getDouble("longitude"));
            option.put("zone",row.getString("timezone"));
            if(row.has("elevation")&&!row.isNull("elevation"))option.put("elevation",row.getDouble("elevation"));
            result.put(option);
          }
          JSONObject output=new JSONObject();output.put("results",result);
          send("somaReceiveBirthplaces",output.toString());
        }catch(Exception e){placeError("Online place search failed. Use manual coordinates or try again.");}
        finally{if(conn!=null)conn.disconnect();}
      },"SomaBirthPlaceSearch").start();
    }
    private void placeError(String message){
      try{JSONObject j=new JSONObject();j.put("error",message);send("somaReceiveBirthplaces",j.toString());}
      catch(Exception ignored){send("somaReceiveBirthplaces","{\"error\":\"Place search unavailable\"}");}
    }
    @JavascriptInterface public void requestLocation(){
      runOnUiThread(()->{
        if(hasLocationPermission())obtainLocation();
        else requestPermissions(new String[]{Manifest.permission.ACCESS_COARSE_LOCATION,Manifest.permission.ACCESS_FINE_LOCATION},LOCATION_PERMISSION_REQUEST);
      });
    }
    /** Opt-in weather query: coordinates go only to api.open-meteo.com, over HTTPS. */
    @JavascriptInterface public void fetchWeather(double lat,double lon){
      if(!Double.isFinite(lat)||!Double.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180){
        sendError("somaReceiveWeather","Coordinates out of range.");return;
      }
      new Thread(()->{
        HttpURLConnection conn=null;
        try {
          String params="temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m,surface_pressure,uv_index,dew_point_2m,weather_code,is_day";
          String endpoint=String.format(Locale.US,"https://api.open-meteo.com/v1/forecast?latitude=%.5f&longitude=%.5f&current=%s&timezone=auto",lat,lon,params);
          conn=(HttpURLConnection)new URL(endpoint).openConnection();
          conn.setRequestMethod("GET");conn.setConnectTimeout(10000);conn.setReadTimeout(10000);
          conn.setInstanceFollowRedirects(false);
          conn.setRequestProperty("User-Agent","SomaCalendar/0.2 (Android; Open-Meteo attribution in app)");
          if(conn.getResponseCode()!=200){sendError("somaReceiveWeather","Provider HTTP "+conn.getResponseCode());return;}
          StringBuilder text=new StringBuilder();
          try(BufferedReader reader=new BufferedReader(new InputStreamReader(conn.getInputStream(),"UTF-8"))){
            String line;while((line=reader.readLine())!=null){
              if(text.length()+line.length()>40000)throw new IllegalStateException("Weather response too large");
              text.append(line);
            }
          }
          JSONObject response=new JSONObject(text.toString());
          if(!response.has("current"))throw new IllegalStateException("Weather fields missing");
          send("somaReceiveWeather",response.toString());
        }catch(Exception e){sendError("somaReceiveWeather","Weather unavailable. Try again later.");}
        finally{if(conn!=null)conn.disconnect();}
      }).start();
    }
    private String safe(String v){if(v==null)return "";return v.length()>100?v.substring(0,100):v;}
  }
  @Override protected void onDestroy() {
    if(web!=null){web.removeJavascriptInterface("SomaNative");web.destroy();web=null;}
    super.onDestroy();
  }
}
