package com.now.meatdelivery;

import android.webkit.GeolocationPermissions;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import android.os.Bundle;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Handle hardware back button - call JS goBack() instead of browser history
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView webView = getBridge().getWebView();
                if (webView != null) {
                    webView.evaluateJavascript(
                        "(function() { " +
                        "  var cur = (window.SCREEN_HISTORY && window.SCREEN_HISTORY[window.SCREEN_HISTORY.length-1]) || 'screen-home'; " +
                        "  if (cur !== 'screen-home' && cur !== 'screen-login') { " +
                        "    goBack(); return 'back'; " +
                        "  } else { " +
                        "    return 'exit'; " +
                        "  } " +
                        "})()",
                        value -> {
                            if (value != null && value.contains("exit")) {
                                finish();
                            }
                        }
                    );
                }
            }
        });
    }

    // Enable geolocation in WebView
    @Override
    public void onStart() {
        super.onStart();
        WebView webView = getBridge().getWebView();
        if (webView != null) {
            webView.getSettings().setJavaScriptEnabled(true);
            webView.getSettings().setGeolocationEnabled(true);
            webView.getSettings().setDomStorageEnabled(true);
            webView.getSettings().setAllowFileAccess(true);
            webView.setWebChromeClient(new WebChromeClient() {
                @Override
                public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                    callback.invoke(origin, true, false);
                }
            });
        }
    }
}
