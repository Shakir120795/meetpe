package com.now.meatdelivery;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.webkit.WebView;

import androidx.activity.OnBackPressedCallback;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private static final int LOCATION_PERMISSION_REQUEST = 1001;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Keep the Android status bar visible and prevent the app
        // from treating the status-bar area as hidden content.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), true);

        WindowCompat.getInsetsController(
                getWindow(),
                getWindow().getDecorView()
        ).show(WindowInsetsCompat.Type.statusBars());

        // Request location permission at startup
        requestLocationPermission();

        // Handle hardware back button
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView webView = getBridge().getWebView();

                if (webView != null) {
                    webView.evaluateJavascript(
                        "try { " +
                        "  var locMap = document.getElementById('locMapScreen'); " +
                        "  if (locMap && locMap.style.display !== 'none') { closeLocMap(); 'stayed'; } " +
                        "  else if (document.getElementById('mapPickerScreen') && document.getElementById('mapPickerScreen').classList.contains('open')) { document.getElementById('mapPickerScreen').classList.remove('open'); 'stayed'; } " +
                        "  else if (document.getElementById('ratingPopupOverlay')) { document.getElementById('ratingPopupOverlay').remove(); 'stayed'; } " +
                        "  else if (typeof SCREEN_HISTORY !== 'undefined' && SCREEN_HISTORY.length > 0) { " +
                        "    var cur = SCREEN_HISTORY[SCREEN_HISTORY.length - 1]; " +
                        "    if (cur && cur !== 'screen-home') { " +
                        "      goBack(); 'stayed'; " +
                        "    } else { 'exit'; } " +
                        "  } else { 'exit'; } " +
                        "} catch(e) { 'exit'; }",
                        value -> {
                            if (value != null && value.contains("exit")) {
                                finishAffinity();
                            }
                        }
                    );
                } else {
                    finishAffinity();
                }
            }
        });
    }

    @Override
    public void onStart() {
        super.onStart();

        // Configure WebView for geolocation
        WebView webView = getBridge().getWebView();

        if (webView != null) {
            webView.getSettings().setGeolocationEnabled(true);
            webView.getSettings().setJavaScriptEnabled(true);
            webView.getSettings().setDomStorageEnabled(true);
            webView.getSettings().setGeolocationDatabasePath(
                    getFilesDir().getPath()
            );
        }
    }

    private void requestLocationPermission() {
        if (ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.ACCESS_FINE_LOCATION
        ) != PackageManager.PERMISSION_GRANTED) {

            ActivityCompat.requestPermissions(
                this,
                new String[]{
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
                },
                LOCATION_PERMISSION_REQUEST
            );
        }
    }
}