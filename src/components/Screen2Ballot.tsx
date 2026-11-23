import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { Candidate } from '../types/voting';
import { CandidateSilhouette } from './CandidateSilhouette';
import { PWAStatusControls } from './PWAInstallBanner';

interface Screen2BallotProps {
  candidates: Candidate[];
  selectedCandidate: Candidate | null;
  onSelectCandidate: (candidate: Candidate) => void;
  onProceed: () => void;
}

export const Screen2Ballot: React.FC<Screen2BallotProps> = ({
  candidates,
  selectedCandidate,
  onSelectCandidate,
  onProceed,
}) => {
  const [selectionHint, setSelectionHint] = useState(false);

  const handleCardSelect = (candidate: Candidate) => {
    setSelectionHint(false);
    onSelectCandidate(candidate);
  };

  const handleConfirmPress = () => {
    if (!selectedCandidate) {
      setSelectionHint(true);
      return;
    }
    onProceed();
  };

  return (
    <div className="min-h-[100dvh] w-full flex flex-col justify-between bg-gradient-to-b from-[#C8E2B8] via-[#E5F0DC] to-[#F7F9F5] select-none">
      {/* Top Condensed Header (No Logo) */}
      <header className="relative w-full pt-5 sm:pt-7 pb-2 px-4">
        <div className="absolute right-4 top-3 z-10">
          <PWAStatusControls />
        </div>
        <div className="mx-auto max-w-2xl flex flex-col items-center text-center">
          <h1 className="font-condensed text-4xl sm:text-5xl font-extrabold tracking-tight text-[#0F172A] leading-none uppercase">
            SURAT SUARA
          </h1>
          <p className="mt-1.5 font-condensed text-xl sm:text-2xl font-bold tracking-wide text-[#0F172A] leading-tight uppercase">
            PEMILIHAN KEPALA DESA CURUGRENDENG
          </p>
          <p className="mt-1 text-sm sm:text-base font-medium text-[#1E293B] leading-snug">
            Minggu, 6 Desember 2026
          </p>
        </div>
      </header>

      {/* Main Ballot Cards */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-8 py-4 sm:py-6">
        <div className="w-full max-w-2xl grid grid-cols-2 gap-4 sm:gap-7 items-stretch">
          {candidates.map((candidate) => {
            const isSelected = selectedCandidate?.id === candidate.id;
            return (
              <button
                key={candidate.id}
                type="button"
                onClick={() => handleCardSelect(candidate)}
                aria-pressed={isSelected}
                className={`group relative flex flex-col items-center bg-white border-[3px] sm:border-4 border-[#0F172A] px-3 pt-2.5 pb-4 sm:px-5 sm:pt-3 sm:pb-5 transition-transform duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-600 cursor-pointer ${
                  isSelected
                    ? 'ring-4 sm:ring-[6px] ring-[#16A34A] shadow-[0_14px_30px_rgba(22,163,74,0.28)] -translate-y-1'
                    : 'hover:-translate-y-0.5 shadow-[0_6px_18px_rgba(15,23,42,0.08)]'
                }`}
              >
                {/* Selected Check Indicator */}
                {isSelected && (
                  <span
                    aria-label="Kandidat dipilih"
                    className="absolute top-2 right-2 sm:top-3 sm:right-3 inline-flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#16A34A] text-white shadow"
                  >
                    <Check className="w-4 h-4 sm:w-5 sm:h-5 stroke-[3]" />
                  </span>
                )}

                {/* Candidate Number */}
                <span className="text-2xl sm:text-3xl font-semibold text-[#0F172A] leading-none tabular-nums mb-2 sm:mb-3">
                  {candidate.number}
                </span>

                {/* Candidate Visual Frame */}
                <div className="relative w-full aspect-[266/316] overflow-hidden bg-[#DC0000]">
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

                {/* Candidate Name */}
                <span className="mt-3 sm:mt-4 text-sm sm:text-lg font-semibold text-center text-[#0F172A] leading-tight tracking-tight">
                  {candidate.name}
                </span>
              </button>
            );
          })}
        </div>

        {selectionHint && (
          <p
            role="alert"
            className="mt-4 text-sm sm:text-base font-bold text-[#DC2626] text-center"
          >
            Ketuk salah satu kartu kandidat terlebih dahulu untuk melanjutkan.
          </p>
        )}
      </main>

      {/* Full-Width Bottom Blue Banner */}
      <footer className="w-full shrink-0">
        <button
          type="button"
          onClick={handleConfirmPress}
          className="w-full min-h-[60px] sm:min-h-[72px] bg-[#1086E8] hover:bg-[#0D74CA] active:bg-[#0B62AC] font-condensed text-3xl sm:text-4xl font-extrabold tracking-wide uppercase text-white transition flex items-center justify-center cursor-pointer"
        >
          PILIH KANDIDAT INI
        </button>
      </footer>
    </div>
  );
};
