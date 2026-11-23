import React, { useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Camera, ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { KtpVoterData } from '../types/voting';
import { parseAndValidateKtpQr } from '../utils/ktpValidator';
import { PWAStatusControls } from './PWAInstallBanner';

interface Screen1ScannerProps {
  onKtpVerified: (voter: KtpVoterData) => void;
}

type CameraState = 'initializing' | 'active' | 'denied' | 'unavailable';
type ScanFeedbackState = 'scanning' | 'invalid';

const waitMs = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

class CameraTimeoutError extends Error {
  constructor(message = 'Timeout saat mengakses kamera') {
    super(message);
    this.name = 'CameraTimeoutError';
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new CameraTimeoutError(label));
    }, timeoutMs);

    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        window.clearTimeout(timer);
        reject(err);
      }
    );
  });
}

async function queryCameraPermissionState(): Promise<'granted' | 'denied' | 'prompt' | 'unknown'> {
  try {
    if (!navigator.permissions || typeof navigator.permissions.query !== 'function') {
      return 'unknown';
    }
    const status = await withTimeout(
      navigator.permissions.query({ name: 'camera' as PermissionName }),
      1000,
      'PermissionQueryTimeout'
    );
    return status.state;
  } catch {
    return 'unknown';
  }
}

async function acquireCameraStream(
  onStepChange?: (stepLabel: string) => void
): Promise<MediaStream> {
  const permState = await queryCameraPermissionState();
  if (permState === 'denied') {
    const deniedErr = new Error('Permission denied');
    deniedErr.name = 'NotAllowedError';
    throw deniedErr;
  }

  // If permission is already granted, hardware shouldn't take long;
  // if browser may show a prompt, allow a bit more time on the first attempt.
  const firstTimeout = permState === 'granted' ? 4500 : 7500;

  const attempts: Array<{ label: string; constraints: MediaStreamConstraints; timeout: number }> = [
    {
      label: 'Membuka kamera belakang...',
      constraints: {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      },
      timeout: firstTimeout,
    },
    {
      label: 'Mencoba mode kamera standar...',
      constraints: {
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      },
      timeout: 4500,
    },
    {
      label: 'Mencoba kamera utama perangkat...',
      constraints: {
        video: true,
        audio: false,
      },
      timeout: 4500,
    },
  ];

  let lastError: unknown;
  for (let i = 0; i < attempts.length; i++) {
    onStepChange?.(attempts[i].label);
    try {
      return await withTimeout(
        navigator.mediaDevices.getUserMedia(attempts[i].constraints),
        attempts[i].timeout,
        'GetUserMediaTimeout'
      );
    } catch (err) {
      lastError = err;
      const name = (err as DOMException)?.name;
      // If user/policy explicitly blocked permission or site is insecure, stop immediately
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
        throw err;
      }
      // If hardware was briefly still releasing from a previous stream, wait briefly before simpler constraint
      if (name === 'NotReadableError' || name === 'TrackStartError') {
        await waitMs(220);
      }
    }
  }

  // Fallback: enumerate individual video input devices (helps on multi-lens Android or laptops with virtual cameras)
  if (typeof navigator.mediaDevices.enumerateDevices === 'function') {
    onStepChange?.('Mencari perangkat kamera tersedia...');
    try {
      const devices = await withTimeout(
        navigator.mediaDevices.enumerateDevices(),
        2500,
        'EnumerateDevicesTimeout'
      );
      const videoDevices = devices
        .filter((d) => d.kind === 'videoinput' && Boolean(d.deviceId))
        .sort((a, b) => {
          const aRear = /back|rear|environment|belakang/i.test(a.label) ? 0 : 1;
          const bRear = /back|rear|environment|belakang/i.test(b.label) ? 0 : 1;
          return aRear - bRear;
        });

      for (const device of videoDevices) {
        try {
          return await withTimeout(
            navigator.mediaDevices.getUserMedia({
              video: { deviceId: { exact: device.deviceId } },
              audio: false,
            }),
            4000,
            'DeviceIdCameraTimeout'
          );
        } catch (err) {
          lastError = err;
          const name = (err as DOMException)?.name;
          if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
            throw err;
          }
        }
      }
    } catch (enumErr) {
      lastError = enumErr;
    }
  }

  throw lastError;
}

