package com.github.continuedev.continueintellijextension.toolWindow

import com.github.continuedev.continueintellijextension.activities.showTutorial
import com.github.continuedev.continueintellijextension.constants.getConfigJsonPath
import com.github.continuedev.continueintellijextension.`continue`.*
import com.github.continuedev.continueintellijextension.factories.CustomSchemeHandlerFactory
import com.github.continuedev.continueintellijextension.services.ContinuePluginService
import com.google.gson.Gson
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import com.intellij.openapi.Disposable
import com.intellij.openapi.components.ServiceManager
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.Disposer
import com.intellij.ui.jcef.*
import kotlinx.coroutines.*
import org.cef.CefApp
import org.cef.browser.CefBrowser
import org.cef.handler.CefLoadHandlerAdapter

class ContinueBrowser(val project: Project, url: String, useOsr: Boolean = false) {
    private val coroutineScope = CoroutineScope(
        SupervisorJob() + Dispatchers.Default
    )
    private val heightChangeListeners = mutableListOf<(Int) -> Unit>()
    fun onHeightChange(listener: (Int) -> Unit) {
        heightChangeListeners.add(listener)
    }

    private val PASS_THROUGH_TO_CORE = listOf(
        "update/modelChange",
        "ping",
        "abort",
        "history/list",
        "history/delete",
        "history/load",
        "history/save",
        "devdata/log",
        "config/addOpenAiKey",
        "config/addModel",
        "config/ideSettingsUpdate",
        "config/getSerializedProfileInfo",
        "config/deleteModel",
        "config/newPromptFile",
        "config/reload",
        "context/getContextItems",
        "context/loadSubmenuItems",
        "context/addDocs",
        "autocomplete/complete",
        "autocomplete/cancel",
        "autocomplete/accept",
        "command/run",
        "llm/complete",
        "llm/streamComplete",
        "llm/streamChat",
        "llm/listModels",
        "streamDiffLines",
        "stats/getTokensPerDay",
        "stats/getTokensPerModel",
        "index/setPaused",
        "index/forceReIndex",
        "index/indexingProgressBarInitialized",
        "completeOnboarding",
        "addAutocompleteModel",
        "config/listProfiles",
        "profiles/switch",
        "didChangeSelectedProfile",
    )

    private fun registerAppSchemeHandler() {
        CefApp.getInstance().registerSchemeHandlerFactory(
                "http",
                "continue",
                CustomSchemeHandlerFactory()
        )
    }

