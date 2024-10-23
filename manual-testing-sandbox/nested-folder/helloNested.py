from typing import List

# 定义一个向量类型，表示浮点数列表
Vector = List[float]


# 主函数，接受一个向量作为参数
def main(a: Vector):
    print("Hello Nested!")  # 打印信息


class MyClass:
    # 测试函数，返回传入的向量
    def test(a: Vector) -> Vector:
        return a


# 抛出一个异常
raise Exception("This is an error")
