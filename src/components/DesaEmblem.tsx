import React from 'react';

interface DesaEmblemProps {
  className?: string;
}

export const DesaEmblem: React.FC<DesaEmblemProps> = ({ className = 'w-20 h-20' }) => {
  return (
    <svg
      viewBox="0 0 180 180"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Lambang Desa Maju Sejahtera"
    >
      {/* Outer Shield Border */}
      <path
        d="M90 12L152 34V86C152 126.5 125.6 155.4 90 168C54.4 155.4 28 126.5 28 86V34L90 12Z"
        fill="#14532D"
        stroke="#CA8A04"
        strokeWidth="5"
      />
      <path
        d="M90 20L144 39.5V86C144 121.6 120.8 147.5 90 159.2C59.2 147.5 36 121.6 36 86V39.5L90 20Z"
        fill="#15803D"
        stroke="#FDE047"
        strokeWidth="2"
      />

      {/* Five-pointed Star */}
      <path
        d="M90 30L94.4 42.6L107.6 42.9L97.1 50.9L100.9 63.5L90 56L79.1 63.5L82.9 50.9L72.4 42.9L85.6 42.6L90 30Z"
        fill="#FACC15"
        stroke="#FEF08A"
        strokeWidth="1.2"
      />

      {/* Village Pendopo / Balai Desa Roof & Pillars */}
      <path d="M62 84L90 68L118 84H62Z" fill="#FBBF24" stroke="#78350F" strokeWidth="1.5" />
      <rect x="69" y="84" width="42" height="22" fill="#FEF3C7" stroke="#78350F" strokeWidth="1.5" />
      <rect x="85" y="92" width="10" height="14" fill="#92400E" />
      <rect x="65" y="106" width="50" height="5" rx="2" fill="#CA8A04" />

      {/* Paddy Stalk (Left) */}
      <path d="M56 124C44 106 43 78 52 56" stroke="#FACC15" strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="47" cy="66" rx="4.5" ry="2.5" transform="rotate(-35 47 66)" fill="#FDE047" />
      <ellipse cx="45" cy="78" rx="4.5" ry="2.5" transform="rotate(-25 45 78)" fill="#FDE047" />
      <ellipse cx="46" cy="90" rx="4.5" ry="2.5" transform="rotate(-15 46 90)" fill="#FDE047" />
      <ellipse cx="49" cy="102" rx="4.5" ry="2.5" transform="rotate(-5 49 102)" fill="#FDE047" />
      <ellipse cx="53" cy="113" rx="4.5" ry="2.5" transform="rotate(10 53 113)" fill="#FDE047" />

      {/* Cotton Branch (Right) */}
      <path d="M124 124C136 106 137 78 128 56" stroke="#86EFAC" strokeWidth="3" strokeLinecap="round" />
      <circle cx="132" cy="66" r="4.5" fill="#FFFFFF" stroke="#166534" strokeWidth="1.2" />
      <circle cx="134" cy="79" r="4.5" fill="#FFFFFF" stroke="#166534" strokeWidth="1.2" />
      <circle cx="133" cy="92" r="4.5" fill="#FFFFFF" stroke="#166534" strokeWidth="1.2" />
      <circle cx="130" cy="105" r="4.5" fill="#FFFFFF" stroke="#166534" strokeWidth="1.2" />

      {/* Bottom Ribbon Banner */}
      <path
        d="M34 126C52 135 71 139 90 139C109 139 128 135 146 126L142 146C125 153 107 156 90 156C73 156 55 153 38 146L34 126Z"
        fill="#FACC15"
        stroke="#854D0E"
        strokeWidth="2"
      />
      <text
        x="90"
        y="147"
        textAnchor="middle"
        fill="#14532D"
        fontSize="9.2"
        fontWeight="800"
        letterSpacing="0.4"
        fontFamily="Barlow Condensed, Arial Narrow, sans-serif"
      >
        DESA MAJU SEJAHTERA
      </text>
    </svg>
  );
};
