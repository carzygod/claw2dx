# Live2D Overlay Extension for X.com

这是一个 Chrome 浏览器扩展，用于在 x.com 页面右下角显示 Live2D 模型，并可通过 WebSocket 接收外部指令进行控制。

## 目录结构 (Directory Structure)

```text
claw2dx/
├── manifest.json            # 扩展配置清单 (Manifest V3)
├── content.js               # 内容脚本：负责注入代码、维护 WebSocket 连接、消息桥接
├── init-live2d.js           # 核心逻辑：在页面上下文中运行，加载 Live2D 模型、处理指令队列
├── popup.html               # 扩展图标点击后的控制面板 UI
├── popup.js                 # 控制面板逻辑
├── models.json              # 模型配置与 Tag 映射文件
├── styles.css               # 样式文件
├── lib/                     # Live2D 核心库 (Cubism SDK)
│   └── live2d.min.js
├── dist/                    # Live2D 辅助库
│   └── live2d-helper.min.js
└── assets/                  # 资源目录
    ├── models/              # Live2D 模型文件 (.model.json 等)
    └── sound/               # 音效文件
```

## 程序架构 (Architecture)

本扩展主要由三个部分组成，通过消息机制进行通信：

1.  **Popup (控制面板)**
    *   用户界面，提供模型切换、动作触发等手动控制。
    *   设置并保存 WebSocket 服务器地址。
    *   通过 `chrome.tabs.sendMessage` 将指令发送给当前激活页面的 `content.js`。

2.  **Content Script (`content.js`)**
    *   **WebSocket 客户端**：读取存储配置，连接 WebSocket 服务器。
    *   **消息网关**：接收来自 WebSocket 的 JSON 数据，通过 `window.postMessage` 转发给页面内的 `init-live2d.js`。
    *   **注入器**：将 `init-live2d.js` 和 CSS 注入到 x.com 页面中。

3.  **Injected Script (`init-live2d.js`)**
    *   运行在网页的主上下文 (Main World) 中。
    *   **模型管理**：加载/卸载 Live2D 模型，管理 canvas。
    *   **指令队列**：实现了一个 robust 的指令队列系统。当模型正在切换或加载时，后续指令会被暂存，直到模型就绪后按顺序执行。
    *   **Tag 解析**：读取 `models.json`，支持将抽象指令 (如 `tag_5`) 解析为具体动作 (如 `shake:1`)。
    *   **防崩溃机制**：自动校验动作是否存在，绕过 Helper 封装直接操作底层模型，防止因参数错位导致的崩溃。

## 接口调用 (Interface & Usage)

### 1. WebSocket 连接
在扩展的 Popup 面板中输入 WebSocket 地址 (例如 `ws://localhost:8080`) 并保存。扩展会自动连接并在控制台输出连接状态。

### 2. 指令格式 (Payload Specification)
服务器发送给扩展的 WebSocket 消息必须是 JSON 格式。

**基本结构：**
```json
{
  "model": "Wanko",          // (可选) 切换模型名称，大小写敏感
  "motion": "tag_5",         // (可选) 动作指令 (Tag 或 Group:Index)
  "expression": "f01",       // (可选) 表情名称
  "message": "你好，世界！"    // (可选) 在气泡中显示的文本
}
```

### 3. motion 字段详解
`motion` 字段支持两种格式：

*   **具体动作 (Group:Index)**: 直接指定动作组和索引。
    *   例如：`idle:0`, `tap_body:1`, `shake:0`
    *   *注意：索引从 0 开始。*

*   **抽象标签 (Tag)**: 使用 `tag_N` 格式，由插件内部查找 `models.json` 自动解析。
    *   例如：`tag_5` -> (自动解析为) `shake:1`
    *   **推荐使用 Tag**，因为不同模型的动作组名称可能不同，使用 Tag 可以统一控制逻辑。

### 4. 示例场景

**场景 A：仅说话**
```json
{
  "message": "欢迎光临！"
}
```

**场景 B：切换模型并打招呼**
```json
{
  "model": "Shizuku",
  "motion": "tag_1",  // Shizuku 的 tag_1 可能是挥手
  "message": "我是 Shizuku 分队。"
}
```

**场景 C：连续动作 (由队列系统保证顺序)**
发送以下两条指令，即使用户在第一条指令执行时模型尚未加载完毕，第二条指令也会等待模型就绪后执行。
```json
// 指令 1
{ "model": "Wanko", "message": "变身！" }

// 指令 2
{ "motion": "tag_5", "message": "变身完成！" }
```

## 模型配置 (models.json)

`models.json` 定义了可用的模型及其 Tag 映射。

```json
[
    {
        "name": "Wanko",
        "path": "assets/models/wanko/wanko.model.json",
        "motions": {
            "tag_1": "idle:1",
            "tag_5": "shake:1"
        }
    },
    ...
]
```
Extension 会在启动时通过 fetch 加载此文件。

## 常见问题 (Troubleshooting)

*   **Invalid motion group**: 表示请求的动作在当前模型中不存在。请检查拼写或 `models.json` 映射。
*   **Cannot read properties of undefined (reading 'startMotion')**: 该错误已在最新版修复 (通过直接调用底层 Model 对象)。如果出现，请确保刷新页面应用最新代码。
