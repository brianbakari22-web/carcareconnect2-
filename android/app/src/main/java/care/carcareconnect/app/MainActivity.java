package care.carcareconnect.app;
import com.getcapacitor.BridgeActivity;
import android.os.Bundle;
import android.graphics.Color;
import android.webkit.WebView;
import android.webkit.WebSettings;
import android.view.View;
import android.os.Handler;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    WebView webView = getBridge().getWebView();
    if (webView != null) {
      WebSettings settings = webView.getSettings();
      settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
      webView.clearCache(true);
      settings.setDomStorageEnabled(true);
      settings.setDatabaseEnabled(true);

      webView.setBackgroundColor(Color.parseColor("#e6821e"));
      webView.setVisibility(View.INVISIBLE);

      webView.setWebViewClient(new android.webkit.WebViewClient() {
        boolean shown = false;
        @Override
        public void onPageFinished(android.webkit.WebView view, String url) {
          super.onPageFinished(view, url);
          if (!shown) {
            shown = true;
            new Handler().postDelayed(() -> {
              webView.setBackgroundColor(Color.WHITE);
              webView.setVisibility(View.VISIBLE);
            }, 500);
          }
        }
      });
    }
  }
}
