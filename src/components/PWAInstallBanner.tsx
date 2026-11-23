import React, { useState } from 'react';
import { Download, WifiOff, X } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

export const PWAStatusControls: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const isOnline = useOnlineStatus();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  return (
    <>
      <div className="flex items-center gap-2">
        {!isOnline && (
          <div className="inline-flex items-center gap-1.5 rounded-lg bg-amber-100 border border-amber-300 px-2.5 py-1 text-xs font-semibold text-amber-900">
            <WifiOff className="w-3.5 h-3.5 shrink-0" />
            <span className="whitespace-nowrap">Mode Offline</span>
          </div>
        )}

        {!isInstalled && isInstallable && (
          <button
            type="button"
            onClick={install}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 active:scale-[0.98] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 shrink-0" />
            <span>Pasang Aplikasi</span>
          </button>
        )}

        {!isInstalled && !isInstallable && isIOS && (
          <button
            type="button"
            onClick={() => setShowIOSGuide(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white/90 hover:bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 shrink-0" />
            <span>Pasang iOS</span>
          </button>
        )}
      </div>

      {showIOSGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ios-install-title"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-4">
              <h3 id="ios-install-title" className="text-base font-bold text-slate-900">
                Pasang di iPhone / iPad
              </h3>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                aria-label="Tutup panduan"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <ol className="mt-3 space-y-2 text-sm text-slate-700 list-decimal list-inside">
              <li>Ketuk tombol <strong>Bagikan (Share)</strong> pada bilah Safari.</li>
              <li>Gulir ke bawah lalu pilih <strong>Tambah ke Layar Utama (Add to Home Screen)</strong>.</li>
              <li>Aplikasi Surat Suara akan berjalan 100% offline.</li>
            </ol>
            <button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              className="mt-5 w-full min-h-[44px] rounded-xl bg-emerald-700 hover:bg-emerald-800 text-sm font-semibold text-white transition"
            >
              Mengerti
            </button>
          </div>
        </div>
      )}
    </>
  );
};
