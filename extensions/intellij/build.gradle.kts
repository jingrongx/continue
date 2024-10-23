import org.jetbrains.changelog.Changelog
import org.jetbrains.changelog.markdownToHTML

fun properties(key: String) = providers.gradleProperty(key)
fun environment(key: String) = providers.environmentVariable(key)

plugins {
    id("java") // Java 支持
    alias(libs.plugins.kotlin) // Kotlin 支持
    alias(libs.plugins.gradleIntelliJPlugin) // Gradle IntelliJ 插件
    alias(libs.plugins.changelog) // Gradle Changelog 插件
    alias(libs.plugins.qodana) // Gradle Qodana 插件
    alias(libs.plugins.kover) // Gradle Kover 插件
    kotlin("plugin.serialization") version "1.8.0"
}

group = properties("pluginGroup").get()
version = properties("pluginVersion").get()

// 配置项目的依赖
repositories {
    mavenCentral()
}

// 依赖由 Gradle 版本目录管理 - 了解更多: https://docs.gradle.org/current/userguide/platforms.html#sub:version-catalog
dependencies {
//    implementation(libs.annotations)
    implementation("com.squareup.okhttp3:okhttp:4.9.1") {
        exclude(group = "org.jetbrains.kotlin", module = "kotlin-stdlib")
    }
    implementation("org.jetbrains.kotlin:kotlin-stdlib:1.4.32")
    implementation("io.ktor:ktor-server-core:2.3.7"){
        exclude(group = "org.slf4j", module = "slf4j-api")
    }
    implementation("io.ktor:ktor-server-netty:2.3.7") {
        exclude(group = "org.slf4j", module = "slf4j-api")
    }
    implementation("io.ktor:ktor-server-cors:2.3.7"){
        exclude(group = "org.slf4j", module = "slf4j-api")
    }
    implementation("com.posthog.java:posthog:1.+")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.5.0")
//    implementation("com.jetbrains.jsonSchema")
}


// 设置用于构建项目的 JVM 语言级别。对于 2020.3+ 使用 Java 11，对于 
kotlin {
    jvmToolchain(17)
}

// 配置 Gradle IntelliJ 插件 - 了解更多: https://plugins.jetbrains.com/docs/intellij/tools-gradle-intellij-plugin.html
intellij {
    pluginName = properties("pluginName")
    version = properties("platformVersion")
    type = properties("platformType")

    // 插件依赖。使用 gradle.properties 文件中的 `platformPlugins` 属性。
    plugins = properties("platformPlugins").map { it.split(',').map(String::trim).filter(String::isNotEmpty) }
}

// 配置 Gradle Changelog 插件 - 了解更多: https://github.com/JetBrains/gradle-changelog-plugin
changelog {
    groups.empty()
    repositoryUrl = properties("pluginRepositoryUrl")
}

// 配置 Gradle Qodana 插件 - 了解更多: https://github.com/JetBrains/gradle-qodana-plugin
qodana {
    cachePath = provider { file(".qodana").canonicalPath }
    reportPath = provider { file("build/reports/inspections").canonicalPath }
    saveReport = true
    showReport = environment("QODANA_SHOW_REPORT").map { it.toBoolean() }.getOrElse(false)
}

// 配置 Gradle Kover 插件 - 了解更多: https://github.com/Kotlin/kotlinx-kover#configuration
koverReport {
    defaults {
        xml {
            onCheck = true
        }
    }
}

tasks {
    prepareSandbox {
        from("../../binary/bin") {
            into("${intellij.pluginName.get()}/core/")
        }
        from("../vscode/node_modules/@vscode/ripgrep") {
            into("${intellij.pluginName.get()}/ripgrep/")
        }
    }

    wrapper {
        gradleVersion = properties("gradleVersion").get()
    }

    patchPluginXml {
        version = properties("pluginVersion")
        sinceBuild = properties("pluginSinceBuild")
        untilBuild = properties("pluginUntilBuild")

        // 从 README.md 中提取 <!-- Plugin description --> 部分并提供给插件的清单
        pluginDescription = providers.fileContents(layout.projectDirectory.file("README.md")).asText.map {
            val start = "<!-- Plugin description -->"
            val end = "<!-- Plugin description end -->"

            with (it.lines()) {
                if (!containsAll(listOf(start, end))) {
                    throw GradleException("在 README.md 中未找到插件描述部分:\n$start ... $end")
                }
                subList(indexOf(start) + 1, indexOf(end)).joinToString("\n").let(::markdownToHTML)
            }
        }
//
//        val changelog = project.changelog // 为配置缓存兼容性使用的局部变量
//        // 从变更日志文件中获取最新的可用变更说明
//        changeNotes = properties("pluginVersion").map { pluginVersion ->
//            with(changelog) {
//                renderItem(
//                    (getOrNull(pluginVersion) ?: getUnreleased())
//                        .withHeader(false)
//                        .withEmptySections(false),
//                    Changelog.OutputType.HTML,
//                )
//            }
//        }
    }

    // 配置 UI 测试插件
    // 了解更多: https://github.com/JetBrains/intellij-ui-test-robot
    runIdeForUiTests {
        systemProperty("robot-server.port", "8082")
        systemProperty("ide.mac.message.dialogs.as.sheets", "false")
        systemProperty("jb.privacy.policy.text", "<!--999.999-->")
        systemProperty("jb.consents.confirmation.enabled", "false")
    }

    signPlugin {
        certificateChain = environment("CERTIFICATE_CHAIN")
        privateKey = environment("PRIVATE_KEY")
        password = environment("PRIVATE_KEY_PASSWORD")
    }

    publishPlugin {
//        dependsOn("patchChangelog")
        token = environment("PUBLISH_TOKEN")
        // pluginVersion 基于 SemVer (https://semver.org) 并支持预发布标签，如 2.1.7-alpha.3
        // 指定预发布标签以自动在自定义发布频道中发布插件。了解更多:
        // https://plugins.jetbrains.com/docs/intellij/deployment.html#specifying-a-release-channel
        channels.set(listOf(environment("RELEASE_CHANNEL").getOrElse("eap")))

        // 我们总是隐藏稳定版本，直到几天的 EAP 证明它们稳定
//        hidden = environment("RELEASE_CHANNEL").map { it == "stable" }.getOrElse(false)
    }
}
