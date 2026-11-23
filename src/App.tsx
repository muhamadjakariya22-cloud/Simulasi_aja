/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { CANDIDATES } from './data/candidates';
import { Candidate, KtpVoterData, ScreenStep, VoteReceipt } from './types/voting';
import { buildBallotId, buildQrisPayload, generateQrisDataUrl } from './utils/qrisGenerator';
import { Screen1Scanner } from './components/Screen1Scanner';
import { Screen2Ballot } from './components/Screen2Ballot';
import { Screen3Confirm } from './components/Screen3Confirm';
import { Screen4Qris } from './components/Screen4Qris';

export default function App() {
  const [screen, setScreen] = useState<ScreenStep>('scan');
  const [voterData, setVoterData] = useState<KtpVoterData | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [receipt, setReceipt] = useState<VoteReceipt | null>(null);
  const [isGeneratingQris, setIsGeneratingQris] = useState(false);

  const handleKtpVerified = (voter: KtpVoterData) => {
    setVoterData(voter);
    setSelectedCandidate(null);
    setReceipt(null);
    setScreen('ballot');
  };

  const handleConfirmVote = async () => {
    if (!selectedCandidate || !voterData || isGeneratingQris) return;
    setIsGeneratingQris(true);
    try {
      const votedAt = new Date();
      const ballotId = buildBallotId(votedAt);
      const qrisPayload = buildQrisPayload(selectedCandidate, voterData, ballotId, votedAt);
      const qrisDataUrl = await generateQrisDataUrl(qrisPayload);

      setReceipt({
        ballotId,
        candidate: selectedCandidate,
        voter: voterData,
        votedAt,
        qrisPayload,
        qrisDataUrl,
      });
      setScreen('qris');
    } finally {
      setIsGeneratingQris(false);
    }
  };

  const handleResetForNextVoter = () => {
    setVoterData(null);
    setSelectedCandidate(null);
    setReceipt(null);
    setScreen('scan');
  };

  if (screen === 'scan') {
    return <Screen1Scanner onKtpVerified={handleKtpVerified} />;
  }

  if (screen === 'ballot') {
    return (
      <Screen2Ballot
        candidates={CANDIDATES}
        selectedCandidate={selectedCandidate}
        onSelectCandidate={setSelectedCandidate}
        onProceed={() => {
          if (selectedCandidate) {
            setScreen('confirm');
          }
        }}
      />
    );
  }

  if (screen === 'confirm' && selectedCandidate) {
    return (
      <Screen3Confirm
        candidate={selectedCandidate}
        onRepeat={() => setScreen('ballot')}
        onConfirm={handleConfirmVote}
        isGenerating={isGeneratingQris}
      />
    );
  }

  if (screen === 'qris' && receipt) {
    return (
      <Screen4Qris
        receipt={receipt}
        onFinishAndScanNew={handleResetForNextVoter}
      />
    );
  }

  return <Screen1Scanner onKtpVerified={handleKtpVerified} />;
}
