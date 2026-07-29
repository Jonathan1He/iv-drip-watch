import type { Roi } from '../types';

export class CameraError extends Error {
  constructor(
    message: string,
    public readonly code: 'unsupported' | 'permission' | 'not-found' | 'busy' | 'unknown',
  ) {
    super(message);
    this.name = 'CameraError';
  }
}

function asCameraError(error: unknown): CameraError {
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return new CameraError('摄像头权限被拒绝。请在浏览器设置中允许本页使用摄像头。', 'permission');
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return new CameraError('没有发现可用摄像头。', 'not-found');
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return new CameraError('摄像头可能正被其他应用占用，请关闭占用摄像头的应用后重试。', 'busy');
  }
  return new CameraError('摄像头启动失败，请检查浏览器权限、HTTPS 和设备状态。', 'unknown');
}

export class CameraManager {
  private stream: MediaStream | null = null;

  constructor(private readonly video: HTMLVideoElement) {}

  async open(): Promise<void> {
    if (this.stream) return;
    if (!globalThis.isSecureContext && !['localhost', '127.0.0.1'].includes(location.hostname)) {
      throw new CameraError('手机访问摄像头通常需要 HTTPS；请使用安全域名打开本页。', 'unsupported');
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new CameraError('当前浏览器不支持摄像头 API。', 'unsupported');
    }

    const preferred: MediaStreamConstraints = {
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    };
    try {
      this.stream = await navigator.mediaDevices.getUserMedia(preferred);
    } catch (error) {
      const name = error instanceof DOMException ? error.name : '';
      if (name === 'NotAllowedError' || name === 'SecurityError') throw asCameraError(error);
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      } catch (fallbackError) {
        throw asCameraError(fallbackError);
      }
    }

    try {
      this.video.srcObject = this.stream;
      this.video.muted = true;
      this.video.playsInline = true;
      await this.video.play();
    } catch (error) {
      this.stop();
      throw asCameraError(error);
    }
  }

  stop(): void {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.video.pause();
    this.video.srcObject = null;
  }

  isOpen(): boolean {
    return this.stream !== null && this.video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
  }

  captureRoiGrayscale(canvas: HTMLCanvasElement, roi: Roi): Uint8ClampedArray {
    if (!this.isOpen() || this.video.videoWidth === 0 || this.video.videoHeight === 0) {
      throw new CameraError('摄像头画面尚未准备好。', 'unknown');
    }
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new CameraError('浏览器无法创建 Canvas 分析上下文。', 'unsupported');

    const outputSize = 64;
    canvas.width = outputSize;
    canvas.height = outputSize;
    context.imageSmoothingEnabled = false;
    const sourceWidth = this.video.videoWidth;
    const sourceHeight = this.video.videoHeight;
    const sourceX = Math.round(Math.min(1, Math.max(0, roi.x)) * sourceWidth);
    const sourceY = Math.round(Math.min(1, Math.max(0, roi.y)) * sourceHeight);
    const sourceWidthPx = Math.max(1, Math.round(roi.width * sourceWidth));
    const sourceHeightPx = Math.max(1, Math.round(roi.height * sourceHeight));
    context.drawImage(
      this.video,
      sourceX,
      sourceY,
      Math.min(sourceWidthPx, sourceWidth - sourceX),
      Math.min(sourceHeightPx, sourceHeight - sourceY),
      0,
      0,
      outputSize,
      outputSize,
    );

    const rgba = context.getImageData(0, 0, outputSize, outputSize).data;
    const grayscale = new Uint8ClampedArray(outputSize * outputSize);
    for (let index = 0, pixel = 0; index < rgba.length; index += 4, pixel += 1) {
      grayscale[pixel] = Math.round(rgba[index] * 0.299 + rgba[index + 1] * 0.587 + rgba[index + 2] * 0.114);
    }
    return grayscale;
  }
}
