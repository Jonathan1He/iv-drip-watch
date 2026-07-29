import { AlarmManager } from './alarm/alarmManager';
import { CameraError, CameraManager } from './camera/cameraManager';
import {
  calculateActivityScore,
  DEFAULT_FRAME_DIFFERENCE_OPTIONS,
} from './detection/frameDifference';
import {
  DEFAULT_DETECTOR_CONFIG,
  deriveThresholds,
  DropDetector,
  type DropDetectorConfig,
} from './detection/dropDetector';
import { calculateDripRate, getRecentDropTimes } from './detection/dripRate';
import { type AppStatus, type Roi, type UserSettings } from './types';
import { loadSettings, saveSettings } from './utils/storage';
import './styles.css';

const appRoot = document.querySelector<HTMLElement>('#app');
if (!appRoot) throw new Error('App root is missing');
const root: HTMLElement = appRoot;

root.innerHTML = `
  <div class='app-shell'>
    <header class='app-header'>
      <div>
        <p class='eyebrow'>LOCAL MVP · CAMERA ASSIST</p>
        <h1>点滴状态辅助提醒器</h1>
        <p class='subtitle'>只在本机浏览器分析滴斗画面，不上传或录制视频。</p>
      </div>
      <span class='mode-pill' id='mode-pill'>摄像头模式</span>
    </header>

    <section class='safety-banner' aria-label='安全声明'>
      <strong>安全提醒</strong>
      <p>本工具仅为实验性辅助提醒原型，不是医疗器械，不能替代医护人员巡视、诊断或处置。停滴可能由输液结束、管路折叠、堵塞、针头异常、人工暂停等多种原因造成。报警后应立即联系医护人员，不要自行调整针头或输液装置。</p>
    </section>

    <section class='panel video-panel'>
      <div class='section-heading'>
        <div>
          <p class='eyebrow'>STEP 01</p>
          <h2>固定画面</h2>
        </div>
        <span class='small-note'>不录制 · 不上传</span>
      </div>
      <div class='video-stage' id='video-stage'>
        <video id='camera-video' autoplay muted playsinline></video>
        <canvas id='analysis-canvas' class='hidden' aria-hidden='true'></canvas>
        <div class='video-placeholder' id='video-placeholder'>
          <span class='placeholder-icon'>◉</span>
          <strong>先打开摄像头，或进入模拟模式</strong>
          <span>把滴斗放在画面中央，保持手机稳定。</span>
        </div>
        <div class='roi-frame' id='roi-frame'><span>检测区域</span></div>
      </div>
      <p class='helper-text'>检测框只覆盖液滴经过的狭窄区域，避开手、输液架和复杂背景。滴斗后方尽量使用纯色或高对比背景。</p>
      <div class='button-row button-row-main'>
        <button class='button button-primary' id='open-camera'>打开摄像头</button>
        <button class='button button-secondary' id='enter-simulation'>进入模拟模式</button>
      </div>
      <p class='inline-notice hidden' id='page-warning' role='status'></p>
    </section>

    <section class='panel state-panel'>
      <div class='status-line'>
        <div class='status-label'><span class='status-dot' id='status-dot'></span><strong id='status-text'>未开始</strong></div>
        <span class='status-detail' id='status-detail'>等待打开摄像头</span>
      </div>
      <div class='metric-grid'>
        <div class='metric-card metric-card-primary'><span>估计滴速</span><strong id='drip-rate'>—</strong><small>滴 / 分钟</small></div>
        <div class='metric-card'><span>最近一分钟</span><strong id='recent-drops'>0</strong><small>滴</small></div>
        <div class='metric-card'><span>最近一次液滴</span><strong class='metric-time' id='last-drop'>—</strong><small>本地时间</small></div>
        <div class='metric-card'><span>停滴倒计时</span><strong id='alarm-countdown'>—</strong><small>秒</small></div>
      </div>
      <div class='activity-block'>
        <div class='activity-header'><span>当前活动强度</span><strong id='activity-score'>0.000</strong></div>
        <div class='activity-track'><div class='activity-fill' id='activity-fill'></div></div>
        <div class='threshold-row'><span>检测高阈值 <strong id='threshold-value'>0.000</strong></span><span>总滴数 <strong id='total-drops'>0</strong></span></div>
      </div>
      <div class='calibration-block'>
        <div class='activity-header'><span id='calibration-label'>尚未校准</span><strong id='calibration-percent'>0%</strong></div>
        <div class='activity-track calibration-track'><div class='activity-fill calibration-fill' id='calibration-fill'></div></div>
      </div>
    </section>

    <section class='panel control-panel'>
      <div class='section-heading'>
        <div><p class='eyebrow'>STEP 02</p><h2>监测控制</h2></div>
        <span class='small-note'>开始时校准约 5 秒</span>
      </div>
      <div class='button-grid'>
        <button class='button button-primary button-large' id='start-monitoring'>开始监测</button>
        <button class='button button-secondary' id='pause-monitoring'>暂停</button>
        <button class='button button-secondary' id='stop-monitoring'>停止</button>
        <button class='button button-secondary' id='recalibrate'>重新校准</button>
      </div>
      <div class='button-row alarm-actions'>
        <button class='button button-warning' id='test-alarm'>测试报警</button>
        <button class='button button-danger hidden' id='ack-alarm'>确认并静音</button>
        <button class='button button-quiet' id='reset-stats'>重置统计</button>
      </div>
    </section>

    <section class='panel simulation-panel hidden' id='simulation-panel'>
      <div class='section-heading'><div><p class='eyebrow'>SAFE TEST MODE</p><h2>模拟模式</h2></div><span class='small-note'>不调用摄像头</span></div>
      <p class='helper-text'>模拟模式使用与摄像头相同的状态机、滴速和报警逻辑。先点击“开始监测”，再手动模拟一滴或选择固定滴速。</p>
      <div class='button-grid simulation-buttons'>
        <button class='button button-primary' id='simulate-drop'>模拟一滴</button>
        <button class='button button-secondary' data-rate='10'>自动 10 滴/分</button>
        <button class='button button-secondary' data-rate='20'>自动 20 滴/分</button>
        <button class='button button-secondary' data-rate='30'>自动 30 滴/分</button>
      </div>
      <button class='button button-quiet full-width' id='stop-simulation'>停止自动模拟</button>
      <p class='sim-status' id='simulation-status'>当前未开始模拟。</p>
    </section>

    <details class='panel settings-panel'>
      <summary>高级参数与检测区域</summary>
      <div class='settings-content'>
        <label class='range-label' for='sensitivity'><span>灵敏度</span><output id='sensitivity-value'>55%</output></label>
        <input id='sensitivity' type='range' min='0' max='100' step='1' />
        <p class='range-hint'>灵敏度越高，越容易响应画面变化，也更容易受到反光和晃动干扰。</p>
        <label class='range-label' for='alert-timeout'><span>无液滴报警时间</span><output id='alert-timeout-value'>45 秒</output></label>
        <input id='alert-timeout' type='range' min='15' max='180' step='1' />
        <div class='roi-controls'>
          <span class='subheading'>ROI 检测框（归一化范围）</span>
          <label class='range-label' for='roi-x'><span>水平位置 X</span><output id='roi-x-value'>25%</output></label><input id='roi-x' type='range' min='0' max='90' step='1' />
          <label class='range-label' for='roi-y'><span>垂直位置 Y</span><output id='roi-y-value'>20%</output></label><input id='roi-y' type='range' min='0' max='90' step='1' />
          <label class='range-label' for='roi-width'><span>宽度</span><output id='roi-width-value'>50%</output></label><input id='roi-width' type='range' min='10' max='90' step='1' />
          <label class='range-label' for='roi-height'><span>高度</span><output id='roi-height-value'>60%</output></label><input id='roi-height' type='range' min='10' max='90' step='1' />
        </div>
        <label class='check-label'><input id='vibration-enabled' type='checkbox' /><span>启用振动</span></label>
        <label class='check-label'><input id='sound-enabled' type='checkbox' /><span>启用声音</span></label>
      </div>
    </details>

    <section class='panel guide-panel'>
      <div class='section-heading'><div><p class='eyebrow'>QUICK GUIDE</p><h2>使用提示</h2></div></div>
      <ol class='guide-list'>
        <li>稳定固定手机，避免手持晃动。</li>
        <li>将滴斗放在检测框内，框只覆盖液滴经过区域。</li>
        <li>尽量使用纯色背景，避开闪烁灯光、反光和人员走动。</li>
        <li>点击“测试报警”，确认手机声音和振动可用。</li>
        <li>本工具只能辅助提醒，不能代替医护观察。</li>
      </ol>
    </section>

    <footer class='disclaimer'>实验性辅助原型 · 不提供医疗诊断或治疗建议 · 报警后立即联系医护人员</footer>
  </div>
`;

