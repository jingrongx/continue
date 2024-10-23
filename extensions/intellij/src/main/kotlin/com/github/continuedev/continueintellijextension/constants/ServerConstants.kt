package com.github.continuedev.continueintellijextension.constants

import java.io.File
import java.nio.file.Files
import java.nio.file.Paths

const val DEFAULT_CONFIG = """
{
  "models": [
    {
      "title": "GPT-4",
      "provider": "free-trial",
      "model": "gpt-4"
    },
    {
      "title": "GPT-3.5-Turbo",
      "provider": "free-trial",
      "model": "gpt-3.5-turbo"
    },
    {
      "title": "Phind CodeLlama",
      "provider": "free-trial",
      "model": "phind-codellama-34b"
    },
    {
      "title": "Gemini Pro",
      "provider": "free-trial",
      "model": "gemini-pro"
    }
  ],
  "slashCommands": [
    {
      "name": "edit",
      "description": "编辑高亮代码"
    },
    {
      "name": "comment",
      "description": "为高亮代码写注释"
    },
    {
      "name": "share",
      "description": "将当前聊天会话导出为markdown"
    },
    {
      "name": "cmd",
      "description": "生成一个shell命令"
    }
  ],
  "customCommands": [
    {
      "name": "test",
      "prompt": "{{{ input }}}\n\n为选定的代码编写一套全面的单元测试。它应该设置、运行测试以检查正确性，包括重要的边界情况，并进行拆卸。确保测试完整且复杂。仅以聊天输出的形式给出测试，不要编辑任何文件。",
      "description": "为高亮代码编写单元测试"
    }
  ],
  "contextProviders": [
    { "name": "diff", "params": {} },
    {
      "name": "open",
      "params": {}
    },
    { "name": "terminal", "params": {} }
  ]
}
"""

const val DEFAULT_CONFIG_JS = """
function modifyConfig(config) {
  return config;
}
export {
  modifyConfig
};
"""

fun getContinueGlobalPath(): String {
    val continuePath = Paths.get(System.getProperty("user.home"), ".continue")
    if (Files.notExists(continuePath)) {
        Files.createDirectories(continuePath)
    }
    return continuePath.toString()
}

fun getContinueRemoteConfigPath(remoteHostname: String): String {
    val path = Paths.get(getContinueGlobalPath(), ".configs")
    if (Files.notExists(path)) {
        Files.createDirectories(path)
    }
    return Paths.get(path.toString(), remoteHostname).toString()
}


fun getConfigJsonPath(remoteHostname: String? = null): String {
    val path = Paths.get(
        if (remoteHostname != null) getContinueRemoteConfigPath(remoteHostname) else getContinueGlobalPath(),
        "config.json"
    )
    if (Files.notExists(path)) {
        Files.createFile(path)
        Files.writeString(path, if (remoteHostname == null) DEFAULT_CONFIG else "{}")
    }
    return path.toString()
}

fun getConfigJsPath(remoteHostname: String? = null): String {
    val path = Paths.get(
        if (remoteHostname != null) getContinueRemoteConfigPath(remoteHostname) else getContinueGlobalPath(),
        "config.js"
    )
    if (Files.notExists(path)) {
        Files.createFile(path)
        Files.writeString(path, DEFAULT_CONFIG_JS);
    }
    return path.toString()
}

fun getSessionsDir(): String {
    val path = Paths.get(getContinueGlobalPath(), "sessions")
    if (Files.notExists(path)) {
        Files.createDirectories(path)
    }
    return path.toString()
}

fun getSessionsListPath(): String {
    val path = Paths.get(getSessionsDir(),  "sessions.json")
    if (Files.notExists(path)) {
        Files.createFile(path)
        Files.writeString(path, "[]");
    }
    return path.toString()
}

fun getSessionFilePath(sessionId: String): String {
    val path = Paths.get(getSessionsDir(),  "$sessionId.json")
    if (Files.notExists(path)) {
        Files.createFile(path)
        Files.writeString(path, "{}");
    }
    return path.toString()
}

fun devDataPath(): String {
    val path = Paths.get(getContinueGlobalPath(), "dev_data")
    if (Files.notExists(path)) {
        Files.createDirectories(path)
    }
    return path.toString()
}

fun getDevDataFilepath(filename: String): String {
    val path = Paths.get(devDataPath(), filename)
    if (Files.notExists(path)) {
        Files.createFile(path)
    }
    return path.toString()
}

fun getMigrationsFolderPath(): String {
    val path = Paths.get(getContinueGlobalPath(), ".migrations")
    if (Files.notExists(path)) {
        Files.createDirectories(path)
    }
    return path.toString()
}

fun migrate(id: String, callback: () -> Unit) {
    val migrationsPath = getMigrationsFolderPath()
    val migrationPath = Paths.get(migrationsPath, id).toString()
    val migrationFile = File(migrationPath)
    if (!migrationFile.exists()) {
        migrationFile.writeText("")
        callback()
    }
}