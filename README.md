# My Password Manager

<div align="center">

![Version](https://img.shields.io/badge/version-0.1.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)
![Rust](https://img.shields.io/badge/rust-1.70+-orange)
![React](https://img.shields.io/badge/react-18.2.0-cyan)

一款基于 Tauri + React + Rust 构建的高级跨平台密码管理器，提供军事级加密与多重安全防护。

[功能特性](#功能特性) • [快速开始](#快速开始) • [安全机制](#安全机制) • [开发指南](#开发指南)

</div>

---

## 目录

- [项目简介](#项目简介)
- [功能特性](#功能特性)
- [技术栈](#技术栈)
- [系统架构](#系统架构)
- [快速开始](#快速开始)
- [使用说明](#使用说明)
- [安全机制](#安全机制)
- [常见问题](#常见问题)
- [路线图](#路线图)
- [许可证](#许可证)

---

## 项目简介

**My Password Manager** 是一款本地优先、安全至上的跨平台密码管理工具。它不仅能帮您有序地管理所有账号信息，更通过先进的加密算法确保您的数字资产在本地处于绝对的安全防护之下。

### 设计理念

- **绝对安全**：数据即一切。采用 Argon2id 与 ChaCha20-Poly1305 标准，拒绝任何安全妥协。
- **隐私优先**：不联网、不上传、无云端。您的数据只属于您的本地磁盘。
- **极致体验**：支持深色模式、自动锁屏、自定义分类，交互丝滑流畅。
- **专业架构**：Rust 后端保障内存与并发安全，React 前端提供现代化 UI。

---

## 功能特性

### 🔒 安全防护
- **军事级加密**：基于 **Argon2id** (KDF) 与 **ChaCha20-Poly1305** (AEAD) 的双重加密。
- **自动锁屏 (Auto-Lock)**：支持 1~60 分钟无操作自动锁定，防止物理接触风险（可配置）。
- **二次操作验证**：清除所有数据等高危操作强制要求输入主密码验证。
- **安全问题恢复**：通过预设的安全问题组在遗忘主密码时找回金库。
- **自定义弹窗**：全应用集成美化版二次确认弹窗，告别简陋的原生对话框。

### 🔑 密码管理
- **核心 CRUD**：创建、查看、编辑、删除密码。
- **分类管理**：自定义分类名称、图标与颜色主题。
- **收藏夹**：一键标记常用密码，快速触达。
- **回收站 (Trash)**：支持软删除，误删密码可随时找回。
- **模糊搜索**：支持按标题、用户名或 URL 实时过滤。

### 💾 数据与主题
- **灵活导入导出**：支持 JSON 与 CSV 格式的数据无损迁移。
- **外观定制**：支持 **深色 (Dark)**、**浅色 (Light)** 及 **系统跟随** 模式。
- **跨平台一致性**：在 Windows、macOS 和 Linux 上拥有近乎一致的视觉体验。

---

## 技术栈

### 前端 (Frontend)
- **Framework**: React 18 + Vite
- **Styling**: TailwindCSS (暗色模式优先)
- **State Management**: Zustand
- **Icons**: Lucide React

### 后端 (Backend)
- **Language**: Rust
- **Framework**: Tauri (Rust + WebView)
- **Database**: SQLite (via rusqlite)
- **Security**: 
  - `argon2`: 密码哈希与密钥派生
  - `chacha20poly1305`: 对称加密
  - `zeroize`: 敏感数据内存自动擦除

---

## 快速开始

### 环境依赖
- **Node.js**: 18.x 或更高版本
- **Rust**: 最新稳定版 (Rustup)
- **OS**: Windows 10/11, macOS, 或主流 Linux 发行版

### 安装与运行
```bash
# 1. 安装依赖
npm install

# 2. 启动开发环境
npm run tauri dev
```

### 构建安装包
```bash
# 生成对应平台的安装程序 (MSI, DMG, AppImage)
npm run tauri build
```

---

## 使用说明

### 1. 首次初始化
首次打开应用需设置**主密码**。请务必使用 12 位以上的强密码，并设置好 **Security Questions**，这是您找回数据的唯一凭证。

### 2. 自动锁屏配置
在“设置 -> 安全”页面中，您可以调整自动锁屏的时间间隔。如果您经常在公共场合使用，建议设置为 5 分钟。

### 3. 数据备份
应用所有数据均存储在本地：
- **Windows**: `%USERPROFILE%\.mypwd\vault.db`
- **Linux/macOS**: `~/.mypwd/vault.db`
建议定期通过“设置 -> 数据”功能导出 JSON 备份并存储在安全位置。

---

## 安全机制详述

### 1. 密钥分层
- **Master Key (主密钥)**：由主密码通过 Argon2id 派生，仅驻留在内存中。
- **Database Key (数据库密钥)**：随金库创建随机生成的 256 位密钥，使用 Master Key 加密后存储在数据库中。
- **Data Key (数据密钥)**：每次存储加密字段时结合随机 Nonce 进行 ChaCha20 加密。

### 2. 加密流程
1. 用户输入主密码 -> 派生主密钥。
2. 使用主密钥解密出数据库原始密钥。
3. 应用运行期间，所有密码字段均以二进制加密流形式存储在 SQLite 中。

---

## 常见问题 (FAQ)

**Q: 忘记主密码了怎么办？**
A: 在登录界面点击“忘记密码”，通过验证您预设的安全问题即可重置主密码。如果安全问题也忘记了，目前没有任何技术手段可以找回数据。

**Q: 数据会自动同步到云端吗？**
A: **不会。** 这是为了最大程度保护您的隐私。如需多设备使用，请手动迁移 `vault.db` 文件或使用导入导出功能。

---

## 许可证
本项目采用 [MIT License](LICENSE) 开源。
