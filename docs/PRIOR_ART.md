# 开源参考与采用边界

检索日期：2026-07-29。

本项目没有复制第三方源代码，也没有引入第三方视觉、云端或硬件依赖。下面记录的是可以借鉴的工程思想，以及它们如何被压缩成符合本项目边界的浏览器 MVP。

## 参考项目与研究

| 参考 | 有用部分 | 本项目的采用方式 | 明确不采用 |
| --- | --- | --- | --- |
| [DripOMeter](https://pmc.ncbi.nlm.nih.gov/articles/PMC9418544/) | 将滴斗监测拆成采集、滴数/滴速计算和报警闭环；其硬件与固件设计文件按 CERN-OHL-W 记录 | 保留“先建立正常背景，再检测有效事件，最后报警”的闭环；浏览器端使用 Canvas 帧差代替光电传感器 | LED/LDR、Arduino、PCB、3D 外壳和硬件控制 |
| [Deep Learning-Based Computer Vision for IV Drip Monitoring](https://arxiv.org/abs/2011.10839) | 用“液滴形成阶段之间的状态变化”计数，而不是把单帧变化直接当成一滴 | `DropDetector` 使用高阈值开始、低阈值结束、事件持续时间和防抖，保留两阶段事件思想 | 深度学习模型、训练数据和模型推理服务 |
| [Smart IV](https://github.com/cepdnaclk/e21-3yp-Smart-IV) | 展示了实时滴速、报警、设备状态和测试流程需要组成一个完整监测界面 | 当前页面提供状态、滴速、最后液滴、倒计时、测试报警、模拟模式和手动确认 | AWS/IoT、移动端后端、步进电机、自动调节或夹闭管路 |
| [IV Drip Fluid-Level Monitoring](https://docs.edgeimpulse.com/projects/expert-network/iv-drip-fluid-level-monitoring-arduino-portenta-h7) | 说明液位识别和滴落事件识别是两个不同问题，不能混用验收指标 | 当前 MVP 只声明检测局部活动和停滴提醒，不声称识别输液袋剩余液量 | Edge Impulse、Portenta 硬件和训练模型 |

## 已落地的参考点

### 1. 背景校准与抗离群

真实监测开始后先采集约 5 秒正常背景。`deriveThresholds` 使用背景分数的中位数和 MAD（median absolute deviation）估计噪声，再加上灵敏度相关的安全余量。这样一次手机晃动不会把高阈值抬到无法识别液滴，但持续的背景噪声仍会提高阈值。

对应代码：`src/detection/dropDetector.ts`、`tests/dropDetector.test.ts`。

### 2. 两阶段事件，而不是单帧触发

活动分数越过高阈值只会进入候选状态；分数回落到低阈值以下后，系统才根据 30–1000 毫秒的候选持续时间和 500 毫秒防抖决定是否记为一滴。这一层是减少闪烁、反光和持续移动误检的关键。

对应代码：`DropDetector.process`。

### 3. 滑动窗口与稳健滴速

滴速不使用最后两个事件的单一间隔，而是在 60 秒窗口中取有效事件的间隔中位数。偶发漏检或误检不会立即把结果拉到极端值。

对应代码：`src/detection/dripRate.ts`。

### 4. 报警确认和模拟验证

报警声音/振动由用户点击开始监测时初始化；报警触发后必须点击“确认并静音”，模拟模式则复用真实模式的事件、滴速和报警链路，方便没有滴斗或摄像头时验证流程。

对应代码：`src/alarm/alarmManager.ts`、`src/main.ts`。

## 复用规则

- 可以继续参考算法结构、测试方法、校准思想和界面状态设计。
- 任何真正复制的第三方代码、硬件图纸或模型权重，都必须先核对仓库许可证和再分发条件；当前版本没有复制它们。
- 本项目的安全边界优先于参考项目的功能范围：不上传视频、不调用云端 AI、不接触输液管路、不自动调节滴速。
