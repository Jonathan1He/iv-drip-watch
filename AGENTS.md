# iv-drip-watch 项目说明

这是一个无后端、纯浏览器本地运行的点滴状态辅助提醒器实验性 MVP。

- 默认中文界面；核心算法保持为可测试的 TypeScript 纯逻辑模块。
- 摄像头只读取当前 ROI 的 Canvas 像素，不上传、不保存、不录制视频。
- 不实现自动夹管、调速、诊断或治疗建议。
- 修改代码后运行 `npm run test`、`npm run typecheck`、`npm run build`。
- 先读 `README.md` 和 `docs/PROJECT_STRUCTURE.md`，再扩大修改范围。
