import { KtpVoterData } from '../types/voting';

export type KtpValidationResult =
  | { valid: true; data: KtpVoterData }
  | { valid: false; reason: string };

const NON_KTP_PREFIXES = [
  /^https?:\/\//i,
  /^www\./i,
  /^ftp:\/\//i,
  /^wifi:/i,
  /^begin:(vcard|vevent|vcalendar)/i,
  /^(mailto|tel|smsto|sms|geo|matmsg|upi|bitcoin):/i,
  /^000201/, // QRIS / EMVCo payment QR
];

function isTrivialRepeatedDigits(value: string): boolean {
  return /^(\d)\1{15}$/.test(value);
}

function isValidSixteenDigitNik(candidate: string): boolean {
  const cleaned = candidate.replace(/\s+/g, '');
  if (!/^\d{16}$/.test(cleaned)) {
    return false;
  }
  if (isTrivialRepeatedDigits(cleaned)) {
    return false;
  }
  return true;
}

function extractLabeledField(text: string, labels: string[]): string | undefined {
  for (const label of labels) {
    const regex = new RegExp(`(?:^|[\\n;|,])\\s*${label}\\s*[:=\\-]\\s*([^\\n;|]+)`, 'i');
    const match = text.match(regex);
    if (match?.[1]?.trim()) {
      return match[1].trim();
    }
  }
  return undefined;
}

export function parseAndValidateKtpQr(rawText: string): KtpValidationResult {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return { valid: false, reason: 'QR kosong' };
  }

  for (const pattern of NON_KTP_PREFIXES) {
    if (pattern.test(trimmed)) {
      return { valid: false, reason: 'Bukan QR KTP' };
    }
  }

  // Reject product barcodes (8-15 digits) or overly long pure numbers (17+ digits)
  if (/^\d+$/.test(trimmed) && trimmed.length !== 16) {
    return { valid: false, reason: 'Bukan NIK 16 digit' };
  }

  // Case 1: Pure 16-digit NIK
  if (isValidSixteenDigitNik(trimmed)) {
    return {
      valid: true,
      data: {
        nik: trimmed,
        rawPayload: trimmed,
      },
    };
  }

  // Case 2: JSON payload converted from KTP data
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const lowerMap = new Map<string, string>();
        for (const [key, val] of Object.entries(parsed)) {
          if (typeof val === 'string' || typeof val === 'number') {
            lowerMap.set(key.trim().toLowerCase(), String(val).trim());
          }
        }

        const nikCandidate =
          lowerMap.get('nik') ??
          lowerMap.get('no_nik') ??
          lowerMap.get('nomor_nik') ??
          lowerMap.get('noktp') ??
          lowerMap.get('no_ktp');

        const nama = lowerMap.get('nama') ?? lowerMap.get('nama_lengkap') ?? lowerMap.get('name');
        const alamat = lowerMap.get('alamat') ?? lowerMap.get('address');
        const ttl =
          lowerMap.get('ttl') ??
          lowerMap.get('tempat_tgl_lahir') ??
          lowerMap.get('tempat_tanggal_lahir') ??
          lowerMap.get('tgl_lahir');

        const ktpFieldCount = [
          nikCandidate,
          nama,
          alamat,
          ttl,
          lowerMap.get('jenis_kelamin'),
          lowerMap.get('agama'),
          lowerMap.get('pekerjaan'),
          lowerMap.get('kelurahan'),
          lowerMap.get('kecamatan'),
          lowerMap.get('rt_rw'),
        ].filter(Boolean).length;

        if (nikCandidate && isValidSixteenDigitNik(nikCandidate)) {
          return {
            valid: true,
            data: {
              nik: nikCandidate.replace(/\s+/g, ''),
              nama,
              alamat,
              ttl,
              rawPayload: trimmed,
            },
          };
        }

        if (ktpFieldCount >= 2 && (nama || alamat || ttl)) {
          const fallbackNik = nikCandidate && /^\d{16}$/.test(nikCandidate) ? nikCandidate : 'TERVERIFIKASI-KTP';
          return {
            valid: true,
            data: {
              nik: fallbackNik,
              nama,
              alamat,
              ttl,
              rawPayload: trimmed,
            },
          };
        }
      }
    } catch {
      // Not valid JSON, continue checking structured text formats
    }
  }

  // Case 3: Structured labeled KTP text (e.g., "NIK: 3213...\nNama: ...\nAlamat: ...\nTTL: ...")
  const nikLabeledMatch = trimmed.match(/(?:^|[\n;|,\s])NIK\s*[:=\-]?\s*(\d{16})(?:\b|$)/i);
  const nama = extractLabeledField(trimmed, ['Nama\\s*Lengkap', 'Nama']);
  const alamat = extractLabeledField(trimmed, ['Alamat']);
  const ttl = extractLabeledField(trimmed, [
    'TTL',
    'Tempat\\s*\\/\\s*Tgl\\.?\\s*Lahir',
    'Tempat\\s*Tanggal\\s*Lahir',
    'Tgl\\.?\\s*Lahir',
  ]);
  const hasAdditionalKtpLabel = /(jenis\s*kelamin|gol\.?\s*darah|rt\s*\/\s*rw|kel\s*\/\s*desa|kecamatan|agama|status\s*perkawinan|pekerjaan|kewarganegaraan|berlaku\s*hingga)/i.test(
    trimmed
  );

  if (nikLabeledMatch?.[1] && isValidSixteenDigitNik(nikLabeledMatch[1])) {
    return {
      valid: true,
      data: {
        nik: nikLabeledMatch[1],
        nama,
        alamat,
        ttl,
        rawPayload: trimmed,
      },
    };
  }

  const labeledCount = [nama, alamat, ttl].filter(Boolean).length + (hasAdditionalKtpLabel ? 1 : 0);
  const embedded16DigitNik = trimmed.match(/(?:^|\D)(\d{16})(?:\D|$)/);

  if (embedded16DigitNik?.[1] && isValidSixteenDigitNik(embedded16DigitNik[1]) && labeledCount >= 1) {
    return {
      valid: true,
      data: {
        nik: embedded16DigitNik[1],
        nama,
        alamat,
        ttl,
        rawPayload: trimmed,
      },
    };
  }

  // Case 4: Pipe or semicolon delimited KTP record starting with 16-digit NIK
  if (trimmed.includes('|') || trimmed.includes(';')) {
    const parts = trimmed
      .split(/[|;]/)
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length >= 2 && isValidSixteenDigitNik(parts[0])) {
      return {
        valid: true,
        data: {
          nik: parts[0],
          nama: parts[1],
          ttl: parts[2],
          alamat: parts[3],
          rawPayload: trimmed,
        },
      };
    }
  }

  // Case 5: Full labeled KTP text without explicit numeric NIK (must contain at least 3 KTP-specific labels)
  if (labeledCount >= 3 && (nama || alamat)) {
    return {
      valid: true,
      data: {
        nik: 'TERVERIFIKASI-KTP',
        nama,
        alamat,
        ttl,
        rawPayload: trimmed,
      },
    };
  }

  return { valid: false, reason: 'Format bukan data KTP yang valid' };
}
