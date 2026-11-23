import React from 'react';
import { Candidate } from '../types/voting';
import { CandidateSilhouette } from './CandidateSilhouette';
import { PWAStatusControls } from './PWAInstallBanner';

interface Screen3ConfirmProps {
  candidate: Candidate;
  onRepeat: () => void;
  onConfirm: () => void;
  isGenerating?: boolean;
}

export const Screen3Confirm: React.FC<Screen3ConfirmProps> = ({
  candidate,
  onRepeat,
  onConfirm,
  isGenerating = false,
}) => {
  return (
    <div className="min-h-[100dvh] w-full flex flex-col justify-between bg-gradient-to-b from-[#BCE0AC] via-[#D8ECCF] to-[#E6F4FA] select-none">
      {/* Subtle Top Utility Row (PWA install / offline indicator only when active) */}
      <div className="w-full pt-3 px-4 flex justify-end min-h-[36px]">
        <PWAStatusControls />
      </div>

      {/* Center Selected Candidate Card */}
      <main className="flex-1 flex items-center justify-center px-5 py-4">
        <div className="w-full max-w-[280px] sm:max-w-[320px] bg-white p-1.5 sm:p-2 shadow-[0_12px_32px_rgba(15,23,42,0.12)] flex flex-col">
          {/* Red Top Bar with Candidate Number */}
          <div className="bg-[#DC1E25] py-2.5 sm:py-3 px-4 flex items-center justify-center">
            <span className="text-2xl sm:text-3xl font-medium text-white leading-none tabular-nums">
              {candidate.number}
            </span>
          </div>

          {/* Candidate Photo or Silhouette */}
          <div className="relative w-full aspect-[266/316] bg-[#DC0000] overflow-hidden">
            {candidate.variant === 'silhouette' ? (
              <CandidateSilhouette />
            ) : candidate.imageUrl ? (
              <img
                src={candidate.imageUrl}
                alt={candidate.name}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover object-top"
              />
            ) : (
              <CandidateSilhouette />
            )}
          </div>

          {/* Candidate Name Footer */}
          <div className="bg-white py-4 sm:py-5 px-3 text-center">
            <h1 className="text-lg sm:text-2xl font-medium text-[#111827] tracking-tight leading-tight">
              {candidate.name}
            </h1>
          </div>
        </div>
      </main>

      {/* Bottom Two Wide Side-by-Side Action Buttons */}
      <footer className="w-full pb-6 sm:pb-10 pt-2 px-5 sm:px-8">
        <div className="mx-auto max-w-3xl grid grid-cols-2 gap-4 sm:gap-10">
          <button
            type="button"
            onClick={onRepeat}
            disabled={isGenerating}
            className="min-h-[52px] sm:min-h-[60px] rounded-[4px] bg-[#EF3B36] hover:bg-[#DC2626] active:scale-[0.98] disabled:opacity-60 text-lg sm:text-xl font-medium tracking-wide uppercase text-white shadow-sm transition cursor-pointer flex items-center justify-center"
          >
            ULANGI
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isGenerating}
            className="min-h-[52px] sm:min-h-[60px] rounded-[4px] bg-[#1086E8] hover:bg-[#0D74CA] active:scale-[0.98] disabled:opacity-60 text-lg sm:text-xl font-medium tracking-wide uppercase text-white shadow-sm transition cursor-pointer flex items-center justify-center"
          >
            {isGenerating ? 'MEMPROSES...' : 'PILIH'}
          </button>
        </div>
      </footer>
    </div>
  );
};
