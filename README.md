# 🎄 AI Spatial Christmas Tree | AI 空间圣诞树

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6.svg)
![Three.js](https://img.shields.io/badge/Three.js-r160-black.svg)
![MediaPipe](https://img.shields.io/badge/MediaPipe-Vision-007E8A.svg)

> **"Where Holiday Magic Meets Computer Vision"**
> 
> 一个基于 WebGL 的沉浸式空间体验，融合了粒子系统与实时 AI 手势识别。通过摄像头捕捉你的手部动作，无需鼠标即可掌控这场数字光影秀。

---

## ✨ 核心特性 (Key Features)

### 1. 🎨 沉浸式 3D 视觉 (Immersive 3D Visuals)
- **粒子系统**：由超过 4,000 个动态粒子（包含几何体、光尘、程序化生成的糖果棒）组成的圣诞树。
- **后期处理**：集成了 `UnrealBloomPass` (虚幻泛光)，创造出梦幻、电影级的柔光效果。
- **PBR 材质**：使用了物理渲染材质（金属度、粗糙度），呈现金箔、红丝绒与光泽表面的质感。
- **程序化纹理**：通过 Canvas API 动态生成糖果棒纹理，无需外部贴图资源。

### 2. 🤖 实时 AI 交互 (Real-time AI Interaction)
- **无接触控制**：利用 Google MediaPipe 框架，在浏览器端实时（GPU加速）进行手部关键点检测。
- **3D 空间映射**：将手掌在摄像头画面的位置映射为 3D 场景的旋转角度（X/Y 轴）。
- **手势识别状态机**：
  - **✊ 握拳 (Fist)**：粒子聚合，重组为圣诞树形态。
  - **🖐️ 张开手掌 (Open Hand)**：粒子向宇宙爆发，进入散落模式。
  - **👌 捏合 (Pinch)**：聚焦模式，将照片拉近至镜头前。

### 3. 📸 个性化记忆 (Personalized Memories)
- **照片上传**：支持用户上传本地图片。
- **自动相框化**：上传的图片会自动包裹在金色的 3D 相框中，并随机悬挂在树的枝头。

---

## 🛠️ 技术栈 (Tech Stack)

*   **Runtime**: [Node.js](https://nodejs.org/)
*   **Language**: [TypeScript](https://www.typescriptlang.org/) (Strict Mode)
*   **Bundler**: [Vite](https://vitejs.dev/)
*   **3D Engine**: [Three.js](https://threejs.org/)
*   **Computer Vision**: [MediaPipe Tasks Vision](https://developers.google.com/mediapipe/solutions/vision/hand_landmarker)
*   **Styling**: CSS3 (Glassmorphism UI), Google Fonts (Cinzel)

---

## 🎮 交互指南 (Interaction Guide)

启动应用后，请允许浏览器访问摄像头。将手举起在摄像头范围内即可开始交互。

| 手势 (Gesture) | 动作 (Action) | 效果 (Effect) |
| :--- | :--- | :--- |
| **手掌移动** | **👋 移动手的位置** | **旋转视角**：场景会跟随你的手掌在 X/Y 轴上平滑旋转。 |
| **握拳** | **✊ 五指紧握** | **Tree Mode**：所有粒子回归中心，组成圣诞树形状。 |
| **张开** | **🖐️ 五指张开** | **Scatter Mode**：粒子向四周爆炸散开，形成星云效果。 |
| **捏合** | **👌 拇指与食指捏合** | **Focus Mode**：将场景中的照片推送到镜头最前方进行展示。 |

> **键盘快捷键**：按下 `H` 键可以隐藏/显示 UI 界面，享受纯净的视觉体验。

---

## 🚀 快速开始 (Getting Started)

### 环境要求
- Node.js v16+
- 支持 WebGL 的现代浏览器 (Chrome/Edge/Safari/Firefox)
- 摄像头 (用于 AI 交互)

### 安装与运行

1. **克隆项目**
   ```bash
   git clone https://github.com/your-username/christmas-tree-ai.git
   cd christmas-tree-ai
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **启动开发服务器**
   ```bash
   npm run dev
   ```
   打开终端显示的本地地址 (通常是 `http://localhost:5173`)。

4. **构建生产版本**
   ```bash
   npm run build
   ```

---

## 📂 项目结构 (Project Structure)

```text
christmas-tree-ai/
├── index.html          # 入口 HTML (UI, Loader, Canvas容器)
├── index.tsx           # 核心逻辑入口
│   ├── App Class       # 主程序控制器 (Three.js + MediaPipe 初始化)
│   ├── ParticleSystem  # 粒子系统与动画逻辑
│   └── Config/State    # 全局配置与状态管理
├── package.json        # 依赖管理
├── tsconfig.json       # TypeScript 配置
└── vite.config.ts      # Vite 构建配置
```

---

## 🧩 核心代码原理解析

### 粒子动画
粒子并不销毁，而是根据 `STATE.mode` 在不同的目标位置之间进行线性插值 (Lerp)。
- `posTree`: 基于圆锥螺旋算法计算的树形坐标。
- `posScatter`: 基于球坐标系随机生成的爆炸坐标。

### AI 手势映射
我们使用 MediaPipe 返回的 `HandLandmarkerResult`：
```typescript
// 归一化坐标转换
STATE.targetRotation.y = (palm.x - 0.5) * 2.0; 
STATE.targetRotation.x = (palm.y - 0.5) * 1.0;
```
通过计算拇指指尖与食指指尖的欧几里得距离来判断是否为"捏合 (Pinch)"手势。

---

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

Made with ❤️ and code for the Holidays.
