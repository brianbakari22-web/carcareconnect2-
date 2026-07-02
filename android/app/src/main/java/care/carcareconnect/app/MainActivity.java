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
        public boolean shouldOverrideUrlLoading(android.webkit.WebView view, android.webkit.WebResourceRequest request) {
          String url = request.getUrl().toString();
          if (!url.startsWith("http://") && !url.startsWith("https://")) {
            try {
              android.content.Intent intent = android.content.Intent.parseUri(url, android.content.Intent.URI_INTENT_SCHEME);
              startActivity(intent);
              return true;
            } catch (Exception e) {
              return false;
            }
          }
          // For geo:, tel:, intent: etc that dont need parsing
          if (url.startsWith("geo:") || url.startsWith("tel:") || url.startsWith("mailto:") || url.startsWith("intent:")) {
            try {
              android.content.Intent intent = new android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(url));
              startActivity(intent);
              return true;
            } catch (Exception e) {
              return false;
            }
          }
          return false;
        }

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

