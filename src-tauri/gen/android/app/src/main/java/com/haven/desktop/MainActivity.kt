package com.haven.desktop

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.webkit.PermissionRequest
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature

class MainActivity : TauriActivity() {
  private var targetWebView: WebView? = null
  private var focusScript: String = ""
  private val mainHandler = Handler(Looper.getMainLooper())

  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
    requestAppPermissions()

    try {
      focusScript = assets.open("mobile-focus.js").bufferedReader().use { it.readText() }
    } catch (e: Exception) {
      e.printStackTrace()
    }
  }

  override fun onWebViewCreate(webView: WebView) {
    super.onWebViewCreate(webView)
    targetWebView = webView

    webView.settings.userAgentString = "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36 HavenMobile/2.0.0"

    // 1. Native Chromium Document Start Injection (runs before any HTML renders)
    if (focusScript.isNotEmpty() && WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
      try {
        WebViewCompat.addDocumentStartJavaScript(webView, focusScript, setOf("*"))
      } catch (e: Exception) {
        e.printStackTrace()
      }
    }

    // 2. Periodic evaluator to guarantee injection on single-page app (SPA) DOM state transitions
    val periodicInjector = object : Runnable {
      override fun run() {
        if (focusScript.isNotEmpty() && targetWebView != null) {
          targetWebView?.evaluateJavascript(focusScript, null)
        }
        mainHandler.postDelayed(this, 1200)
      }
    }
    mainHandler.postDelayed(periodicInjector, 800)
  }

  override fun onWebViewHistoryChanged(webView: WebView) {
    super.onWebViewHistoryChanged(webView)
    if (focusScript.isNotEmpty()) {
      webView.evaluateJavascript(focusScript, null)
    }
  }

  private fun requestAppPermissions() {
    val permissions = mutableListOf(
      Manifest.permission.RECORD_AUDIO,
      Manifest.permission.MODIFY_AUDIO_SETTINGS,
      Manifest.permission.CAMERA
    )
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      permissions.add(Manifest.permission.POST_NOTIFICATIONS)
    }

    val missing = permissions.filter {
      ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
    }

    if (missing.isNotEmpty()) {
      ActivityCompat.requestPermissions(this, missing.toTypedArray(), 1001)
    }
  }
}
