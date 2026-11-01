package com.soma.calendar;

import android.app.Activity;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebResourceRequest;

/** No network, GPS, login or ad permissions. All calculations are local. */
public final class MainActivity extends Activity {
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
      @Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest r) {
        return !r.getUrl().toString().startsWith("file:///android_asset/");
      }
    });
    setContentView(web);
    web.loadUrl("file:///android_asset/index.html");
  }
  public final class Bridge {
    @JavascriptInterface public void updateWidget(String date,String phase,String tithi,String city) {
      getSharedPreferences("soma_widget",MODE_PRIVATE).edit()
        .putString("date",safe(date)).putString("phase",safe(phase))
        .putString("tithi",safe(tithi)).putString("city",safe(city)).apply();
      runOnUiThread(() -> SomaWidget.refreshAll(MainActivity.this));
    }
    private String safe(String v){ if(v==null)return "";return v.length()>100?v.substring(0,100):v; }
  }
  @Override protected void onDestroy() {
    if(web!=null){web.removeJavascriptInterface("SomaNative");web.destroy();web=null;}
    super.onDestroy();
  }
}
