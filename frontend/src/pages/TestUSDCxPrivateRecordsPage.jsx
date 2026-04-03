import { useMemo, useState } from 'react';
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/sonner';

const DEFAULT_PROGRAM_ID = 'test_usdcx_stablecoin.aleo';

function findNestedValueByKey(value, targetKeys, depth = 0) {
  if (depth > 5 || value == null) {
    return null;
  }

  if (typeof value === 'object') {
    for (const [key, nestedValue] of Object.entries(value)) {
      if (targetKeys.includes(key)) {
        return nestedValue;
      }

      const fromNested = findNestedValueByKey(nestedValue, targetKeys, depth + 1);
      if (fromNested !== null) {
        return fromNested;
      }
    }
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const fromNested = findNestedValueByKey(item, targetKeys, depth + 1);
      if (fromNested !== null) {
        return fromNested;
      }
    }
  }

  return null;
}

async function enrichRecord(record, decrypt) {
  if (!record || typeof record !== 'object') {
    return record;
  }

  if (typeof record.plaintext === 'string' && record.plaintext.trim()) {
    return record;
  }

  const ciphertext = typeof record.recordCiphertext === 'string'
    ? record.recordCiphertext
    : typeof record.record_ciphertext === 'string'
      ? record.record_ciphertext
      : null;

  if (!ciphertext || typeof decrypt !== 'function') {
    return record;
  }

  try {
    const plaintext = await decrypt(ciphertext);
    if (typeof plaintext === 'string' && plaintext.trim()) {
      return {
        ...record,
        plaintext,
      };
    }
  } catch {
    // Let the raw record surface if decrypt is unavailable.
  }

  return record;
}

function extractAmountU128(record) {
  const stringCandidates = [
    typeof record === 'string' ? record : null,
    typeof record?.plaintext === 'string' ? record.plaintext : null,
    typeof record?.record === 'string' ? record.record : null,
  ].filter(Boolean);

  for (const candidate of stringCandidates) {
    const amountMatch = candidate.match(/amount:\s*(\d+)u128/);
    if (amountMatch) {
      return amountMatch[1];
    }

    const genericMatch = candidate.match(/(\d+)u128/);
    if (genericMatch) {
      return genericMatch[1];
    }
  }

  const nestedAmount = findNestedValueByKey(record, ['amount', 'microcredits', 'value']);
  if (typeof nestedAmount === 'string') {
    const match = nestedAmount.match(/^(\d+)u128$/);
    if (match) {
      return match[1];
    }
  }

  return null;
}

function extractOwner(record) {
  const stringCandidates = [
    typeof record?.plaintext === 'string' ? record.plaintext : null,
    typeof record?.record === 'string' ? record.record : null,
  ].filter(Boolean);

  for (const candidate of stringCandidates) {
    const ownerMatch = candidate.match(/owner:\s*([^,\n}]+)/);
    if (ownerMatch) {
      return ownerMatch[1].trim();
    }
  }

  const nestedOwner = findNestedValueByKey(record, ['owner']);
  return typeof nestedOwner === 'string' ? nestedOwner : null;
}

function extractIdentity(record) {
  const candidates = [
    record?.serialNumber,
    record?.serial_number,
    record?.commitment,
    record?.tag,
    record?.id,
    record?.recordCiphertext,
    record?.record_ciphertext,
  ];

  const match = candidates.find((value) => typeof value === 'string' && value.trim());
  return match ? match.trim() : null;
}

function detectProofHints(record) {
  const hints = [];

  const pushHint = (label, value) => {
    if (value == null) {
      return;
    }

    hints.push(`${label}: ${typeof value === 'string' ? value : JSON.stringify(value)}`);
  };

  pushHint('proof', record?.proof);
  pushHint('proofs', record?.proofs);
  pushHint('merkleProof', record?.merkleProof);
  pushHint('merkle_proof', record?.merkle_proof);
  pushHint('leaf_index', record?.leaf_index);
  pushHint('siblings', record?.siblings);

  return hints;
}

function formatAmountDisplay(amountRaw) {
  if (!amountRaw) {
    return 'Unknown';
  }

  const amount = Number(amountRaw);
  if (!Number.isFinite(amount)) {
    return `${amountRaw} micro-USDCx`;
  }

  return `${amount / 1_000_000} USDCx (${amountRaw}u128)`;
}

