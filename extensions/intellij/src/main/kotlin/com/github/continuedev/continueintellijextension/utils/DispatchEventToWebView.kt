package com.github.continuedev.continueintellijextension.utils

import com.google.gson.Gson
import com.intellij.ui.jcef.JBCefBrowser
import com.intellij.ui.jcef.executeJavaScriptAsync
import kotlinx.coroutines.CoroutineExceptionHandler
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

fun CoroutineScope.dispatchEventToWebview(
    type: String,
    data: Map<String, Any>,
    webView: JBCefBrowser?
) {
    if (webView == null) return
    val gson = Gson()
    val jsonData = gson.toJson(data)
    val jsCode = buildJavaScript(type, jsonData)

    launch(CoroutineExceptionHandler { _, exception ->
        println("自定义事件分发失败: ${exception.message}")
    }) {
        while (true) {
            try {
                webView.executeJavaScriptAsync(jsCode)
                break  // 如果JS执行成功，跳出循环
            } catch (e: IllegalStateException) {
                delay(1000)  // 如果发生错误，等待1秒然后重试
            }
        }
    }
}

fun CoroutineScope.runJsInWebview(
        jsCode: String,
        webView: JBCefBrowser?
) {
    if (webView == null) return
    launch(CoroutineExceptionHandler { _, exception ->
        println("自定义事件分发失败: ${exception.message}")
    }) {
        while (true) {
            try {
                webView.executeJavaScriptAsync(jsCode)
                break  // 如果JS执行成功，跳出循环
            } catch (e: IllegalStateException) {
                delay(1000)  // 如果发生错误，等待1秒然后重试
            }
        }
    }
}

private fun buildJavaScript(type: String, jsonData: String): String {
    return """window.postMessage($jsonData, "*");"""
}
