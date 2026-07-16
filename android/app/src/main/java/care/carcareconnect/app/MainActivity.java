package care.carcareconnect.app;
import com.getcapacitor.BridgeActivity;
import android.os.Bundle;
import android.graphics.Color;
import android.webkit.WebView;
import android.webkit.WebSettings;
import android.webkit.DownloadListener;
import android.app.DownloadManager;
import android.net.Uri;
import android.os.Environment;
import android.content.Context;
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
      
      // Enable file downloads
      webView.setDownloadListener(new DownloadListener() {
        @Override
        public void onDownloadStart(String url, String userAgent, String contentDisposition, String mimeType, long contentLength) {
          try {
            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
            request.setMimeType(mimeType);
            request.addRequestHeader("User-Agent", userAgent);
            request.setDescription("Downloading your data...");
            request.setTitle("Car Care Connect Data Export");
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, "ccc-my-data");
            DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
            dm.enqueue(request);
            android.widget.Toast.makeText(getApplicationContext(), "Download started - check your Downloads folder", android.widget.Toast.LENGTH_LONG).show();
          } catch(Exception e) {
            android.widget.Toast.makeText(getApplicationContext(), "Download failed: " + e.getMessage(), android.widget.Toast.LENGTH_SHORT).show();
          }
        }
      });

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