export default function TestUSDCxPrivateRecordsPage() {
  const { connected, address, requestRecords, decrypt } = useWallet();
  const [programId, setProgramId] = useState(DEFAULT_PROGRAM_ID);
  const [isLoading, setIsLoading] = useState(false);
  const [records, setRecords] = useState([]);
  const [error, setError] = useState(null);

  const summaries = useMemo(() => (
    records.map((record, index) => ({
      index,
      identity: extractIdentity(record),
      amountRaw: extractAmountU128(record),
      owner: extractOwner(record),
      proofHints: detectProofHints(record),
      topLevelKeys: record && typeof record === 'object' ? Object.keys(record) : [],
      plaintext: typeof record?.plaintext === 'string' ? record.plaintext : null,
      raw: record,
    }))
  ), [records]);

  const handleRequestRecords = async () => {
    if (!connected) {
      toast.error('Please connect your wallet first');
      return;
    }

    if (!programId.trim()) {
      toast.error('Program id is required');
      return;
    }

    setIsLoading(true);
    setError(null);
    setRecords([]);

    try {
      const response = await requestRecords(programId.trim(), true);
      const baseRecords = Array.isArray(response)
        ? response
        : Array.isArray(response?.records)
          ? response.records
          : [];

      const enrichedRecords = await Promise.all(
        baseRecords.map((record) => enrichRecord(record, decrypt))
      );

      setRecords(enrichedRecords);
      toast.success(`Loaded ${enrichedRecords.length} private record(s) from ${programId.trim()}`);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : String(requestError);
      setError(message);
      toast.error(`Failed to request records: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-4xl font-bold tracking-tight text-white md:text-5xl">
          Test USDCx Private Records
        </h1>
        <p className="mt-2 text-sm text-slate-300 md:text-base">
          Query Shield for private records from <code>{DEFAULT_PROGRAM_ID}</code> and inspect whether the wallet exposes plaintext,
          identities, and any proof hints we can use for the next v2.23 spike.
        </p>
      </div>

      <Card className="border-blue-500/20 bg-blue-950/30">
        <CardHeader>
          <CardTitle className="text-blue-200">Connected Wallet</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-blue-100">
          <p><strong>Status:</strong> {connected ? 'Connected' : 'Not connected'}</p>
          <p><strong>Address:</strong></p>
          <p className="break-all font-mono text-xs">{address || 'Not connected'}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Request Records</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="program-id">Program ID</Label>
            <Input
              id="program-id"
              value={programId}
              onChange={(event) => setProgramId(event.target.value)}
              placeholder="test_usdcx_stablecoin.aleo"
              disabled={isLoading}
            />
            <p className="mt-1 text-xs text-slate-400">
              Default target is <code>{DEFAULT_PROGRAM_ID}</code>.
            </p>
          </div>

          <Button onClick={handleRequestRecords} disabled={!connected || isLoading}>
            {isLoading ? 'Requesting Records...' : 'Request Private Records'}
          </Button>

          {error && (
            <div className="rounded-lg border border-red-500/20 bg-red-950/30 p-3 text-sm text-red-100">
              <strong>Error:</strong> {error}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-amber-500/20 bg-amber-950/30">
        <CardHeader>
          <CardTitle className="text-amber-200">What We Need For The Spike</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-amber-100">
          <p>The ideal result here is:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>at least one private <code>USDCx</code> record is returned</li>
            <li>we can read the amount and owner from plaintext or decrypt output</li>
            <li>the returned object includes enough identity/proof data to drive <code>get_creds</code> and <code>xfer_with_creds</code></li>
          </ul>
          <p>If records appear but no proof data appears, the next blocker is wallet export capability, not contract logic.</p>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {summaries.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-slate-300">
              No records loaded yet.
            </CardContent>
          </Card>
        ) : (
          summaries.map((summary) => (
            <Card key={summary.identity || summary.index}>
              <CardHeader>
                <CardTitle className="text-lg">
                  Record {summary.index + 1}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-200">
                <p><strong>Amount:</strong> {formatAmountDisplay(summary.amountRaw)}</p>
                <p><strong>Owner:</strong> <span className="font-mono break-all">{summary.owner || 'Unknown'}</span></p>
                <p><strong>Identity:</strong> <span className="font-mono break-all">{summary.identity || 'No identity field exposed'}</span></p>
                <p><strong>Top-level keys:</strong> {summary.topLevelKeys.length > 0 ? summary.topLevelKeys.join(', ') : 'None'}</p>
                <div>
                  <p><strong>Proof hints:</strong></p>
                  {summary.proofHints.length > 0 ? (
                    <ul className="list-disc list-inside space-y-1">
                      {summary.proofHints.map((hint) => (
                        <li key={hint} className="break-all font-mono text-xs">{hint}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-400">No proof-like fields exposed at the top level.</p>
                  )}
                </div>
                <div>
                  <p><strong>Plaintext:</strong></p>
                  <pre className="overflow-x-auto rounded bg-slate-950/70 p-3 text-xs text-slate-100">
                    {summary.plaintext || 'No plaintext exposed'}
                  </pre>
                </div>
                <div>
                  <p><strong>Raw JSON:</strong></p>
                  <pre className="overflow-x-auto rounded bg-slate-950/70 p-3 text-xs text-slate-100">
                    {JSON.stringify(summary.raw, null, 2)}
                  </pre>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