    val browser: JBCefBrowser
    init {
        val osName = System.getProperty("os.name").toLowerCase()
        val os = when {
            osName.contains("mac") || osName.contains("darwin") -> "darwin"
            osName.contains("win") -> "win32"
            osName.contains("nix") || osName.contains("nux") || osName.contains("aix") -> "linux"
            else -> "linux"
        }

        this.browser = JBCefBrowser.createBuilder().setOffScreenRendering(os == "linux" || useOsr).build()
        browser.jbCefClient.setProperty(
                JBCefClient.Properties.JS_QUERY_POOL_SIZE,
                JS_QUERY_POOL_SIZE
        )
        registerAppSchemeHandler()
        browser.loadURL(url);
        Disposer.register(project, browser)

        // 监听来自浏览器的事件
        val myJSQueryOpenInBrowser = JBCefJSQuery.create((browser as JBCefBrowserBase?)!!)
        myJSQueryOpenInBrowser.addHandler { msg: String? ->
            val parser = JsonParser()
            val json: JsonObject = parser.parse(msg).asJsonObject
            val messageType = json.get("messageType").asString
            val data = json.get("data")
            val messageId = json.get("messageId")?.asString

            val continuePluginService = ServiceManager.getService(
                    project,
                    ContinuePluginService::class.java
            )

            val ide = continuePluginService.ideProtocolClient;

            val respond = fun(data: Any?) {
                // 这与我们在 IdeMessenger.ts (gui) 中期望接收消息的方式相匹配
                // 以及它们在 VS Code (webviewProtocol.ts) 中发送的方式
                var result: Map<String, Any?>? = null
                if (MessageTypes.generatorTypes.contains(messageType)) {
                    result = data as? Map<String, Any?>
                } else {
                    result = mutableMapOf(
                        "status" to "success",
                        "done" to false,
                        "content" to data
                    )
                }

                sendToWebview(messageType, result, messageId ?: uuid())
            }

            if (PASS_THROUGH_TO_CORE.contains(messageType)) {
                continuePluginService.coreMessenger?.request(messageType, data, messageId, respond)
                return@addHandler null
            }

            when (messageType) {
                "jetbrains/editorInsetHeight" -> {
                    val height = data.asJsonObject.get("height").asInt
                    heightChangeListeners.forEach { it(height) }
                }
                "onLoad" -> {
                    coroutineScope.launch {
                        // 设置颜色以匹配 Intellij 主题
                        val colors = GetTheme().getTheme();
                        sendToWebview("setColors", colors)

                        val jsonData = mutableMapOf(
                                "windowId" to continuePluginService.windowId,
                                "workspacePaths" to continuePluginService.workspacePaths,
                                "vscMachineId" to getMachineUniqueID(),
                                "vscMediaUrl" to "http://continue",
                        )
                        respond(jsonData)
                    }

                }
                "showLines" -> {
                    val data = data.asJsonObject
                    ide?.setFileOpen(data.get("filepath").asString)
                    ide?.highlightCode(RangeInFile(
                            data.get("filepath").asString,
                            Range(Position(
                                    data.get("start").asInt,
                                    0
                            ), Position(
                                    data.get("end").asInt,
                                    0
                            )),

                            ),"#00ff0022")
                }
                "showTutorial" -> {
                    showTutorial(project)
                }
                "showVirtualFile" -> {
                    val data = data.asJsonObject
                    ide?.showVirtualFile(data.get("name").asString, data.get("content").asString)
                }
                "showFile" -> {
                    val data = data.asJsonObject
                    ide?.setFileOpen(data.get("filepath").asString)
                }
                "reloadWindow" -> {}
                "openConfigJson" -> {
                    ide?.setFileOpen(getConfigJsonPath())
                }
                "readRangeInFile" -> {
                    val data = data.asJsonObject
                    ide?.readRangeInFile(RangeInFile(
                            data.get("filepath").asString,
                            Range(Position(
                                    data.get("start").asInt,
                                    0
                            ), Position(
                                    data.get("end").asInt + 1,
                                    0
                            )),
                    ))
                }
                "focusEditor" -> {}

                // IDE //
                else -> {
                    if (msg != null) {
                        ide?.handleMessage(msg, respond)
                    }
                }
            }


            null
        }

        // 监听页面加载事件
        browser.jbCefClient.addLoadHandler(object : CefLoadHandlerAdapter() {
            override fun onLoadingStateChange(
                    browser: CefBrowser?,
                    isLoading: Boolean,
                    canGoBack: Boolean,
                    canGoForward: Boolean
            ) {
                if (!isLoading) {
                    // 页面已加载完成
                    executeJavaScript(browser, myJSQueryOpenInBrowser)
                }
            }
        }, browser.cefBrowser)

    }
    fun executeJavaScript(browser: CefBrowser?, myJSQueryOpenInBrowser: JBCefJSQuery) {
        // 执行 JavaScript - 你可能需要在这里处理潜在的异常
        val script = """window.postIntellijMessage = function(messageType, data, messageId) {
                const msg = JSON.stringify({messageType, data, messageId});
                ${myJSQueryOpenInBrowser.inject("msg")}
            }""".trimIndent()

        browser?.executeJavaScript(script, browser.url, 0)
    }

    fun sendToWebview(
            messageType: String,
            data: Any?,
            messageId: String = uuid()
    ) {
        val jsonData = Gson().toJson(
                mapOf(
                        "messageId" to messageId,
                        "messageType" to messageType,
                        "data" to data
                )
        )
        val jsCode = buildJavaScript(jsonData)

        try {
            this.browser.executeJavaScriptAsync(jsCode)
        } catch (error: IllegalStateException) {
            println("Webview 尚未初始化 $error")
        }
    }

    private fun buildJavaScript(jsonData: String): String {
        return """window.postMessage($jsonData, "*");"""
    }
}
