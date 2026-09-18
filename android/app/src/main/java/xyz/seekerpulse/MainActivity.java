package xyz.seekerpulse;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.solanamobile.capacitor.mwa.SolanaMWAPlugin;

public class MainActivity extends BridgeActivity {
	@Override
	public void onCreate(Bundle savedInstanceState) {
		registerPlugin(SolanaMWAPlugin.class);
		super.onCreate(savedInstanceState);
	}
}
