@rem
@rem 版权所有 2015 原作者或作者。
@rem
@rem 根据 Apache 许可证，版本 2.0（“许可证”）授权；
@rem 除非遵守许可证，否则您不得使用此文件。
@rem 您可以在以下网址获取许可证副本：
@rem
@rem      https://www.apache.org/licenses/LICENSE-2.0
@rem
@rem 除非适用法律要求或书面同意，否则按“原样”分发
@rem 本软件不附带任何明示或暗示的担保或条件。
@rem 请参阅许可证以了解管理权限和限制。
@rem

@if "%DEBUG%"=="" @echo off
@rem ##########################################################################
@rem
@rem  Windows 的 Gradle 启动脚本
@rem
@rem ##########################################################################

@rem 为 Windows NT shell 设置局部变量范围
if "%OS%"=="Windows_NT" setlocal

set DIRNAME=%~dp0
if "%DIRNAME%"=="" set DIRNAME=.
@rem 这通常不使用
set APP_BASE_NAME=%~n0
set APP_HOME=%DIRNAME%

@rem 解析 APP_HOME 中的任何 "." 和 ".." 以缩短路径。
for %%i in ("%APP_HOME%") do set APP_HOME=%%~fi

@rem 在此处添加默认 JVM 选项。您也可以使用 JAVA_OPTS 和 GRADLE_OPTS 将 JVM 选项传递给此脚本。
set DEFAULT_JVM_OPTS="-Xmx64m" "-Xms64m"

@rem 查找 java.exe
if defined JAVA_HOME goto findJavaFromJavaHome

set JAVA_EXE=java.exe
%JAVA_EXE% -version >NUL 2>&1
if %ERRORLEVEL% equ 0 goto execute

echo.
echo 错误: JAVA_HOME 未设置，并且在您的 PATH 中找不到 'java' 命令。
echo.
echo 请在您的环境中设置 JAVA_HOME 变量以匹配
echo 您的 Java 安装位置。

goto fail

:findJavaFromJavaHome
set JAVA_HOME=%JAVA_HOME:"=%
set JAVA_EXE=%JAVA_HOME%/bin/java.exe

if exist "%JAVA_EXE%" goto execute

echo.
echo 错误: JAVA_HOME 设置为无效目录: %JAVA_HOME%
echo.
echo 请在您的环境中设置 JAVA_HOME 变量以匹配
echo 您的 Java 安装位置。

goto fail

:execute
@rem 设置命令行

set CLASSPATH=%APP_HOME%\gradle\wrapper\gradle-wrapper.jar

@rem 执行 Gradle
"%JAVA_EXE%" %DEFAULT_JVM_OPTS% %JAVA_OPTS% %GRADLE_OPTS% "-Dorg.gradle.appname=%APP_BASE_NAME%" -classpath "%CLASSPATH%" org.gradle.wrapper.GradleWrapperMain %*

:end
@rem 结束 Windows NT shell 的局部变量范围
if %ERRORLEVEL% equ 0 goto mainEnd

:fail
rem 如果您需要 _script_ 返回代码而不是 _cmd.exe /c_ 返回代码，请设置变量 GRADLE_EXIT_CONSOLE！
set EXIT_CODE=%ERRORLEVEL%
if %EXIT_CODE% equ 0 set EXIT_CODE=1
if not ""=="%GRADLE_EXIT_CONSOLE%" exit %EXIT_CODE%
exit /b %EXIT_CODE%

:mainEnd
if "%OS%"=="Windows_NT" endlocal

:omega
