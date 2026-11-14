package com.soma.calendar;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

/** Capacitor host for the shared Soma web app (www/). Native extras live in SomaPlugin and SomaWidget. */
public class MainActivity extends BridgeActivity {
  @Override public void onCreate(Bundle savedInstanceState) {
    registerPlugin(SomaPlugin.class);
    super.onCreate(savedInstanceState);
  }
}
