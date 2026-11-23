import React from 'react';
import { Check } from 'lucide-react';
import { VoteReceipt } from '../types/voting';
import { PWAStatusControls } from './PWAInstallBanner';

interface Screen4QrisProps {
  receipt: VoteReceipt;
  onFinishAndScanNew: () => void;
}

export const Screen4Qris: React.FC<Screen4QrisProps> = ({
  receipt,
  onFinishAndScanNew,
}) => {
  const formattedDate = new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(receipt.votedAt);

  return (
    <div className="min-h-[100dvh] w-full flex flex-col justify-between bg-gradient-to-b from-[#BCE0AC] via-[#D8ECCF] to-[#E6F4FA] px-4 py-4 sm:py-6 select-none">
      {/* Subtle Top Utility Row */}
      <div className="mx-auto w-full max-w-md flex justify-end min-h-[28px]">
        <PWAStatusControls />
      </div>

      {/* Centered QRIS Card + Separate Blue Button Below */}
      <main className="flex-1 flex flex-col items-center justify-center py-2">
        <div className="w-full max-w-[380px] sm:max-w-[420px] bg-white rounded-xl shadow-[0_14px_34px_rgba(15,23,42,0.12)] overflow-hidden flex flex-col">
          {/* Top Red-to-Blue Gradient Bar */}
          <div className="h-2 w-full bg-gradient-to-r from-[#DC2626] via-[#8B2B6E] to-[#1086E8]" />

          <div className="px-5 sm:px-7 pt-4 pb-5 flex flex-col items-center">
            {/* QRIS Brand Header Row */}
            <div className="w-full flex items-center justify-between gap-3 pb-3.5 border-b border-slate-200">
              <div className="flex flex-col">
                <span className="font-condensed text-3xl sm:text-[34px] font-extrabold tracking-tight text-[#0F172A] leading-none">
                  QRIS
                </span>
                <span className="mt-0.5 text-[11px] font-medium text-slate-500 leading-tight">
                  QR Code Indonesian Standard
                </span>
              </div>

              <div className="inline-flex items-center gap-1 rounded-full bg-[#DCFCE7] px-3 py-1 text-xs font-semibold text-[#15803D] shrink-0">
                <Check className="w-3.5 h-3.5 stroke-[2.75]" />
                <span>Pilihan Terkunci</span>
              </div>
            </div>

            {/* Village Name & Ballot ID */}
            <div className="mt-4 text-center">
              <h1 className="text-base sm:text-lg font-bold tracking-wide text-[#0F172A] uppercase">
                DESA CURUGRENDENG
              </h1>
              <p className="mt-0.5 text-xs font-medium text-slate-500 tabular-nums">
                ID: {receipt.ballotId}
              </p>
            </div>

            {/* Scannable Offline QRIS Barcode Box */}
            <div className="mt-3.5 p-3 sm:p-4 rounded-xl border border-slate-200 bg-white shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
              <img
                src={receipt.qrisDataUrl}
                alt={`Kode QRIS Desa Curugrendeng untuk Kandidat Nomor ${receipt.candidate.number}`}
                className="w-48 h-48 sm:w-56 sm:h-56 block"
              />
            </div>

            {/* Selected Candidate & Timestamp Summary Box */}
            <div className="mt-4 w-full rounded-lg bg-[#F8FAFC] border border-slate-100 px-4 py-3 text-center">
              <p className="text-sm sm:text-base font-bold text-[#0F172A]">
                No. Urut {receipt.candidate.number} &bull; {receipt.candidate.name}
              </p>
              <p className="mt-0.5 text-xs font-medium text-slate-500 tabular-nums">
                {formattedDate} &bull; Suara Sah Terverifikasi
              </p>
            </div>

            {/* Bottom Helper Line inside Card */}
            <p className="mt-3.5 text-xs font-medium text-slate-500 text-center">
              Pindai kode QRIS di atas pada perangkat verifikasi TPS
            </p>
          </div>
        </div>

        {/* Blue Bottom Button Below Card */}
        <div className="mt-5 w-full max-w-[380px] sm:max-w-[420px]">
          <button
            type="button"
            onClick={onFinishAndScanNew}
            className="w-full min-h-[52px] sm:min-h-[56px] rounded-md bg-[#1086E8] hover:bg-[#0D74CA] active:scale-[0.98] text-white text-base sm:text-lg font-medium tracking-wide uppercase shadow-sm transition flex items-center justify-center cursor-pointer"
          >
            SELESAI &amp; SCAN BARU
          </button>
        </div>
      </main>

      <div className="min-h-[12px]" />
    </div>
  );
};
