"""                    _________               _____ _____
                       __  ____/______ _______ __  /____(_)_______ ____  _______
                       _  /     _  __ \__  __ \_  __/__  / __  __ \_  / / /_  _ \
                       / /___   / /_/ /_  / / // /_  _  /  _  / / // /_/ / /  __/
                       \____/   \____/ /_/ /_/ \__/  /_/   /_/ /_/ \__,_/  \___/

                                 聊天、编辑和自动完成教程
"""

# ———————————————————— 聊天 [Cmd/Ctrl + L]: 询问“这是什么排序算法？” ————————————————————

def sorting_algorithm(x):
    for i in range(len(x)):
        for j in range(len(x) - 1):
            if x[j] > x[j + 1]:
                x[j], x[j + 1] = x[j + 1], x[j]
    return x

# —————————————————— 编辑 [Cmd/Ctrl + I]: 告诉 Continue “让这段代码更易读” —————————————————

def sorting_algorithm(x):
    for i in range(len(x)):
        for j in range(len(x) - 1):
            if x[j] > x[j + 1]:
                x[j], x[j + 1] = x[j]
    return x

# ——————————————— 自动完成 [Tab]: 将光标放在 `:` 后面并按 [Enter] —————————————————

# sorting_algorithm 的基本断言：


"—————————————————— 了解更多信息，请访问 https://docs.continue.dev/getting-started/overview ————————————————"
