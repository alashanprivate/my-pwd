# MSVC 环境变量配置指南

## 自动检测到的路径

基于你的系统，以下路径已确认：

### Visual Studio 2022
- 安装路径：`C:\Program Files\Microsoft Visual Studio\18\Community`
- MSVC 版本：`14.50.35717`

### Windows SDK
- SDK 版本：`10.0.26100.0`
- 基础路径：`C:\Program Files (x86)\Windows Kits\10`

## 方法 1: 永久配置系统环境变量

### 步骤 1: 打开环境变量设置
1. 右键点击"此电脑" → "属性"
2. 点击"高级系统设置"
3. 点击"环境变量"按钮

### 步骤 2: 新建/编辑以下环境变量

在"系统变量"区域，新建或编辑以下变量：

#### 变量 1: INCLUDE
**变量名**: `INCLUDE`
**变量值**（全部粘贴在一起，用分号分隔）:
```
C:\Program Files\Microsoft Visual Studio\18\Community\VC\Tools\MSVC\14.50.35717\include;C:\Program Files (x86)\Windows Kits\10\Include\10.0.26100.0\ucrt;C:\Program Files (x86)\Windows Kits\10\Include\10.0.26100.0\shared;C:\Program Files (x86)\Windows Kits\10\Include\10.0.26100.0\um;C:\Program Files (x86)\Windows Kits\10\Include\10.0.26100.0\winrt
```

#### 变量 2: LIB
**变量名**: `LIB`
**变量值**:
```
C:\Program Files\Microsoft Visual Studio\18\Community\VC\Tools\MSVC\14.50.35717\lib\x64;C:\Program Files (x86)\Windows Kits\10\Lib\10.0.26100.0\ucrt\x64;C:\Program Files (x86)\Windows Kits\10\Lib\10.0.26100.0\um\x64
```

#### 变量 3: PATH
**变量名**: `PATH` (编辑现有变量，不要新建）
**操作**: 将以下路径添加到 PATH 的**最前面**:
```
C:\Program Files\Microsoft Visual Studio\18\Community\VC\Tools\MSVC\14.50.35717\bin\Hostx64\x64;C:\Program Files (x86)\Windows Kits\10\bin\10.0.26100.0\x64;
```

### 步骤 3: 验证配置
1. **关闭所有终端窗口**（重要！）
2. **重新打开 PowerShell 或 cmd**
3. **执行验证命令**:
   ```cmd
   where cl.exe
   where link.exe
   ```

如果看到类似这样的输出，说明配置成功：
```
C:\Program Files\Microsoft Visual Studio\18\Community\VC\Tools\MSVC\14.50.35717\bin\Hostx64\x64\cl.exe
C:\Program Files\Microsoft Visual Studio\18\Community\VC\Tools\MSVC\14.50.35717\bin\Hostx64\x64\link.exe
```

### 步骤 4: 构建项目
```cmd
cd C:\lh\projects\claw\my-pwd
npm run tauri build
```

---

## 方法 2: 使用 Developer Command Prompt（最简单）

**不需要配置环境变量**，直接使用 Visual Studio 提供的命令提示符。

### 步骤:
1. 打开"开始菜单"
2. 搜索：`x64 Native Tools Command Prompt for VS 2022`
   - 或：`Developer Command Prompt for VS 2022`
3. 右键 → "以管理员身份运行"
4. 执行：
   ```cmd
   cd C:\lh\projects\claw\my-pwd
   npm run tauri build
   ```

---

## 方法 3: 使用自动构建脚本（推荐）

项目根目录下已创建两个自动构建脚本：

### auto-build.bat（批处理）
- 双击即可运行
- 自动加载 MSVC 环境变量
- 自动执行构建

### auto-build.ps1（PowerShell）
- 右键 → "使用 PowerShell 运行"
- 自动加载环境变量
- 自动执行构建

---

## 常见问题

### Q1: 配置后仍然提示 link.exe not found
**A**: 请确保：
1. 关闭所有终端窗口
2. 重新打开终端
3. 验证 `where link.exe` 是否返回路径

### Q2: Windows SDK 版本号不对
**A**: 上述指南使用的是自动检测到的版本 10.0.26100.0。如果你的系统不同，请运行以下命令查找：
```powershell
Get-ChildItem "C:\Program Files (x86)\Windows Kits\10\Include" -Directory | Select-Object -ExpandProperty Name
```

### Q3: 不想永久修改系统环境变量
**A**: 使用方法 2（Developer Command Prompt）或方法 3（自动构建脚本）。

---

## 快速开始（推荐）

**最简单的方法**：

1. 双击 `C:\lh\projects\claw\my-pwd\auto-build.bat`
2. 等待构建完成（5-15 分钟）
3. 完成后，可执行文件在：
   ```
   C:\lh\projects\claw\my-pwd\src-tauri\target\release\my-pwd.exe
   ```

就这么简单！
