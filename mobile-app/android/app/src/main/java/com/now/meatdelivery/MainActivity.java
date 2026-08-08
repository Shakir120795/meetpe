package com.now.meatdelivery;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.webkit.GeolocationPermissions;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private static final int LOCATION_PERMISSION_REQUEST = 1001;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Request location permission at startup
        requestLocationPermission();

        // Handle hardware back button
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView webView = getBridge().getWebView();
                if (webView != null) {
                    // Call JS to check current screen and go back
                    webView.evaluateJavascript(
                        "try { " +
                        "  if (typeof SCREEN_HISTORY !== 'undefined' && SCREEN_HISTORY.length > 1) { " +
                        "    var cur = SCREEN_HISTORY[SCREEN_HISTORY.length - 1]; " +
                        "    if (cur && cur !== 'screen-home' && cur !== 'screen-login') { " +
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
            
            webView.setWebChromeClient(new WebChromeClient() {
                @Override
                public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                    // Auto-grant geolocation permission to our app
                    callback.invoke(origin, true, true);
                }
            });
        }
    }

    private void requestLocationPermission() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) 
                != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this,
                new String[]{
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
                },
                LOCATION_PERMISSION_REQUEST);
        }
    }
}