const $ = <T extends Element>(selector: string): T => {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Missing UI element: ${selector}`);
  return element;
};

const video = $<HTMLVideoElement>('#camera-video');
const camera = new CameraManager(video);
const alarm = new AlarmManager();
let settings: UserSettings = loadSettings();
let status: AppStatus = 'idle';
let simulationMode = false;
let monitoring = false;
let calibrationStartedAt: number | null = null;
let calibrationScores: number[] = [];
let baselineScores: number[] = [];
let detectorConfig: DropDetectorConfig = { ...DEFAULT_DETECTOR_CONFIG };
let detector = new DropDetector(detectorConfig);
let previousFrame: Uint8ClampedArray | null = null;
let activityScore = 0;
let dropTimes: number[] = [];
let totalDrops = 0;
let lastDropAt: number | null = null;
let alarmAcknowledged = false;
let simulationRate = 20;
let simulationPulseUntil = 0;
let nextSimulationDropAt = 0;
let frameLoopId: number | null = null;
let wakeLock: { release: () => Promise<void> } | null = null;
let pageWarning = '';
let lastRenderAt = 0;

const statusText = $<HTMLElement>('#status-text');
const statusDetail = $<HTMLElement>('#status-detail');
const statusDot = $<HTMLElement>('#status-dot');
const videoPlaceholder = $<HTMLElement>('#video-placeholder');
const pageWarningElement = $<HTMLElement>('#page-warning');
const modePill = $<HTMLElement>('#mode-pill');
const roiFrame = $<HTMLElement>('#roi-frame');
const activityFill = $<HTMLElement>('#activity-fill');
const calibrationFill = $<HTMLElement>('#calibration-fill');
const ackAlarmButton = $<HTMLButtonElement>('#ack-alarm');
const simulationPanel = $<HTMLElement>('#simulation-panel');
const simulationStatus = $<HTMLElement>('#simulation-status');
const startButton = $<HTMLButtonElement>('#start-monitoring');
const pauseButton = $<HTMLButtonElement>('#pause-monitoring');
const stopButton = $<HTMLButtonElement>('#stop-monitoring');
const recalibrateButton = $<HTMLButtonElement>('#recalibrate');
const openCameraButton = $<HTMLButtonElement>('#open-camera');

const roiInputs = {
  x: $<HTMLInputElement>('#roi-x'),
  y: $<HTMLInputElement>('#roi-y'),
  width: $<HTMLInputElement>('#roi-width'),
  height: $<HTMLInputElement>('#roi-height'),
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function currentRoi(): Roi {
  const width = clamp(Number(roiInputs.width.value) / 100, 0.1, 0.9);
  const height = clamp(Number(roiInputs.height.value) / 100, 0.1, 0.9);
  return {
    width,
    height,
    x: clamp(Number(roiInputs.x.value) / 100, 0, 1 - width),
    y: clamp(Number(roiInputs.y.value) / 100, 0, 1 - height),
  };
}

function syncSettingsToControls(): void {
  $<HTMLInputElement>('#sensitivity').value = String(Math.round(settings.sensitivity * 100));
  $<HTMLInputElement>('#alert-timeout').value = String(settings.alertTimeoutSec);
  $<HTMLInputElement>('#vibration-enabled').checked = settings.vibrationEnabled;
  $<HTMLInputElement>('#sound-enabled').checked = settings.soundEnabled;
  roiInputs.x.value = String(Math.round(settings.roi.x * 100));
  roiInputs.y.value = String(Math.round(settings.roi.y * 100));
  roiInputs.width.value = String(Math.round(settings.roi.width * 100));
  roiInputs.height.value = String(Math.round(settings.roi.height * 100));
}

function setThresholds(): void {
  const thresholds = deriveThresholds(baselineScores, settings.sensitivity);
  detectorConfig = { ...DEFAULT_DETECTOR_CONFIG, ...thresholds };
  detector = new DropDetector(detectorConfig);
}

function statusLabel(): string {
  if (simulationMode && status === 'monitoring') return '监测中 · 模拟';
  return {
    idle: '未开始',
    'camera-ready': simulationMode ? '模拟模式已就绪' : '摄像头已就绪',
    calibrating: '校准中',
    monitoring: '监测中',
    paused: '已暂停',
    alarming: '报警中',
    'camera-error': '摄像头错误',
  }[status];
}

function formatClock(timestamp: number | null): string {
  if (timestamp === null) return '—';
  return new Date(timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function render(now = Date.now()): void {
  const recentTimes = getRecentDropTimes(dropTimes, now);
  const rate = calculateDripRate(dropTimes, now);
  const remaining =
    lastDropAt === null
      ? null
      : Math.max(0, settings.alertTimeoutSec - (now - lastDropAt) / 1000);
  const calibrationProgress =
    status === 'calibrating' && calibrationStartedAt !== null
      ? clamp((now - calibrationStartedAt) / 5_000, 0, 1)
      : status === 'monitoring' || status === 'alarming'
        ? 1
        : 0;

  root.dataset.status = status;
  statusText.textContent = statusLabel();
  statusDetail.textContent =
    status === 'alarming'
      ? '请立即联系医护人员，不要自行调整装置'
      : status === 'calibrating'
        ? '请保持手机和滴斗稳定，暂不统计滴速'
        : status === 'monitoring'
          ? '正在分析检测框内的局部画面'
          : status === 'paused'
            ? '监测已暂停，恢复前请重新确认画面'
            : status === 'camera-error'
              ? '请检查权限、HTTPS 或摄像头占用情况'
              : simulationMode
                ? '模拟模式不打开摄像头'
                : '等待打开摄像头';
  statusDot.className = `status-dot status-${status}`;
  modePill.textContent = simulationMode ? '模拟模式' : '摄像头模式';
  videoPlaceholder.classList.toggle('hidden', camera.isOpen() || simulationMode);
  videoPlaceholder.querySelector('strong')!.textContent = simulationMode
    ? '模拟模式已启用'
    : '先打开摄像头，或进入模拟模式';
  videoPlaceholder.querySelector('span:last-child')!.textContent = simulationMode
    ? '不会请求摄像头权限，点击开始监测即可测试。'
    : '把滴斗放在画面中央，保持手机稳定。';
  roiFrame.style.left = `${settings.roi.x * 100}%`;
  roiFrame.style.top = `${settings.roi.y * 100}%`;
  roiFrame.style.width = `${settings.roi.width * 100}%`;
  roiFrame.style.height = `${settings.roi.height * 100}%`;
  roiFrame.classList.toggle('hidden', status === 'idle' && !simulationMode && !camera.isOpen());

  $<HTMLElement>('#drip-rate').textContent = rate === null ? '—' : rate.toFixed(1);
  $<HTMLElement>('#recent-drops').textContent = String(recentTimes.length);
  $<HTMLElement>('#last-drop').textContent = formatClock(lastDropAt);
  $<HTMLElement>('#alarm-countdown').textContent =
    status === 'calibrating' ? '校准中' : remaining === null ? '—' : String(Math.ceil(remaining));
  $<HTMLElement>('#activity-score').textContent = activityScore.toFixed(3);
  $<HTMLElement>('#threshold-value').textContent = detectorConfig.highThreshold.toFixed(3);
  $<HTMLElement>('#total-drops').textContent = String(totalDrops);
  activityFill.style.width = `${clamp(activityScore, 0, 1) * 100}%`;
  calibrationFill.style.width = `${calibrationProgress * 100}%`;
  $<HTMLElement>('#calibration-percent').textContent = `${Math.round(calibrationProgress * 100)}%`;
  $<HTMLElement>('#calibration-label').textContent =
    status === 'calibrating' ? '正在读取正常背景' : calibrationProgress > 0 ? '校准完成，可开始观察' : '尚未校准';
  $<HTMLElement>('#sensitivity-value').textContent = `${Math.round(settings.sensitivity * 100)}%`;
  $<HTMLElement>('#alert-timeout-value').textContent = `${settings.alertTimeoutSec} 秒`;
  $<HTMLElement>('#roi-x-value').textContent = `${Math.round(settings.roi.x * 100)}%`;
  $<HTMLElement>('#roi-y-value').textContent = `${Math.round(settings.roi.y * 100)}%`;
  $<HTMLElement>('#roi-width-value').textContent = `${Math.round(settings.roi.width * 100)}%`;
  $<HTMLElement>('#roi-height-value').textContent = `${Math.round(settings.roi.height * 100)}%`;

  pageWarningElement.textContent = pageWarning;
  pageWarningElement.classList.toggle('hidden', !pageWarning);
  ackAlarmButton.classList.toggle('hidden', status !== 'alarming');
  simulationPanel.classList.toggle('hidden', !simulationMode);
  simulationStatus.textContent = simulationRate > 0
    ? `固定滴速：${simulationRate} 滴/分钟。可点击“模拟一滴”插入一次活动。`
    : '自动模拟已停止，可手动模拟一滴。';
  startButton.disabled =
    (!simulationMode && !camera.isOpen()) || monitoring || status === 'alarming';
  pauseButton.disabled = !monitoring || status === 'alarming';
  stopButton.disabled = status === 'idle';
  recalibrateButton.disabled = simulationMode ? !monitoring : !camera.isOpen();
  openCameraButton.textContent = camera.isOpen() ? '摄像头已打开' : '打开摄像头';
  openCameraButton.disabled = camera.isOpen() && !simulationMode;
}

function releaseWakeLock(): void {
  if (!wakeLock) return;
  void wakeLock.release().catch(() => undefined);
  wakeLock = null;
}

async function requestWakeLock(): Promise<void> {
  const candidate = navigator as Navigator & {
    wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> };
  };
  if (!candidate.wakeLock || document.hidden) return;
  try {
    wakeLock = await candidate.wakeLock.request('screen');
  } catch {
    pageWarning = '屏幕常亮权限未获得；监测期间请留意屏幕可能自动休眠。';
  }
}

function stopLoop(): void {
  if (frameLoopId !== null) window.cancelAnimationFrame(frameLoopId);
  frameLoopId = null;
}

function scheduleLoop(): void {
  if (monitoring && frameLoopId === null) frameLoopId = window.requestAnimationFrame(processFrame);
}

function acceptDrop(timestamp: number): void {
  dropTimes.push(timestamp);
  totalDrops += 1;
  lastDropAt = timestamp;
  alarmAcknowledged = false;
}

function checkAlarm(now: number): void {
  if (
    status === 'monitoring' &&
    lastDropAt !== null &&
    !alarmAcknowledged &&
    now - lastDropAt >= settings.alertTimeoutSec * 1_000
  ) {
    status = 'alarming';
    alarm.start({ soundEnabled: settings.soundEnabled, vibrationEnabled: settings.vibrationEnabled });
    pageWarning = '已连续超过设定时间没有有效液滴事件。请立即联系医护人员。';
  }
}

function simulationScore(now: number): number {
  if (simulationRate > 0 && now >= nextSimulationDropAt && now >= simulationPulseUntil) {
    simulationPulseUntil = now + 320;
    nextSimulationDropAt = now + 60_000 / simulationRate;
  }
  return now < simulationPulseUntil ? Math.min(1, detectorConfig.highThreshold + 0.45) : 0.005;
}

function processFrame(): void {
  frameLoopId = null;
  if (!monitoring) return;
  const now = Date.now();
  try {
    if (simulationMode) {
      activityScore = simulationScore(now);
    } else {
      const canvas = $<HTMLCanvasElement>('#analysis-canvas');
      const currentFrame = camera.captureRoiGrayscale(canvas, settings.roi);
      activityScore = previousFrame
        ? calculateActivityScore(currentFrame, previousFrame, DEFAULT_FRAME_DIFFERENCE_OPTIONS)
        : 0;
      previousFrame = currentFrame;
    }

    if (status === 'calibrating') {
      calibrationScores.push(activityScore);
      if (calibrationStartedAt !== null && now - calibrationStartedAt >= 5_000) {
        baselineScores = calibrationScores.slice();
        setThresholds();
        calibrationStartedAt = null;
        calibrationScores = [];
        previousFrame = null;
        status = 'monitoring';
        pageWarning = '校准完成；若背景变化明显，请调小 ROI 或降低灵敏度。';
      }
    } else if (status === 'monitoring' || status === 'alarming') {
      const event = detector.process(activityScore, now);
      if (event) acceptDrop(event.timestamp);
      checkAlarm(now);
    }
  } catch (error) {
    if (error instanceof CameraError) {
      monitoring = false;
      status = 'camera-error';
      pageWarning = error.message;
      alarm.stop();
      releaseWakeLock();
    } else {
      pageWarning = '画面分析暂时失败，请检查检测区域并重试。';
    }
  }

  if (now - lastRenderAt >= 100) {
    render(now);
    lastRenderAt = now;
  }
  scheduleLoop();
}

async function openCamera(): Promise<void> {
  if (monitoring) stopMonitoring();
  simulationMode = false;
  try {
    await camera.open();
    status = 'camera-ready';
    pageWarning = '';
  } catch (error) {
    status = 'camera-error';
    pageWarning = error instanceof CameraError ? error.message : '摄像头启动失败，请重试。';
  }
  render();
}

function enterSimulation(): void {
  if (monitoring) stopMonitoring();
  camera.stop();
  simulationMode = true;
  status = 'camera-ready';
  baselineScores = [0.004, 0.005, 0.006, 0.004];
  setThresholds();
  nextSimulationDropAt = Date.now() + 60_000 / simulationRate;
  pageWarning = '模拟模式不会打开摄像头，所有事件仍使用同一套滴液检测和报警逻辑。';
  render();
}

async function startMonitoring(): Promise<void> {
  if ((!simulationMode && !camera.isOpen()) || monitoring) return;
  await alarm.initialize();
  monitoring = true;
  alarmAcknowledged = false;
  previousFrame = null;
  detector.reset();
  activityScore = 0;
  pageWarning = '';
  if (simulationMode) {
    setThresholds();
    status = 'monitoring';
    nextSimulationDropAt = Date.now() + 60_000 / simulationRate;
  } else {
    status = 'calibrating';
    calibrationStartedAt = Date.now();
    calibrationScores = [];
  }
  await requestWakeLock();
  scheduleLoop();
  render();
}

function stopMonitoring(): void {
  monitoring = false;
  stopLoop();
  releaseWakeLock();
  alarm.stop();
  previousFrame = null;
  calibrationStartedAt = null;
  calibrationScores = [];
  if (status !== 'camera-error') status = simulationMode ? 'camera-ready' : camera.isOpen() ? 'camera-ready' : 'idle';
}

function stopApplication(): void {
  stopMonitoring();
  camera.stop();
  simulationMode = false;
  status = 'idle';
  pageWarning = '';
  render();
}

function recalibrate(): void {
  if (simulationMode) {
    baselineScores = [0.004, 0.005, 0.006, 0.004];
    setThresholds();
    pageWarning = '模拟模式已用默认背景重新校准。';
    render();
    return;
  }
  if (!camera.isOpen()) return;
  monitoring = true;
  status = 'calibrating';
  calibrationStartedAt = Date.now();
  calibrationScores = [];
  previousFrame = null;
  detector.reset();
  void requestWakeLock();
  scheduleLoop();
  render();
}

function confirmAlarm(): void {
  alarm.stop();
  alarmAcknowledged = true;
  if (status === 'alarming') status = 'monitoring';
  pageWarning = '报警已确认并静音；后续请由医护人员确认原因。';
  render();
}

function resetStats(): void {
  dropTimes = [];
  totalDrops = 0;
  lastDropAt = null;
  alarmAcknowledged = false;
  detector.reset();
  alarm.stop();
  if (status === 'alarming') status = monitoring ? 'monitoring' : 'paused';
  pageWarning = '统计已重置。';
  render();
}

function triggerSimulationDrop(): void {
  if (!simulationMode || !monitoring || (status !== 'monitoring' && status !== 'alarming')) return;
  const now = Date.now();
  simulationPulseUntil = now + 320;
  nextSimulationDropAt = now + 60_000 / Math.max(1, simulationRate);
}

function updateRoi(): void {
  settings.roi = currentRoi();
  saveSettings(settings);
  render();
}

syncSettingsToControls();

openCameraButton.addEventListener('click', () => void openCamera());
$<HTMLButtonElement>('#enter-simulation').addEventListener('click', enterSimulation);
startButton.addEventListener('click', () => void startMonitoring());
pauseButton.addEventListener('click', () => {
  if (!monitoring || status === 'alarming') return;
  monitoring = false;
  stopLoop();
  releaseWakeLock();
  previousFrame = null;
  status = 'paused';
  pageWarning = '页面已暂停，恢复监测前请重新确认滴斗仍在检测框内。';
  render();
});
stopButton.addEventListener('click', stopApplication);
recalibrateButton.addEventListener('click', recalibrate);
ackAlarmButton.addEventListener('click', confirmAlarm);
$<HTMLButtonElement>('#reset-stats').addEventListener('click', resetStats);
$<HTMLButtonElement>('#test-alarm').addEventListener('click', () => {
  void alarm.test({ soundEnabled: settings.soundEnabled, vibrationEnabled: settings.vibrationEnabled });
});
$<HTMLButtonElement>('#simulate-drop').addEventListener('click', triggerSimulationDrop);
$<HTMLButtonElement>('#stop-simulation').addEventListener('click', () => {
  simulationRate = 0;
  nextSimulationDropAt = Number.POSITIVE_INFINITY;
  render();
});

document.querySelectorAll<HTMLButtonElement>('[data-rate]').forEach((button) => {
  button.addEventListener('click', () => {
    simulationRate = Number(button.dataset.rate ?? 20);
    nextSimulationDropAt = Date.now() + 60_000 / simulationRate;
    render();
  });
});

$<HTMLInputElement>('#sensitivity').addEventListener('input', (event) => {
  settings.sensitivity = Number((event.target as HTMLInputElement).value) / 100;
  saveSettings(settings);
  if (baselineScores.length) setThresholds();
  render();
});
$<HTMLInputElement>('#alert-timeout').addEventListener('input', (event) => {
  settings.alertTimeoutSec = Number((event.target as HTMLInputElement).value);
  saveSettings(settings);
  render();
});
$<HTMLInputElement>('#vibration-enabled').addEventListener('change', (event) => {
  settings.vibrationEnabled = (event.target as HTMLInputElement).checked;
  saveSettings(settings);
});
$<HTMLInputElement>('#sound-enabled').addEventListener('change', (event) => {
  settings.soundEnabled = (event.target as HTMLInputElement).checked;
  saveSettings(settings);
});
Object.values(roiInputs).forEach((input) => input.addEventListener('input', updateRoi));

document.addEventListener('visibilitychange', () => {
  if (document.hidden && monitoring) {
    pageWarning = '页面已进入后台，浏览器可能暂停画面分析或延迟报警，请保持页面前台显示。';
  } else if (monitoring) {
    pageWarning = '';
    void requestWakeLock();
  }
  render();
});

if ('serviceWorker' in navigator) {
  void navigator.serviceWorker.register('./sw.js').catch(() => undefined);
}

window.setInterval(() => {
  if (monitoring || status === 'alarming') {
    checkAlarm(Date.now());
    render();
  }
}, 500);

window.addEventListener('beforeunload', () => {
  stopLoop();
  alarm.stop();
  camera.stop();
});

render();
