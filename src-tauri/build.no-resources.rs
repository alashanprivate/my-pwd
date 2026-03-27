// 禁用资源编译的 build.rs

fn main() {
    // 不调用 tauri_build::build()，因为它会尝试处理资源
    // 我们手动编译项目
}
