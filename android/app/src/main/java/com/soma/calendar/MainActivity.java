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
import android.webkit.WebResourceRequest;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Locale;
import java.util.TimeZone;
import org.json.JSONObject;

/** Privacy-first Android shell. Location and weather are explicitly requested by the user. */
public final class MainActivity extends Activity {
  private static final int LOCATION_PERMISSION_REQUEST = 412;
  private WebView web;
  @Override public void onCreate(Bundle state) {
    super.onCreate(state);
    getWindow().setStatusBarColor(0xfff6f7f2);
    getWindow().setNavigationBarColor(0xfff6f7f2);
    getWindow().getDecorView().setSystemUiVisibility(0x00002000 | 0x00000010);
    web=new WebView(this);
    web.setBackgroundColor(0xfff6f7f2);
    WebSettings s=web.getSettings();
    s.setJavaScriptEnabled(true);
    s.setDomStorageEnabled(true);
    s.setAllowContentAccess(false);
    s.setAllowFileAccess(true);
    s.setAllowFileAccessFromFileURLs(false);
    s.setAllowUniversalAccessFromFileURLs(false);
    s.setJavaScriptCanOpenWindowsAutomatically(false);
    web.addJavascriptInterface(new Bridge(),"SomaNative");
    web.setWebViewClient(new WebViewClient() {
      @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
        return !r.getUrl().toString().startsWith("file:///android_asset/");
      }
    });
    setContentView(web);
    web.loadUrl("file:///android_asset/index.html");
  }
  private void send(String function, String payload) {
    runOnUiThread(() -> {
      if(web!=null)web.evaluateJavascript("window."+function+"("+JSONObject.quote(payload)+")",null);
    });
  }
  private void sendError(String function,String message){send(function,"ERROR: "+message);}
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
        if(last==null)sendError("somaReceiveLocation","No recent device location. Try again outside.");
        else reportLocation(last);
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