async function attachAndPlayVideo(video: HTMLVideoElement, stream: MediaStream): Promise<void> {
  video.muted = true;
  video.defaultMuted = true;
  video.autoplay = true;
  video.playsInline = true;
  video.setAttribute('muted', '');
  video.setAttribute('autoplay', '');
  video.setAttribute('playsinline', 'true');
  video.setAttribute('webkit-playsinline', 'true');
  video.srcObject = stream;

  // Trigger play immediately, but never let a stalled play() promise hang initialization
  const playAttempt = video.play().catch(() => {});

  if (video.readyState < 1) {
    await new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        video.removeEventListener('loadedmetadata', finish);
        video.removeEventListener('canplay', finish);
        window.clearTimeout(fallbackTimer);
        resolve();
      };
      const fallbackTimer = window.setTimeout(finish, 900);
      video.addEventListener('loadedmetadata', finish, { once: true });
      video.addEventListener('canplay', finish, { once: true });
    });
  }

  await Promise.race([playAttempt, waitMs(700)]);
  if (video.srcObject === stream && video.paused) {
    void video.play().catch(() => {});
  }
}

export const Screen1Scanner: React.FC<Screen1ScannerProps> = ({ onKtpVerified }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<number | null>(null);
  const initHintTimerRef = useRef<number | null>(null);
  const invalidCooldownRef = useRef<number>(0);
  const hasVerifiedRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(true);
  const requestSeqRef = useRef<number>(0);
  const isAcquiringRef = useRef<boolean>(false);
  const onKtpVerifiedRef = useRef(onKtpVerified);
  onKtpVerifiedRef.current = onKtpVerified;

  const [cameraState, setCameraState] = useState<CameraState>('initializing');
  const [initStepText, setInitStepText] = useState<string>('Menyiapkan kamera...');
  const [cameraErrorMsg, setCameraErrorMsg] = useState<string>('');
  const [cameraErrorCode, setCameraErrorCode] = useState<string>('');
  const [scanFeedback, setScanFeedback] = useState<ScanFeedbackState>('scanning');
  const [showManualRetry, setShowManualRetry] = useState<boolean>(false);

  const isInIframe =
    typeof window !== 'undefined' &&
    (() => {
      try {
        return window.self !== window.top;
      } catch {
        return true;
      }
    })();

  const stopCamera = useCallback(() => {
    requestSeqRef.current += 1;
    isAcquiringRef.current = false;
    if (initHintTimerRef.current !== null) {
      window.clearTimeout(initHintTimerRef.current);
      initHintTimerRef.current = null;
    }
    if (scanTimerRef.current !== null) {
      window.clearTimeout(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.onended = null;
        track.stop();
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const performScanTick = useCallback(() => {
    if (!isMountedRef.current || hasVerifiedRef.current) return;

    const video = videoRef.current;
    if (!video || video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
      if (video && video.paused && streamRef.current?.active) {
        void video.play().catch(() => {});
      }
      scanTimerRef.current = window.setTimeout(performScanTick, 160);
      return;
    }

    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
    }
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (ctx) {
      const vw = video.videoWidth;
      const vh = video.videoHeight;

      // Keep canvas size optimal (~640px max side) for crisp, fast offline decoding
      const targetMax = 640;
      const scaleDown = Math.min(1, targetMax / Math.max(vw, vh));
      const dw = Math.max(160, Math.floor(vw * scaleDown));
      const dh = Math.max(160, Math.floor(vh * scaleDown));

      if (canvas.width !== dw || canvas.height !== dh) {
        canvas.width = dw;
        canvas.height = dh;
      }

      ctx.drawImage(video, 0, 0, vw, vh, 0, 0, dw, dh);
      const imageData = ctx.getImageData(0, 0, dw, dh);
      const decoded = jsQR(imageData.data, dw, dh, {
        inversionAttempts: 'attemptBoth',
      });

      if (decoded && decoded.data) {
        const validation = parseAndValidateKtpQr(decoded.data);
        if (validation.valid) {
          hasVerifiedRef.current = true;
          stopCamera();
          onKtpVerifiedRef.current(validation.data);
          return;
        } else {
          const now = Date.now();
          if (now - invalidCooldownRef.current > 1500) {
            invalidCooldownRef.current = now;
            setScanFeedback('invalid');
          }
        }
      }
    }

    scanTimerRef.current = window.setTimeout(performScanTick, 150);
  }, [stopCamera]);

  const startCamera = useCallback(
    async (forceRestart = false) => {
      hasVerifiedRef.current = false;
      setScanFeedback('scanning');

      if (typeof window !== 'undefined' && !window.isSecureContext) {
        setCameraState('unavailable');
        setCameraErrorCode('InsecureContext');
        setCameraErrorMsg(
          'Alamat web tidak memakai HTTPS. Buka menggunakan https:// agar kamera diizinkan.'
        );
        return;
      }

      if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
        setCameraState('unavailable');
        setCameraErrorCode('MediaDevicesUnsupported');
        setCameraErrorMsg(
          'Browser ini tidak mendukung kamera langsung. Buka link ini lewat Google Chrome (Android) atau Safari (iPhone/iPad), jangan dari browser dalam WhatsApp.'
        );
        return;
      }

      const activeTracks = streamRef.current?.getVideoTracks() ?? [];
      const hasLiveTrack =
        !forceRestart &&
        Boolean(streamRef.current?.active) &&
        activeTracks.some((track) => track.readyState === 'live');

      if (hasLiveTrack && videoRef.current) {
        if (videoRef.current.srcObject !== streamRef.current) {
          await attachAndPlayVideo(videoRef.current, streamRef.current!);
        } else if (videoRef.current.paused) {
          await videoRef.current.play().catch(() => {});
        }
        if (!isMountedRef.current) return;
        setCameraState('active');
        if (scanTimerRef.current === null) {
          performScanTick();
        }
        return;
      }

      // Stop any previous or stale stream cleanly before opening a fresh one
      stopCamera();
      const requestId = ++requestSeqRef.current;
      isAcquiringRef.current = true;

      setCameraState('initializing');
      setInitStepText('Menyiapkan kamera...');
      setCameraErrorMsg('');
      setCameraErrorCode('');
      setShowManualRetry(false);

      initHintTimerRef.current = window.setTimeout(() => {
        if (isMountedRef.current && requestSeqRef.current === requestId) {
          setShowManualRetry(true);
        }
      }, 900);

      try {
        const stream = await acquireCameraStream((stepLabel) => {
          if (isMountedRef.current && requestSeqRef.current === requestId) {
            setInitStepText(stepLabel);
          }
        });

        if (!isMountedRef.current || requestSeqRef.current !== requestId) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        isAcquiringRef.current = false;
        if (initHintTimerRef.current !== null) {
          window.clearTimeout(initHintTimerRef.current);
          initHintTimerRef.current = null;
        }

        streamRef.current = stream;

        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.onended = () => {
            if (!isMountedRef.current || hasVerifiedRef.current) return;
            streamRef.current = null;
            setCameraState('unavailable');
            setCameraErrorCode('TrackEnded');
            setCameraErrorMsg(
              'Koneksi kamera terputus. Ketuk tombol di bawah untuk mengaktifkan kamera kembali.'
            );
          };
        }

        const video = videoRef.current;
        if (video) {
          setInitStepText('Menampilkan pratinjau kamera...');
          await attachAndPlayVideo(video, stream);
        }

        if (!isMountedRef.current || requestSeqRef.current !== requestId) {
          return;
        }

        setCameraState('active');
        setShowManualRetry(false);
        if (scanTimerRef.current !== null) {
          window.clearTimeout(scanTimerRef.current);
        }
        scanTimerRef.current = window.setTimeout(performScanTick, 180);
      } catch (err) {
        if (!isMountedRef.current || requestSeqRef.current !== requestId) {
          return;
        }

        isAcquiringRef.current = false;
        if (initHintTimerRef.current !== null) {
          window.clearTimeout(initHintTimerRef.current);
          initHintTimerRef.current = null;
        }

        const error = err as DOMException;
        const errName = error?.name || 'UnknownError';
        setCameraErrorCode(errName);
        setShowManualRetry(true);

        if (
          errName === 'NotAllowedError' ||
          errName === 'PermissionDeniedError' ||
          errName === 'SecurityError'
        ) {
          setCameraState('denied');
          setCameraErrorMsg(
            isInIframe
              ? 'Browser membatasi izin kamera di dalam pratinjau/iframe. Ketuk "Buka di Tab Baru" di bawah atau izinkan kamera pada ikon gembok di bilah alamat.'
              : 'Izin kamera ditolak atau belum diizinkan. Ketuk ikon pengaturan/gembok di samping alamat URL lalu pilih Izinkan Kamera, kemudian ketuk tombol di bawah.'
          );
        } else if (errName === 'CameraTimeoutError') {
          setCameraState('unavailable');
          setCameraErrorMsg(
            isInIframe
              ? 'Permintaan kamera tidak mendapat respons di dalam pratinjau. Ketuk "Buka di Tab Baru" agar browser memunculkan izin kamera secara langsung.'
              : 'Kamera terlalu lama merespons. Pastikan tidak ada dialog izin yang tertunda atau aplikasi kamera lain yang terbuka, lalu ketuk Coba Aktifkan Kamera.'
          );
        } else if (errName === 'NotReadableError' || errName === 'TrackStartError') {
          setCameraState('unavailable');
          setCameraErrorMsg(
            'Kamera sedang dipakai oleh aplikasi atau tab lain. Tutup aplikasi kamera lain lalu ketuk Coba Aktifkan Kamera.'
          );
        } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
          setCameraState('unavailable');
          setCameraErrorMsg(
            'Kamera tidak ditemukan pada perangkat ini. Pastikan perangkat memiliki kamera aktif dan tidak dinonaktifkan.'
          );
        } else {
          setCameraState('unavailable');
          setCameraErrorMsg(
            'Kamera gagal dibuka otomatis. Ketuk tombol di bawah untuk mengaktifkan kamera secara langsung.'
          );
        }
      }
    },
    [isInIframe, performScanTick, stopCamera]
  );

  useEffect(() => {
    isMountedRef.current = true;
    startCamera(false);

    const handleVisibilityChange = () => {
      if (
        document.visibilityState === 'visible' &&
        isMountedRef.current &&
        !hasVerifiedRef.current &&
        !isAcquiringRef.current
      ) {
        const videoTracks = streamRef.current?.getVideoTracks() ?? [];
        const stillLive =
          Boolean(streamRef.current?.active) &&
          videoTracks.some((track) => track.readyState === 'live');
        if (!stillLive) {
          startCamera(false);
        } else if (videoRef.current && videoRef.current.paused) {
          videoRef.current.play().catch(() => {});
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      isMountedRef.current = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  const handleScanButtonClick = () => {
    setScanFeedback('scanning');
    invalidCooldownRef.current = 0;
    const videoTracks = streamRef.current?.getVideoTracks() ?? [];
    const hasLiveStream =
      cameraState === 'active' &&
      Boolean(streamRef.current?.active) &&
      videoTracks.some((track) => track.readyState === 'live');

    if (!hasLiveStream) {
      startCamera(true);
    } else {
      if (videoRef.current && videoRef.current.paused) {
        videoRef.current.play().catch(() => {});
      }
      if (scanTimerRef.current !== null) {
        window.clearTimeout(scanTimerRef.current);
      }
      performScanTick();
    }
  };

  return (
    <div className="min-h-[100dvh] w-full bg-[#0F172A] flex items-center justify-center sm:p-5 select-none">
      {/* Proportional Scanner Container */}
      <div className="relative flex flex-col w-full h-[100dvh] sm:h-[min(800px,92dvh)] sm:max-w-[480px] sm:rounded-[28px] sm:border sm:border-white/10 sm:shadow-[0_24px_64px_rgba(0,0,0,0.5)] overflow-hidden bg-black">
        {/* Top White Rounded-Bottom Header with Blue Top Accent */}
        <header className="relative z-20 w-full bg-white rounded-b-[22px] shadow-[0_6px_20px_rgba(0,0,0,0.2)] shrink-0">
          <div className="h-1.5 w-full bg-[#1D4ED8]" />
          <div className="px-4 py-3 sm:px-6 sm:py-3.5 text-center">
            <h1 className="text-[17px] sm:text-[19px] font-extrabold text-[#1E3A8A] leading-tight tracking-tight">
              Arahkan kamera ke QR code
            </h1>
            <p className="mt-0.5 text-[12px] sm:text-[13px] font-semibold text-[#2563EB] leading-snug">
              Pastikan QR code berada di dalam kotak frame
            </p>
            <p
              role="status"
              aria-live="polite"
              className={`mt-1 text-[12px] sm:text-[13px] font-bold leading-snug ${
                scanFeedback === 'invalid' ? 'text-[#DC2626]' : 'text-[#16A34A]'
              }`}
            >
              {scanFeedback === 'invalid' ? 'qr code tidak terdeteksi' : 'Posisi scanning kode'}
            </p>
          </div>
        </header>

        {/* Center Camera Preview Viewport */}
        <main className="relative flex-1 w-full overflow-hidden bg-black">
          {/* Stable Native Video Stream (no re-mounting, no flickering filters) */}
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="absolute inset-0 w-full h-full object-cover"
          />

          {/* QR Frame Overlay with Neon Green L-Shaped Corners & Dark Center Pill */}
          {cameraState === 'active' && (
            <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
              <div
                className="relative w-[min(58vw,228px)] h-[min(58vw,228px)] sm:w-[244px] sm:h-[244px] rounded-xl flex items-center justify-center"
                style={{
                  boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.44)',
                }}
              >
                {/* Top-Left Neon Green L Bracket */}
                <span className="absolute -top-0.5 -left-0.5 w-8 h-8 border-t-[4px] border-l-[4px] border-[#22FF44] rounded-tl-xl" />
                {/* Top-Right Neon Green L Bracket */}
                <span className="absolute -top-0.5 -right-0.5 w-8 h-8 border-t-[4px] border-r-[4px] border-[#22FF44] rounded-tr-xl" />
                {/* Bottom-Left Neon Green L Bracket */}
                <span className="absolute -bottom-0.5 -left-0.5 w-8 h-8 border-b-[4px] border-l-[4px] border-[#22FF44] rounded-bl-xl" />
                {/* Bottom-Right Neon Green L Bracket */}
                <span className="absolute -bottom-0.5 -right-0.5 w-8 h-8 border-b-[4px] border-r-[4px] border-[#22FF44] rounded-br-xl" />

                {/* Dark Center Pill Prompt */}
                <div className="px-3 py-1.5 rounded-full bg-black/70 border border-white/15 shadow-sm">
                  <span className="text-[11px] sm:text-[12px] font-semibold text-white whitespace-nowrap">
                    Letakkan QR code di dalam frame
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Unavailable / Permission Fallback */}
          {cameraState !== 'active' && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/90 p-5">
              <div className="w-full max-w-[330px] rounded-2xl bg-slate-900 border border-slate-700 p-5 text-center text-white shadow-xl">
                <div className="mx-auto mb-2.5 flex h-11 w-11 items-center justify-center rounded-full bg-blue-600/20 text-blue-400">
                  {cameraState === 'initializing' ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Camera className="h-5 w-5" />
                  )}
                </div>
                <p className="text-sm font-semibold text-white">
                  {cameraState === 'initializing' ? initStepText : 'Kamera Belum Aktif'}
                </p>
                {cameraState === 'initializing' && showManualRetry && !cameraErrorMsg && (
                  <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                    Jika dialog izin kamera tidak muncul otomatis, ketuk tombol di bawah untuk mengaktifkan kamera.
                  </p>
                )}
                {cameraErrorMsg && (
                  <p className="mt-2 text-xs text-slate-300 leading-relaxed">{cameraErrorMsg}</p>
                )}
                {cameraErrorCode && (
                  <p className="mt-1.5 text-[11px] font-mono text-slate-400">
                    Kode: {cameraErrorCode}
                  </p>
                )}
                {(cameraState === 'denied' ||
                  cameraState === 'unavailable' ||
                  showManualRetry) && (
                  <div className="mt-4 flex flex-col gap-2.5">
                    <button
                      type="button"
                      onClick={() => startCamera(true)}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2.5 text-xs font-bold text-white min-h-[44px] transition cursor-pointer"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>
                        {cameraState === 'initializing'
                          ? 'Aktifkan Kamera Sekarang'
                          : 'Coba Aktifkan Kamera'}
                      </span>
                    </button>

                    {isInIframe && (
                      <a
                        href={typeof window !== 'undefined' ? window.location.href : '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 px-4 py-2.5 text-xs font-semibold text-white min-h-[42px] transition"
                      >
                        <ExternalLink className="w-4 h-4" />
                        <span>Buka di Tab Baru</span>
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Subtle PWA / Offline Control */}
          <div className="absolute top-2.5 right-2.5 z-40">
            <PWAStatusControls />
          </div>
        </main>

        {/* Bottom White Rounded-Top Footer */}
        <footer className="relative z-20 w-full bg-white rounded-t-[22px] shadow-[0_-4px_18px_rgba(0,0,0,0.16)] px-5 py-3.5 shrink-0">
          <button
            type="button"
            onClick={handleScanButtonClick}
            className="w-full min-h-[46px] rounded-xl bg-[#1D4ED8] hover:bg-[#1E40AF] active:scale-[0.99] text-white text-[15px] font-bold tracking-wide shadow-sm transition flex items-center justify-center cursor-pointer"
          >
            Scan untuk memulai
          </button>
        </footer>
      </div>
    </div>
  );
};
