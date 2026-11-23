import React from 'react';

interface CandidateSilhouetteProps {
  className?: string;
}

export const CandidateSilhouette: React.FC<CandidateSilhouetteProps> = ({ className = 'w-full h-full' }) => {
  return (
    <div className={`relative w-full h-full bg-[#DC0000] flex items-end justify-center overflow-hidden ${className}`}>
      <svg
        viewBox="0 0 266 316"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
        preserveAspectRatio="xMidYMax slice"
        aria-hidden="true"
      >
        {/* Head, ears, neck, and shoulders matching Layar 2 template silhouette */}
        <path
          d="M133 44C109 44 92 62 92 88C92 92 92.4 96 93 99.5C89.5 101 87.5 105.5 88.5 111.5C89.5 117 92.8 120.5 96.5 120.8C101 134 111 144 114 148L114 166C114 172 108 178 96 184L26 218C12 225 4 238 4 254V316H262V254C262 238 254 225 240 218L170 184C158 178 152 172 152 166L152 148C155 144 165 134 169.5 120.8C173.2 120.5 176.5 117 177.5 111.5C178.5 105.5 176.5 101 173 99.5C173.6 96 174 92 174 88C174 62 157 44 133 44Z"
          fill="#FFFFFF"
        />
      </svg>
    </div>
  );
};
