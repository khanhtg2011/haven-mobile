package com.haven.desktop

import android.Manifest
import android.content.pm.PackageManager
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature

class MainActivity : TauriActivity() {
  private var targetWebView: WebView? = null
  private var focusScript: String = ""
  private val mainHandler = Handler(Looper.getMainLooper())

  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)

    // Keep status/navigation bars dark with light icons and apply system/IME insets
    // so headers and the message composer never render underneath system bars or keyboards.
    window.decorView.setBackgroundColor(Color.parseColor("#2B2D31"))
    WindowInsetsControllerCompat(window, window.decorView).apply {
      isAppearanceLightStatusBars = false
      isAppearanceLightNavigationBars = false
    }
    findViewById<android.view.View>(android.R.id.content)?.let { contentView ->
      ViewCompat.setOnApplyWindowInsetsListener(contentView) { view, windowInsets ->
        val insets = windowInsets.getInsets(
          WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.ime()
        )
        view.setPadding(insets.left, insets.top, insets.right, insets.bottom)
        WindowInsetsCompat.CONSUMED
      }
    }

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

    webView.settings.userAgentString =
      "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36 HavenMobile/2.0.0"

    // 1. Native Chromium Document-Start Injection (idempotent, null-DOM safe)
    if (focusScript.isNotEmpty() && WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
      try {
        WebViewCompat.addDocumentStartJavaScript(webView, focusScript, setOf("*"))
      } catch (e: Exception) {
        e.printStackTrace()
      }
    }

    // 2. Single post-attach fallback in case initial page loaded before document-start hook
    if (focusScript.isNotEmpty()) {
      mainHandler.postDelayed({
        targetWebView?.evaluateJavascript(focusScript, null)
      }, 600)
    }
  }

  override fun onWebViewHistoryChanged(webView: WebView) {
    super.onWebViewHistoryChanged(webView)
    if (focusScript.isNotEmpty()) {
      webView.evaluateJavascript(focusScript, null)
    }
  }

  override fun onDestroy() {
    mainHandler.removeCallbacksAndMessages(null)
    targetWebView = null
    super.onDestroy()
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
