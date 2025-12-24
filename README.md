
# 🎄 AI Spatial Christmas Tree with Neon Sync

## 🚀 如何配置 Neon 数据库 (填坑指南)

### 第一步：获取连接字符串
在 [Neon.tech](https://neon.tech) 控制台的 **Dashboard** 页面，找到 **Connection String**。
格式通常如下：`postgres://alex:abcd-1234@ep-cool-darkness-123456.us-east-2.aws.neon.tech/neondb?sslmode=require`

### 第二步：在 Vercel 中填写
1. 进入 [Vercel Project Settings](https://vercel.com)。
2. 点击左侧导航栏的 **Environment Variables**。
3. 添加变量：
   - **Key**: `POSTGRES_URL`
   - **Value**: 粘贴第一步获取的字符串。
4. **重要**：点击 "Save" 后，去 "Deployments" 页面选择最近的一次部署，点击右侧三个点选择 **Redeploy**，这样新变量才会生效。

### 第三步：本地开发 (可选)
在根目录创建 `.env.local` 文件并填写相同内容：
```env
POSTGRES_URL=你的连接字符串
```

---

## 🛠️ 后端逻辑
该应用使用 `/api/memories.ts` 作为中转站：
- **前端** (`index.tsx`) -> 发送请求到 `/api/memories`
- **后端** (`api/memories.ts`) -> 从 `process.env` 读取密钥 -> 操作 **Neon DB**
- **安全性**：这样您的数据库密钥永远不会暴露在浏览器端。
