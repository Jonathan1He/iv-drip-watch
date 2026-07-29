# 项目结构与调用链

## 目录用途

- `src/`：浏览器端 TypeScript、原生 UI 和样式。
- `src/camera/`：摄像头权限、视频流生命周期、ROI Canvas 采样。
- `src/detection/`：与 DOM 无关的帧差分、滴液状态机、滴速统计。
- `src/alarm/`：Web Audio 循环提示音和振动控制。
- `src/utils/`：localStorage 参数读写。
- `public/`：Vite 原样复制的 manifest、service worker 和图标占位。
- `tests/`：Vitest 纯逻辑自动化测试。
- `docs/`：实现、部署和测试说明。
- `docs/PRIOR_ART.md`：开源项目/研究参考、采用点和许可证边界。

## 主要文件

- `index.html`：页面入口、移动端 viewport、manifest 和图标链接。
- `src/main.ts`：UI 壳、应用状态、按钮事件、摄像头/模拟模式主循环和报警编排。
- `src/styles.css`：手机优先的单列布局、状态层级、报警视觉和高级参数折叠样式。
- `src/types.ts`：应用状态、ROI、用户参数和默认值类型。
- `src/camera/cameraManager.ts`：请求后置摄像头，映射错误，停止轨道，只采集 ROI 的 64×64 灰度数组。
- `src/detection/frameDifference.ts`：比较两帧并返回 0–1 活动分数。
- `src/detection/dropDetector.ts`：平滑、迟滞、事件时长限制、防重复计数；也根据校准分数生成阈值。
- `src/detection/dripRate.ts`：清理窗口外时间并用中位数间隔估算滴/分钟。
- `src/alarm/alarmManager.ts`：创建短促蜂鸣循环和振动循环，支持测试与停止。
- `src/utils/storage.ts`：校验、限幅和保存用户参数；存储失败不会阻止监测。
- `public/manifest.webmanifest`：PWA 名称、颜色、启动方式和图标。
- `public/sw.js`：只缓存静态壳，不缓存摄像头数据。
- `tests/*.test.ts`：三个核心纯逻辑模块的边界测试。

## 数据流

```text
摄像头视频 / 模拟活动分数
        ↓
ROI 归一化坐标
        ↓
Canvas 64×64 灰度数组
        ↓
前后帧像素差 → activityScore 0–1
        ↓
中位数/MAD 校准 + 平滑 + 高/低阈值迟滞 + 时长/防抖
        ↓
有效液滴时间戳
        ↓
60 秒窗口 + 间隔中位数 → 滴/分钟
        ↓
最后液滴时间 + 超时倒计时
        ↓
AlarmManager 声音/振动 + 页面报警状态
```

## 从画面到报警的主调用链

1. 用户点击 `开始监测`，`main.ts` 初始化 AudioContext，真实模式进入 5 秒校准，模拟模式使用默认背景基线。
2. `requestAnimationFrame` 调用 `processFrame`。
3. 真实模式由 `CameraManager.captureRoiGrayscale` 只读取 ROI；模拟模式由 `simulationScore` 生成同样范围的活动分数。
4. `calculateActivityScore` 与上一帧比较，结果进入校准数组或 `DropDetector.process`。
5. `DropDetector` 返回 `DropEvent` 后，`acceptDrop` 写入时间戳、累计总数并清除旧报警确认状态。
6. `render` 调用 `getRecentDropTimes` 和 `calculateDripRate`，更新滴速、最近一分钟滴数、倒计时和活动条。
7. `checkAlarm` 发现距最后有效液滴达到配置时长，切换 `alarming`，调用 `AlarmManager.start`；只有 `confirmAlarm` 才静音解除。

## 有意未单独拆出的部分

当前没有单独的 `appState.ts`、路由、组件层或后端服务。状态只有一个页面、一个监测循环，集中在 `main.ts` 更容易教学和排错；算法和外部副作用仍通过独立模块隔离。
