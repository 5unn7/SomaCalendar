package com.soma.calendar;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInstaller;
import org.json.JSONObject;

/** Result of an Updater install session: shows Android's confirm screen, or reports the outcome. */
public final class UpdateReceiver extends BroadcastReceiver {
  @Override public void onReceive(Context c, Intent intent) {
    int status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE);
    if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
      Intent confirm = intent.getParcelableExtra(Intent.EXTRA_INTENT);
      if (confirm != null) {
        confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try { c.startActivity(confirm); Updater.emit("confirm", null); }
        catch (Exception e) { Updater.error("Android could not open the installer."); }
      }
      return;
    }
    if (status == PackageInstaller.STATUS_SUCCESS) { Updater.emit("done", null); return; }
    if (status == PackageInstaller.STATUS_FAILURE_ABORTED) { Updater.emit("cancelled", null); return; }
    String msg = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE);
    android.util.Log.w("SomaUpdate", "Install failed: " + status + " " + msg);
    Updater.error(status == PackageInstaller.STATUS_FAILURE_CONFLICT || status == PackageInstaller.STATUS_FAILURE_INCOMPATIBLE
      ? "This build is signed differently. Uninstall Soma Preview once, then install the latest APK by hand."
      : "Android could not install the update" + (msg == null ? "." : ": " + msg));
  }
}
