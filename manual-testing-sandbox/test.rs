use std::io;

fn main() {
    println!("欢迎使用计算器!");

    loop {
        println!("请输入一个运算符 (+, -, *, /) 或 'q' 退出:");
        let operator = read_input();

        if operator == "q" {
            break;
        }

        println!("请输入第一个数字:");
        let num1 = read_input().parse::<f64>().unwrap();

        println!("请输入第二个数字:");
        let num2 = read_input().parse::<f64>().unwrap();

        let result = match operator.as_str() {
            "+" => num1 + num2,
            "-" => num1 - num2,
            "*" => num1 * num2,
            "/" => num1 / num2,
            _ => {
                println!("无效的运算符。请重试。");
                continue;
            }
        };

        println!("结果: {}", result);
    }
}

fn read_input() -> String {
    let mut input = String::new();
    io::stdin()
        .read_line(&mut input)
        .expect("读取输入失败");
    input.trim().to_string()
}
