export type ScreenStep = 'scan' | 'ballot' | 'confirm' | 'qris';

export interface Candidate {
  id: string;
  number: '1' | '2';
  name: string;
  variant: 'silhouette' | 'photo';
  imageUrl?: string;
}

export interface KtpVoterData {
  nik: string;
  nama?: string;
  alamat?: string;
  ttl?: string;
  rawPayload: string;
}

export interface VoteReceipt {
  ballotId: string;
  candidate: Candidate;
  voter: KtpVoterData;
  votedAt: Date;
  qrisPayload: string;
  qrisDataUrl: string;
}
