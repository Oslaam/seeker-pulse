package xyz.seekerpulse;

import android.os.Bundle;
import android.webkit.WebView;
import android.content.pm.ApplicationInfo;

import com.getcapacitor.BridgeActivity;
import com.solanamobile.capacitor.mwa.SolanaMWAPlugin;

public class MainActivity extends BridgeActivity {
	@Override
	public void onCreate(Bundle savedInstanceState) {
		registerPlugin(SolanaMWAPlugin.class);
		super.onCreate(savedInstanceState);
		if ((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
			WebView.setWebContentsDebuggingEnabled(true);
		}
	}
}
