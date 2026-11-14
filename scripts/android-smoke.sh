#!/usr/bin/env bash
set -euo pipefail
adb install android/app/build/outputs/apk/debug/app-debug.apk
adb logcat -c
adb shell am start -n com.soma.calendar.preview/com.soma.calendar.MainActivity
sleep 18
# Capacitor forwards console output to logcat under Capacitor/Console; native.js prefixes Soma's lines with SomaJS.
adb logcat -d -v time -s Capacitor/Console:* Capacitor:* > soma-js-log.txt
adb exec-out screencap -p > soma-runtime.png || true
adb shell uiautomator dump /sdcard/window.xml || true
adb shell cat /sdcard/window.xml > soma-ui.xml || true
adb logcat -d -v time > soma-full-log.txt || true
cat soma-js-log.txt
if ! grep -Fq 'Astronomical app initialized' soma-js-log.txt; then
  echo 'Soma app did not complete JavaScript startup; checking diagnostics' >&2
  grep -E 'SomaJS|Capacitor' soma-js-log.txt || true
  grep -E 'FATAL EXCEPTION|AndroidRuntime' soma-full-log.txt | tail -25 || true
  exit 1
fi
if grep -E 'E/Capacitor/Console.*(Uncaught|SyntaxError|TypeError|ReferenceError)' soma-js-log.txt; then
  echo 'JavaScript runtime error in WebView' >&2
  exit 1
fi
grep -Fq 'Horizon health' soma-js-log.txt
grep -Fq 'tithi' soma-js-log.txt
echo 'ANDROID RUNTIME SMOKE PASSED: Capacitor WebView and Soma JS bridge initialized'
