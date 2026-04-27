# MyRSS

一个极简的 RSS 阅读器，支持多源订阅、今日必看聚合、收藏夹和中英文界面切换。

![截图](screenshot.png)

## 技术栈

- **前端**: React 19 + TypeScript + Tailwind CSS 4 + Vite 6
- **后端**: Express（开发代理 / RSS API）
- **动画**: Motion
- **日期**: date-fns

## 本地运行

1. 安装依赖：

   ```bash
   npm install
   ```

2. 启动开发服务：

   ```bash
   npm run dev
   ```

3. 浏览器打开 `http://localhost:5173`

## 功能

- 订阅多个 RSS 源，一键增删
- 「今日必看」自动聚合所有订阅当天未读文章
- 收藏文章，跨会话保存
- 列表 / 网格 / 卡片三种布局切换
- 中英文界面切换
- 数据持久化到浏览器 localStorage

## 项目结构

```
src/
├── App.tsx       # 主应用组件
├── main.tsx      # 入口
└── index.css     # Tailwind + 全局样式
server.ts         # Express 开发服务（RSS 代理 API）
```

## 构建

```bash
npm run build   # Vite 生产构建 → dist/
npm run preview # 预览生产构建
```

## 协议

MIT
