import React, { useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Camera, RefreshCw } from 'lucide-react';
import { KtpVoterData } from '../types/voting';
import { parseAndValidateKtpQr } from '../utils/ktpValidator';
import { PWAStatusControls } from './PWAInstallBanner';

interface Screen1ScannerProps {
  onKtpVerified: (voter: KtpVoterData) => void;
}

type CameraState = 'initializing' | 'active' | 'denied' | 'unavailable';
type ScanFeedbackState = 'scanning' | 'invalid';

async function acquireCameraStream(): Promise<MediaStream> {
  const attempts: MediaStreamConstraints[] = [
    {
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    },
    {
      video: { facingMode: 'environment' },
      audio: false,
    },
    {
      video: true,
      audio: false,
    },
  ];

  let lastError: unknown;
  for (let i = 0; i < attempts.length; i++) {
    try {
      return await navigator.mediaDevices.getUserMedia(attempts[i]);
    } catch (err) {
      lastError = err;
      const name = (err as DOMException)?.name;
      // If user explicitly denied permission or site is insecure, do not retry further constraints
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
        throw err;
      }
    }
  }
  throw lastError;
}

export const Screen1Scanner: React.FC<Screen1ScannerProps> = ({ onKtpVerified }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<number | null>(null);
  const invalidCooldownRef = useRef<number>(0);
  const hasVerifiedRef = useRef<boolean>(false);

  const [cameraState, setCameraState] = useState<CameraState>('initializing');
  const [cameraErrorMsg, setCameraErrorMsg] = useState<string>('');
  const [cameraErrorCode, setCameraErrorCode] = useState<string>('');
  const [scanFeedback, setScanFeedback] = useState<ScanFeedbackState>('scanning');

  const stopCamera = useCallback(() => {
    if (scanTimerRef.current !== null) {
      window.clearTimeout(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const performScanTick = useCallback(() => {
    if (hasVerifiedRef.current) return;

    const video = videoRef.current;
    if (!video || video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
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
          onKtpVerified(validation.data);
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
  }, [onKtpVerified, stopCamera]);

  const startCamera = useCallback(async () => {
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

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraState('unavailable');
      setCameraErrorCode('MediaDevicesUnsupported');
      setCameraErrorMsg(
        'Browser ini tidak mendukung kamera langsung. Buka link ini lewat Google Chrome (Android) atau Safari (iPhone/iPad), jangan dari browser dalam WhatsApp.'
      );
      return;
    }

    // If stream is already running smoothly, do not re-initialize to avoid flicker
    if (streamRef.current && streamRef.current.active) {
      setCameraState('active');
      if (scanTimerRef.current === null) {
        performScanTick();
      }
      return;
    }

    setCameraState('initializing');
    setCameraErrorMsg('');
    setCameraErrorCode('');

    try {
      const stream = await acquireCameraStream();
      streamRef.current = stream;

      const video = videoRef.current;
      if (video) {
        video.muted = true;
        video.setAttribute('playsinline', 'true');
        video.srcObject = stream;
        await video.play().catch(() => {});
      }

      setCameraState('active');
      if (scanTimerRef.current !== null) {
        window.clearTimeout(scanTimerRef.current);
      }
      scanTimerRef.current = window.setTimeout(performScanTick, 200);
    } catch (err) {
      const error = err as DOMException;
      const errName = error?.name || 'UnknownError';
      setCameraErrorCode(errName);

      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError' || errName === 'SecurityError') {
        setCameraState('denied');
        setCameraErrorMsg(
          'Izin kamera diblokir. Ketuk ikon pengaturan/gembok di sebelah URL browser lalu pilih Izinkan Kamera, dan pastikan dibuka lewat Chrome/Safari (bukan browser WhatsApp).'
        );
      } else if (errName === 'NotReadableError' || errName === 'TrackStartError') {
        setCameraState('unavailable');
        setCameraErrorMsg(
          'Kamera sedang dipakai oleh aplikasi atau tab lain. Tutup aplikasi kamera lain lalu ketuk Coba Aktifkan Kamera.'
        );
      } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
        setCameraState('unavailable');
        setCameraErrorMsg('Kamera tidak ditemukan pada perangkat ini.');
      } else {
        setCameraState('unavailable');
        setCameraErrorMsg(
          'Kamera gagal dimulai. Pastikan link dibuka di Google Chrome atau Safari, lalu ketuk tombol di bawah.'
        );
      }
    }
  }, [performScanTick]);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  const handleScanButtonClick = () => {
    setScanFeedback('scanning');
    invalidCooldownRef.current = 0;
    if (cameraState !== 'active') {
      startCamera();
    } else {
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
              <div className="w-full max-w-[320px] rounded-2xl bg-slate-900 border border-slate-700 p-5 text-center text-white shadow-xl">
                <div className="mx-auto mb-2.5 flex h-11 w-11 items-center justify-center rounded-full bg-blue-600/20 text-blue-400">
                  <Camera className="h-5 w-5" />
                </div>
                <p className="text-sm font-semibold text-white">
                  {cameraState === 'initializing'
                    ? 'Menyiapkan kamera belakang...'
                    : 'Kamera Belum Aktif'}
                </p>
                {cameraErrorMsg && (
                  <p className="mt-2 text-xs text-slate-300 leading-relaxed">{cameraErrorMsg}</p>
                )}
                {cameraErrorCode && (
                  <p className="mt-1.5 text-[11px] font-mono text-slate-400">
                    Kode: {cameraErrorCode}
                  </p>
                )}
                {(cameraState === 'denied' || cameraState === 'unavailable') && (
                  <button
                    type="button"
                    onClick={startCamera}
                    className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2.5 text-xs font-bold text-white min-h-[44px] transition cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Coba Aktifkan Kamera</span>
                  </button>
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
