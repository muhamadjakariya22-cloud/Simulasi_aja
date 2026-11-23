import QRCode from 'qrcode';
import { Candidate, KtpVoterData } from '../types/voting';

function tlv(tag: string, value: string): string {
  const len = value.length.toString().padStart(2, '0');
  return `${tag}${len}${value}`;
}

/**
 * CRC-16/CCITT-FALSE used by EMVCo / QRIS specification (Tag 63).
 */
function computeCrc16Ccitt(input: string): string {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function sanitizeAscii(value: string, maxLen: number): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9 .\-]/g, '')
    .trim()
    .slice(0, maxLen);
}

export function buildBallotId(votedAt: Date): string {
  const year = votedAt.getFullYear();
  let seqNum = Math.floor(1 + Math.random() * 9999);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const current = Number(window.localStorage.getItem('pilkades_ballot_seq') || '0');
      const next = Number.isFinite(current) && current >= 0 ? current + 1 : 1;
      window.localStorage.setItem('pilkades_ballot_seq', String(next));
      seqNum = next;
    }
  } catch {
    // Fallback to random 4-digit code if storage is restricted
  }
  return `PILKADES-${year}-${seqNum.toString().padStart(4, '0')}`;
}

export function buildQrisPayload(
  candidate: Candidate,
  voter: KtpVoterData,
  ballotId: string,
  votedAt: Date
): string {
  const merchantAccountInfo =
    tlv('00', 'ID.CO.QRIS.WWW') +
    tlv('01', '9360091431234567890') +
    tlv('02', 'ID1020260001001') +
    tlv('03', 'UBE');

  const nmidInfo =
    tlv('00', 'ID.CO.QRIS.WWW') +
    tlv('02', 'ID2026CURUGRENDENG') +
    tlv('03', 'UBE');

  const refCandidate = sanitizeAscii(`NO${candidate.number}-${candidate.name}`, 25);
  const nikSuffix = voter.nik.length >= 4 ? voter.nik.slice(-4) : '0000';
  const timeCode =
    votedAt.getFullYear().toString() +
    (votedAt.getMonth() + 1).toString().padStart(2, '0') +
    votedAt.getDate().toString().padStart(2, '0') +
    votedAt.getHours().toString().padStart(2, '0') +
    votedAt.getMinutes().toString().padStart(2, '0');

  const additionalData =
    tlv('01', sanitizeAscii(ballotId, 25)) +
    tlv('05', refCandidate) +
    tlv('07', sanitizeAscii(`VOTER-${nikSuffix}-${timeCode}`, 25));

  const payloadWithoutCrc =
    tlv('00', '01') +
    tlv('01', '11') +
    tlv('26', merchantAccountInfo) +
    tlv('51', nmidInfo) +
    tlv('52', '9399') +
    tlv('53', '360') +
    tlv('58', 'ID') +
    tlv('59', 'DESA CURUGRENDENG') +
    tlv('60', 'SUBANG') +
    tlv('61', '41281') +
    tlv('62', additionalData) +
    '6304';

  const crc = computeCrc16Ccitt(payloadWithoutCrc);
  return payloadWithoutCrc + crc;
}

export async function generateQrisDataUrl(payload: string): Promise<string> {
  return QRCode.toDataURL(payload, {
    width: 360,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#0F172A',
      light: '#FFFFFF',
    },
  });
}
