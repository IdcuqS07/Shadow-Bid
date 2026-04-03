import { useEffect, useMemo, useState } from 'react';
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react';
import { WalletMultiButton } from '@provablehq/aleo-wallet-adaptor-react-ui';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/sonner';
import { DecryptPermission } from '@provablehq/aleo-wallet-adaptor-core';
import { waitForTransactionConfirmation } from '@/services/aleoServiceV2';
import {
  clearStoredWalletDecryptPermission,
  getStoredWalletDecryptPermission,
  getWalletDecryptPermissionLabel,
  setStoredWalletDecryptPermission,
} from '@/wallets/walletPermissionMode';

const WALLET_CONTEXT_FUNCTIONS = [
  'connect',
  'disconnect',
  'executeTransaction',
  'transactionStatus',
  'signMessage',
  'switchNetwork',
  'decrypt',
  'requestRecords',
  'executeDeployment',
  'transitionViewKeys',
  'requestTransactionHistory',
];

const SHIELD_METHODS = [
  'connect',
  'disconnect',
  'signMessage',
  'decrypt',
  'executeTransaction',
  'transactionStatus',
  'switchNetwork',
  'requestRecords',
  'executeDeployment',
  'transitionViewKeys',
  'requestTransactionHistory',
];

const DEFAULT_PROOFS_INPUT = `[
  { siblings: [<16 field siblings>], leaf_index: <u32> },
  { siblings: [<16 field siblings>], leaf_index: <u32> }
]`;

const DEFAULT_TOKEN_RECORD = `{
  owner: <wallet-address>.private,
  amount: 4500000u128.private,
  _nonce: <group-element>.public,
  _version: 1u8.public
}`;

const DEFAULT_CREDENTIALS_RECORD = `{
  owner: <wallet-address>.private,
  freeze_list_root: <freeze-list-root>field.private,
  _nonce: <group-element>.public,
  _version: 1u8.public
}`;
const DEFAULT_HISTORY_PROGRAM = 'test_usdcx_stablecoin.aleo';

function safeStringify(value) {
  const seen = new WeakSet();

  return JSON.stringify(
    value,
    (key, currentValue) => {
      if (typeof currentValue === 'bigint') {
        return `${currentValue}n`;
      }

      if (typeof currentValue === 'function') {
        return `[Function ${currentValue.name || 'anonymous'}]`;
      }

      if (typeof currentValue === 'undefined') {
        return '[undefined]';
      }

      if (currentValue && typeof currentValue === 'object') {
        if (seen.has(currentValue)) {
          return '[Circular]';
        }
        seen.add(currentValue);
      }

      return currentValue;
    },
    2
  );
}

function collectRuntimeKeys(target) {
  if (!target || (typeof target !== 'object' && typeof target !== 'function')) {
    return [];
  }

  const names = new Set(Object.keys(target));
  let prototype = Object.getPrototypeOf(target);
  let depth = 0;

  while (prototype && prototype !== Object.prototype && depth < 4) {
    for (const name of Object.getOwnPropertyNames(prototype)) {
      if (name !== 'constructor') {
        names.add(name);
      }
    }

    prototype = Object.getPrototypeOf(prototype);
    depth += 1;
  }

  return [...names].sort((left, right) => left.localeCompare(right));
}

function describeValue(value) {
  if (value == null) {
    return 'missing';
  }

  if (Array.isArray(value)) {
    return `array(${value.length})`;
  }

  return typeof value;
}

function hasConcreteValue(value) {
  return typeof value === 'string' && value.trim() && !value.includes('<');
}

function isShieldAdapterName(name) {
  return typeof name === 'string' && name.toLowerCase().includes('shield');
}

function parseFeeValue(value) {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) {
    return null;
  }

  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

function formatExecutionError(error) {
  if (error instanceof Error) {
    return {
      name: error.name || 'Error',
      message: error.message || 'Unknown error',
      stack: error.stack || null,
    };
  }

  if (typeof error === 'string') {
    return {
      name: 'Error',
      message: error,
      stack: null,
    };
  }

  return {
    name: 'Error',
    message: 'Unknown wallet execution error',
    stack: null,
    raw: error,
  };
}

function classifyExecutionError(message) {
  const normalized = typeof message === 'string' ? message.toLowerCase() : '';

  if (!normalized) {
    return 'Unknown';
  }

  if (
    normalized.includes('reject')
    || normalized.includes('denied')
    || normalized.includes('declin')
    || normalized.includes('cancel')
  ) {
    return 'Likely wallet approval rejection';
  }

  if (
    normalized.includes('not connected')
    || normalized.includes('wallet not available')
    || normalized.includes('wallet not selected')
  ) {
    return 'Likely wallet session issue';
  }

  if (
    normalized.includes('fee')
    || normalized.includes('credits')
    || normalized.includes('insufficient')
  ) {
    return 'Possible fee or balance issue';
  }

  if (
    normalized.includes('input')
    || normalized.includes('record')
    || normalized.includes('proof')
    || normalized.includes('siblings')
    || normalized.includes('leaf_index')
    || normalized.includes('field')
    || normalized.includes('literal')
    || normalized.includes('parse')
    || normalized.includes('invalid')
  ) {
    return 'Likely input or proof shape issue';
  }

  return 'Unclassified wallet/runtime error';
}

function looksLikeOnChainTransactionId(transactionId) {
  return typeof transactionId === 'string' && transactionId.startsWith('at1');
}

function normalizeWalletTransactionStatus(status) {
  const normalized = typeof status === 'string' ? status.trim().toLowerCase() : '';

  if (!normalized) {
    return 'unknown';
  }

  if (normalized.includes('reject') || normalized.includes('fail') || normalized.includes('error')) {
    return 'rejected';
  }

  if (
    normalized.includes('accept')
    || normalized.includes('final')
    || normalized.includes('complete')
    || normalized.includes('success')
  ) {
    return 'accepted';
  }

  if (normalized.includes('pending') || normalized.includes('process')) {
    return 'pending';
  }

  return normalized;
}

function resolveTransitionViewKeyTransactionId(inputTransactionId, followUpStatus) {
  const trimmedInput = typeof inputTransactionId === 'string' ? inputTransactionId.trim() : '';

  if (
    followUpStatus?.inputTransactionId === trimmedInput
    && looksLikeOnChainTransactionId(followUpStatus?.explorerTransactionId)
  ) {
    return followUpStatus.explorerTransactionId;
  }

  if (looksLikeOnChainTransactionId(trimmedInput)) {
    return trimmedInput;
  }

  return trimmedInput;
}

function captureRuntimeSnapshot(selectedWallet, availableWallets) {
  if (typeof window === 'undefined') {
    return {
      capturedAt: null,
      detectedExtensions: {},
      shieldKeys: [],
      adapterKeys: [],
      selectedWalletKeys: [],
      debugHistory: [],
      latestDebugEntry: null,
      shieldMethodAvailability: [],
      availableWallets: [],
    };
  }

  const shieldRuntime = window.shield;
  const walletDebugApi = window.__shadowbidWalletDebug;
  const debugHistory = Array.isArray(walletDebugApi?.history) ? walletDebugApi.history : [];

  return {
    capturedAt: new Date().toISOString(),
    detectedExtensions: {
      shield: Boolean(window.shield),
      puzzle: Boolean(window.puzzle),
      leo: Boolean(window.leo),
      foxwallet: Boolean(window.foxwallet),
      soter: Boolean(window.soter),
    },
    shieldKeys: collectRuntimeKeys(shieldRuntime),
    adapterKeys: collectRuntimeKeys(selectedWallet?.adapter),
    selectedWalletKeys: collectRuntimeKeys(selectedWallet),
    debugHistory,
    latestDebugEntry: debugHistory[debugHistory.length - 1] ?? null,
    shieldMethodAvailability: SHIELD_METHODS.map((name) => ({
      name,
      available: typeof shieldRuntime?.[name] === 'function',
    })),
    availableWallets: Array.isArray(availableWallets)
      ? availableWallets.map((entry) => ({
          name: entry?.adapter?.name ?? 'Unknown',
          readyState: entry?.readyState ?? 'Unknown',
          selected: selectedWallet?.adapter?.name === entry?.adapter?.name,
        }))
      : [],
  };
}

function StatusBadge({ ready, readyLabel = 'Available', missingLabel = 'Missing' }) {
  return (
    <Badge
      variant="outline"
      className={ready
        ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
        : 'border-rose-400/30 bg-rose-500/10 text-rose-200'}
    >
      {ready ? readyLabel : missingLabel}
    </Badge>
  );
}

function AttemptResultPanel({ result }) {
  if (!result) {
    return (
      <div className="rounded-lg border border-dashed border-white/10 bg-slate-900/30 p-4 text-sm text-slate-400">
        No execution attempt yet.
      </div>
    );
  }

  if (result.status === 'success') {
    return (
      <div className="rounded-lg border border-emerald-400/20 bg-emerald-950/20 p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-emerald-100">Transaction submitted</p>
          <StatusBadge ready={true} readyLabel="Success" />
        </div>
        <p className="mt-2 text-xs text-emerald-200/80">{result.attemptedAt}</p>
        <pre className="mt-3 overflow-x-auto whitespace-pre-wrap font-mono text-xs text-emerald-100">
          {safeStringify(result)}
        </pre>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-rose-400/20 bg-rose-950/20 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-rose-100">Execution failed</p>
        <StatusBadge ready={false} readyLabel="Success" missingLabel="Error" />
      </div>
      <p className="mt-2 text-xs text-rose-200/80">{result.attemptedAt}</p>
      <p className="mt-3 text-xs uppercase tracking-[0.2em] text-rose-200/70">Likely cause (inferred)</p>
      <p className="mt-1 text-sm text-rose-100">{result.classification}</p>
      <pre className="mt-3 overflow-x-auto whitespace-pre-wrap font-mono text-xs text-rose-100">
        {safeStringify(result)}
      </pre>
    </div>
  );
}

export default function TestUSDCxWalletCapabilitiesPage() {
  const walletContext = useWallet();
  const {
    address,
    connected,
    connecting,
    disconnecting,
    reconnecting,
    network,
    wallet,
    wallets,
    selectWallet,
    executeTransaction,
    disconnect,
    requestRecords,
    requestTransactionHistory,
    transactionStatus,
    transitionViewKeys,
  } = walletContext;

  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('4500000u128');
  const [splitAmount, setSplitAmount] = useState('1000000u128');
  const [fee, setFee] = useState('1000000');
  const [privateFee, setPrivateFee] = useState(false);
  const [tokenRecord, setTokenRecord] = useState(DEFAULT_TOKEN_RECORD);
  const [credentialsRecord, setCredentialsRecord] = useState(DEFAULT_CREDENTIALS_RECORD);
  const [proofsInput, setProofsInput] = useState(DEFAULT_PROOFS_INPUT);
  const [runtimeSnapshot, setRuntimeSnapshot] = useState(() => captureRuntimeSnapshot(wallet, wallets));
  const [pendingExecution, setPendingExecution] = useState(null);
  const [executionResults, setExecutionResults] = useState({
    splitToken: null,
    getCreds: null,
    xferWithCreds: null,
  });
  const [followUpTransactionId, setFollowUpTransactionId] = useState('');
  const [followUpStatus, setFollowUpStatus] = useState(null);
  const [followUpStatusLoading, setFollowUpStatusLoading] = useState(false);
  const [viewKeysResult, setViewKeysResult] = useState(null);
  const [viewKeysLoading, setViewKeysLoading] = useState(false);
  const [historyProgramId, setHistoryProgramId] = useState(DEFAULT_HISTORY_PROGRAM);
  const [historyResult, setHistoryResult] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [walletPermissionMode, setWalletPermissionMode] = useState(() => getStoredWalletDecryptPermission());

  useEffect(() => {
    if (address && !recipient.trim()) {
      setRecipient(address);
    }
  }, [address, recipient]);

  useEffect(() => {
    setWalletPermissionMode(getStoredWalletDecryptPermission());
  }, [connected]);

  useEffect(() => {
    const successfulTransactionIds = Object.values(executionResults)
      .filter((entry) => entry?.status === 'success' && typeof entry?.transactionId === 'string' && entry.transactionId.trim())
      .sort((left, right) => Date.parse(right?.attemptedAt ?? 0) - Date.parse(left?.attemptedAt ?? 0));

    const latestTransactionId = successfulTransactionIds[0]?.transactionId ?? '';
    if (latestTransactionId) {
      setFollowUpTransactionId((current) => (current.trim() ? current : latestTransactionId));
    }
  }, [executionResults]);

  useEffect(() => {
    setRuntimeSnapshot(captureRuntimeSnapshot(wallet, wallets));
  }, [wallet, wallets, connected, connecting, disconnecting, reconnecting, address, network]);

  const walletCapabilities = useMemo(() => (
    WALLET_CONTEXT_FUNCTIONS.map((name) => ({
      name,
      available: typeof walletContext[name] === 'function',
      runtimeType: describeValue(walletContext[name]),
    }))
  ), [walletContext]);

  const parsedFee = useMemo(() => parseFeeValue(fee), [fee]);

  const readinessChecks = useMemo(() => ([
    {
      label: 'Shield selected as active wallet',
      ready: isShieldAdapterName(wallet?.adapter?.name),
      detail: wallet?.adapter?.name
        ? `Current adapter: ${wallet.adapter.name}`
        : 'No active wallet adapter selected yet.',
    },
    {
      label: 'Wallet connected',
      ready: connected,
      detail: connected ? `Connected address: ${address}` : 'Connect Shield before testing private execution.',
    },
    {
      label: 'executeTransaction callable from useWallet',
      ready: typeof executeTransaction === 'function',
      detail: 'Needed to attempt get_creds or xfer_with_creds from the browser.',
    },
    {
      label: 'requestRecords callable from useWallet',
      ready: typeof requestRecords === 'function',
      detail: 'Needed to pull Token.record plaintext or ciphertext candidates from Shield.',
    },
    {
      label: 'window.shield detected in browser',
      ready: runtimeSnapshot.detectedExtensions.shield,
      detail: runtimeSnapshot.detectedExtensions.shield
        ? 'Shield extension object is present on window.'
        : 'Browser page does not currently expose window.shield.',
    },
    {
      label: 'Token.record pasted into staging area',
      ready: hasConcreteValue(tokenRecord),
      detail: hasConcreteValue(tokenRecord)
        ? 'Token record looks concrete enough for a real executeTransaction call.'
        : 'Still contains placeholders. Paste plaintext from requestRecords output.',
    },
    {
      label: 'Credentials.record pasted into staging area',
      ready: hasConcreteValue(credentialsRecord),
      detail: hasConcreteValue(credentialsRecord)
        ? 'Credentials record is ready for xfer_with_creds staging.'
        : 'Still blocked. This record usually comes from get_creds output.',
    },
    {
      label: '[MerkleProof; 2u32] pasted into staging area',
      ready: hasConcreteValue(proofsInput),
      detail: hasConcreteValue(proofsInput)
        ? 'Proof skeleton has been replaced with a concrete value.'
        : 'Still blocked. Public mappings alone did not provide enough proof data.',
    },
    {
      label: 'Execution fee is a valid integer',
      ready: parsedFee !== null,
      detail: parsedFee !== null
        ? `Current fee: ${parsedFee} microcredits`
        : 'Fee must be a non-negative integer before executeTransaction can be attempted.',
    },
  ]), [
    wallet,
    connected,
    address,
    executeTransaction,
    requestRecords,
    runtimeSnapshot.detectedExtensions.shield,
    tokenRecord,
    credentialsRecord,
    proofsInput,
    parsedFee,
  ]);

  const stagedPayloads = useMemo(() => ({
    probeGetCreds: {
      program: 'shadowbid_usdcx_private_probe_v1.aleo',
      function: 'get_creds',
      inputs: [proofsInput.trim() || '<proof-array>'],
      fee: parsedFee ?? (fee.trim() || '<invalid-fee>'),
      privateFee,
      note: 'Non-executable skeleton until the [MerkleProof; 2u32] placeholders are replaced.',
    },
    stablecoinSplit: {
      program: 'test_usdcx_stablecoin.aleo',
      function: 'split',
      inputs: [
        tokenRecord.trim() || '<Token.record>',
        splitAmount.trim() || '<split-amount>u128',
      ],
      fee: parsedFee ?? (fee.trim() || '<invalid-fee>'),
      privateFee,
      note: 'State-changing probe. This spends the current private Token.record and creates two new Token records.',
    },
    probeXferWithCreds: {
      program: 'shadowbid_usdcx_private_probe_v1.aleo',
      function: 'xfer_with_creds',
      inputs: [
        recipient.trim() || '<recipient address>',
        amount.trim() || '<amount>u128',
        tokenRecord.trim() || '<Token.record>',
        credentialsRecord.trim() || '<Credentials.record>',
      ],
      fee: parsedFee ?? (fee.trim() || '<invalid-fee>'),
      privateFee,
      note: 'Use a real token record and credentials record plaintext before executing.',
    },
  }), [proofsInput, recipient, amount, splitAmount, tokenRecord, credentialsRecord, parsedFee, fee, privateFee]);

  const recentDebugEntries = useMemo(() => (
    [...runtimeSnapshot.debugHistory].slice(-8).reverse()
  ), [runtimeSnapshot.debugHistory]);
  const historyTransactions = useMemo(() => (
    Array.isArray(historyResult?.transactions) ? historyResult.transactions : []
  ), [historyResult]);
  const hasOnChainHistoryPermission = walletPermissionMode === DecryptPermission.OnChainHistory;

  const canAttemptSplitToken = connected
    && typeof executeTransaction === 'function'
    && splitAmount.trim()
    && hasConcreteValue(tokenRecord)
    && parsedFee !== null;
  const canAttemptGetCreds = connected && typeof executeTransaction === 'function' && hasConcreteValue(proofsInput) && parsedFee !== null;
  const canAttemptXferWithCreds = connected
    && typeof executeTransaction === 'function'
    && recipient.trim()
    && amount.trim()
    && hasConcreteValue(tokenRecord)
    && hasConcreteValue(credentialsRecord)
    && parsedFee !== null;

  const handleRefreshSnapshot = () => {
    setRuntimeSnapshot(captureRuntimeSnapshot(wallet, wallets));
    toast.success('Runtime snapshot refreshed');
  };

  const handleCopy = async (label, value) => {
    try {
      if (!navigator?.clipboard?.writeText) {
        throw new Error('Clipboard API is not available in this browser');
      }

      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied to clipboard`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to copy ${label}: ${message}`);
    }
  };

  const handleSeedWalletAddress = () => {
    if (!address) {
      toast.error('Connect a wallet first so the page can seed the address placeholders');
      return;
    }

    setRecipient(address);
    setTokenRecord((current) => current.replaceAll('<wallet-address>', address));
    setCredentialsRecord((current) => current.replaceAll('<wallet-address>', address));
    toast.success('Inserted the connected wallet address into the staging inputs');
  };

  const handleAttemptExecution = async (kind) => {
    if (typeof executeTransaction !== 'function') {
      toast.error('executeTransaction is not available on this wallet session');
      return;
    }

    if (!connected) {
      toast.error('Connect Shield before attempting a private execution');
      return;
    }

    if (parsedFee === null) {
      toast.error('Fee must be a non-negative integer');
      return;
    }

    if (kind === 'getCreds' && !hasConcreteValue(proofsInput)) {
      toast.error('Paste a concrete [MerkleProof; 2u32] value before attempting get_creds');
      return;
    }

    if (kind === 'splitToken') {
      if (!splitAmount.trim()) {
        toast.error('Split amount is required');
        return;
      }

      if (!hasConcreteValue(tokenRecord)) {
        toast.error('Paste a concrete Token.record plaintext before attempting split');
        return;
      }
    }

    if (kind === 'xferWithCreds') {
      if (!recipient.trim() || !amount.trim()) {
        toast.error('Recipient and amount are required for xfer_with_creds');
        return;
      }

      if (!hasConcreteValue(tokenRecord)) {
        toast.error('Paste a concrete Token.record plaintext before attempting xfer_with_creds');
        return;
      }

      if (!hasConcreteValue(credentialsRecord)) {
        toast.error('Paste a concrete Credentials.record plaintext before attempting xfer_with_creds');
        return;
      }
    }

    const basePayload = kind === 'getCreds'
      ? stagedPayloads.probeGetCreds
      : kind === 'splitToken'
        ? stagedPayloads.stablecoinSplit
        : stagedPayloads.probeXferWithCreds;
    const payload = {
      ...basePayload,
      fee: parsedFee,
      privateFee,
    };

    setPendingExecution(kind);
    toast.info(`Requesting ${payload.function} from Shield...`);

    try {
      const result = await executeTransaction(payload);
      const nextResult = {
        status: 'success',
        attemptedAt: new Date().toISOString(),
        transactionId: result?.transactionId ?? null,
        payload,
        rawResult: result ?? null,
      };

      setExecutionResults((current) => ({
        ...current,
        [kind]: nextResult,
      }));

      toast.success(`${payload.function} submitted${result?.transactionId ? `: ${result.transactionId.slice(0, 16)}...` : ''}`);
    } catch (error) {
      const formattedError = formatExecutionError(error);
      const nextResult = {
        status: 'error',
        attemptedAt: new Date().toISOString(),
        classification: classifyExecutionError(formattedError.message),
        payload,
        error: formattedError,
      };

      setExecutionResults((current) => ({
        ...current,
        [kind]: nextResult,
      }));

      toast.error(`${payload.function} failed: ${formattedError.message}`);
    } finally {
      setPendingExecution(null);
    }
  };

  const handleUseLatestSubmittedTransaction = () => {
    const latestTransactionId = Object.values(executionResults)
      .filter((entry) => entry?.status === 'success' && typeof entry?.transactionId === 'string' && entry.transactionId.trim())
      .sort((left, right) => Date.parse(right?.attemptedAt ?? 0) - Date.parse(left?.attemptedAt ?? 0))[0]?.transactionId;

    if (!latestTransactionId) {
      toast.error('No successful submitted transaction is available yet');
      return;
    }

    setFollowUpTransactionId(latestTransactionId);
    toast.success('Loaded the latest submitted wallet transaction id');
  };

  const handleCheckTransactionStatus = async (transactionId = followUpTransactionId) => {
    if (typeof transactionStatus !== 'function') {
      toast.error('transactionStatus is not available on this wallet session');
      return;
    }

    const trimmedTransactionId = typeof transactionId === 'string' ? transactionId.trim() : '';
    if (!trimmedTransactionId) {
      toast.error('Enter a wallet transaction id first');
      return;
    }

    setFollowUpStatusLoading(true);

    try {
      const walletResult = await transactionStatus(trimmedTransactionId);
      const walletStatus = normalizeWalletTransactionStatus(walletResult?.status);
      const explorerTransactionId = looksLikeOnChainTransactionId(walletResult?.transactionId)
        ? walletResult.transactionId
        : looksLikeOnChainTransactionId(trimmedTransactionId)
          ? trimmedTransactionId
          : null;

      let explorerResult = null;
      if (explorerTransactionId) {
        try {
          explorerResult = await waitForTransactionConfirmation(explorerTransactionId, {
            attempts: 4,
            intervalMs: 1500,
          });
        } catch (error) {
          explorerResult = {
            status: 'unknown',
            error: error instanceof Error ? error.message : String(error),
          };
        }
      }

      const nextStatus = {
        checkedAt: new Date().toISOString(),
        inputTransactionId: trimmedTransactionId,
        walletStatus,
        explorerTransactionId,
        finalStatus: explorerResult?.status || walletStatus,
        walletResult,
        explorerResult,
      };

      setFollowUpStatus(nextStatus);
      toast.success(`Transaction status checked: ${nextStatus.finalStatus}`);
    } catch (error) {
      const formattedError = formatExecutionError(error);
      const nextStatus = {
        checkedAt: new Date().toISOString(),
        inputTransactionId: trimmedTransactionId,
        finalStatus: 'error',
        error: formattedError,
      };

      setFollowUpStatus(nextStatus);
      toast.error(`Failed to check transaction status: ${formattedError.message}`);
    } finally {
      setFollowUpStatusLoading(false);
    }
  };

  const handleReconnectWithPermission = async (permission) => {
    const nextPermission = permission || DecryptPermission.UponRequest;

    try {
      if (connected && typeof disconnect === 'function') {
        await disconnect();
      }
    } catch {
      // Continue so the permission mode can still be updated and retried after reload.
    }

    if (nextPermission === DecryptPermission.UponRequest) {
      clearStoredWalletDecryptPermission();
    } else {
      setStoredWalletDecryptPermission(nextPermission);
    }

    setWalletPermissionMode(nextPermission);
    toast.info(`Reloading with ${getWalletDecryptPermissionLabel(nextPermission)} permission...`);

    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  const handleFetchTransitionViewKeys = async (transactionId = followUpTransactionId) => {
    if (typeof transitionViewKeys !== 'function') {
      toast.error('transitionViewKeys is not available on this wallet session');
      return;
    }

    const requestedTransactionId = typeof transactionId === 'string' ? transactionId.trim() : '';
    if (!requestedTransactionId) {
      toast.error('Enter a wallet transaction id first');
      return;
    }

    const resolvedTransactionId = resolveTransitionViewKeyTransactionId(requestedTransactionId, followUpStatus);

    setViewKeysLoading(true);

    try {
      const keys = await transitionViewKeys(resolvedTransactionId);
      const nextResult = {
        fetchedAt: new Date().toISOString(),
        inputTransactionId: requestedTransactionId,
        resolvedTransactionId,
        count: Array.isArray(keys) ? keys.length : 0,
        keys: Array.isArray(keys) ? keys : [],
      };

      setViewKeysResult(nextResult);
      toast.success(`Loaded ${nextResult.count} transition view key(s)`);
    } catch (error) {
      const formattedError = formatExecutionError(error);
      const nextResult = {
        fetchedAt: new Date().toISOString(),
        inputTransactionId: requestedTransactionId,
        resolvedTransactionId,
        error: formattedError,
      };

      setViewKeysResult(nextResult);
      toast.error(`Failed to load transition view keys: ${formattedError.message}`);
    } finally {
      setViewKeysLoading(false);
    }
  };

  const handleLoadTransactionHistory = async () => {
    if (typeof requestTransactionHistory !== 'function') {
      toast.error('requestTransactionHistory is not available on this wallet session');
      return;
    }

    const trimmedProgramId = historyProgramId.trim();
    if (!trimmedProgramId) {
      toast.error('Program id is required to load history');
      return;
    }

    setHistoryLoading(true);

    try {
      const result = await requestTransactionHistory(trimmedProgramId);
      const transactions = Array.isArray(result?.transactions) ? result.transactions : [];
      setHistoryResult({
        fetchedAt: new Date().toISOString(),
        programId: trimmedProgramId,
        transactions,
      });
      toast.success(`Loaded ${transactions.length} transaction(s) from wallet history`);
    } catch (error) {
      const formattedError = formatExecutionError(error);
      setHistoryResult({
        fetchedAt: new Date().toISOString(),
        programId: trimmedProgramId,
        error: formattedError,
        transactions: [],
      });
      toast.error(`Failed to load transaction history: ${formattedError.message}`);
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-4xl font-bold tracking-tight text-white md:text-5xl">
          Test USDCx Wallet Capabilities
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-300 md:text-base">
          Inspect Shield runtime capability, verify whether private execution hooks exist in the browser, and stage
          non-destructive payload skeletons for the `get_creds` and `xfer_with_creds` path.
        </p>
      </div>

      <Card className="border-cyan-500/20 bg-cyan-950/25">
        <CardHeader>
          <CardTitle className="text-cyan-100">Wallet Session</CardTitle>
          <CardDescription className="text-cyan-100/80">
            Connect Shield, then refresh the snapshot after switching accounts or wallets.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <WalletMultiButton />
            <Button variant="outline" onClick={handleRefreshSnapshot}>
              Refresh Runtime Snapshot
            </Button>
            <Button variant="outline" onClick={handleSeedWalletAddress} disabled={!address}>
              Seed Connected Address
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border border-white/10 bg-slate-900/50 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Connection</p>
              <div className="mt-2 flex items-center gap-2">
                <StatusBadge ready={connected} readyLabel="Connected" missingLabel="Disconnected" />
                <span className="text-sm text-slate-200">{wallet?.adapter?.name || 'No wallet selected'}</span>
              </div>
            </div>
            <div className="rounded-lg border border-white/10 bg-slate-900/50 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Address</p>
              <p className="mt-2 break-all font-mono text-xs text-slate-200">{address || 'Not connected'}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-slate-900/50 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Network</p>
              <p className="mt-2 text-sm text-slate-200">{network || 'Unknown'}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-slate-900/50 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Runtime Snapshot</p>
              <p className="mt-2 text-sm text-slate-200">{runtimeSnapshot.capturedAt || 'Not captured yet'}</p>
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-3">
            <div className="rounded-lg border border-white/10 bg-slate-900/40 p-3 text-sm text-slate-200">
              <strong>Connecting:</strong> {String(connecting)}
            </div>
            <div className="rounded-lg border border-white/10 bg-slate-900/40 p-3 text-sm text-slate-200">
              <strong>Disconnecting:</strong> {String(disconnecting)}
            </div>
            <div className="rounded-lg border border-white/10 bg-slate-900/40 p-3 text-sm text-slate-200">
              <strong>Reconnecting:</strong> {String(reconnecting)}
            </div>
          </div>

          <div className="rounded-lg border border-cyan-400/20 bg-slate-950/40 p-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/70">Current Wallet Permission</p>
                <p className="mt-1 text-sm text-cyan-100">{getWalletDecryptPermissionLabel(walletPermissionMode)}</p>
                <p className="mt-1 text-xs text-cyan-100/70">
                  `transitionViewKeys` and `requestTransactionHistory` need `ON_CHAIN_HISTORY`.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleReconnectWithPermission(DecryptPermission.OnChainHistory)}
                  disabled={walletPermissionMode === DecryptPermission.OnChainHistory}
                >
                  Reconnect With On-Chain History
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleReconnectWithPermission(DecryptPermission.UponRequest)}
                  disabled={walletPermissionMode === DecryptPermission.UponRequest}
                >
                  Restore Upon Request
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Available Wallet Providers</CardTitle>
            <CardDescription>
              This comes from the `AleoWalletProvider` registry, not from guessing extension objects.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {runtimeSnapshot.availableWallets.length > 0 ? (
              runtimeSnapshot.availableWallets.map((entry) => (
                <div
                  key={entry.name}
                  className="flex flex-col gap-2 rounded-lg border border-white/10 bg-slate-900/40 p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="text-sm font-medium text-white">{entry.name}</p>
                    <p className="text-xs text-slate-400">Ready state: {entry.readyState}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge ready={entry.selected} readyLabel="Selected" missingLabel="Idle" />
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={entry.selected}
                      onClick={() => selectWallet(entry.name)}
                    >
                      Select
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400">No wallet providers were detected by the React wallet adaptor.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Detected Browser Extensions</CardTitle>
            <CardDescription>
              Runtime presence on `window` helps confirm what the browser actually injected into the page.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {Object.entries(runtimeSnapshot.detectedExtensions).map(([name, ready]) => (
              <div key={name} className="flex items-center justify-between rounded-lg border border-white/10 bg-slate-900/40 p-4">
                <span className="font-mono text-sm text-slate-200">{name}</span>
                <StatusBadge ready={ready} readyLabel="Detected" missingLabel="Not found" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>`useWallet` Surface</CardTitle>
            <CardDescription>
              These are the high-level methods the app can call right now from the React context.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {walletCapabilities.map((capability) => (
              <div
                key={capability.name}
                className="flex flex-col gap-2 rounded-lg border border-white/10 bg-slate-900/40 p-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="font-mono text-sm text-slate-100">{capability.name}</p>
                  <p className="text-xs text-slate-400">Runtime type: {capability.runtimeType}</p>
                </div>
                <StatusBadge ready={capability.available} />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Shield Runtime Surface</CardTitle>
            <CardDescription>
              Direct inspection of `window.shield` and the currently selected adapter instance.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {runtimeSnapshot.shieldMethodAvailability.map((capability) => (
              <div
                key={capability.name}
                className="flex items-center justify-between rounded-lg border border-white/10 bg-slate-900/40 p-4"
              >
                <span className="font-mono text-sm text-slate-100">{capability.name}</span>
                <StatusBadge ready={capability.available} />
              </div>
            ))}

            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">window.shield keys</p>
              <p className="rounded-lg border border-white/10 bg-slate-900/50 p-3 font-mono text-xs text-slate-200">
                {runtimeSnapshot.shieldKeys.length > 0 ? runtimeSnapshot.shieldKeys.join(', ') : 'No Shield runtime keys found'}
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Selected adapter keys</p>
              <p className="rounded-lg border border-white/10 bg-slate-900/50 p-3 font-mono text-xs text-slate-200">
                {runtimeSnapshot.adapterKeys.length > 0 ? runtimeSnapshot.adapterKeys.join(', ') : 'No active adapter keys yet'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-amber-500/20 bg-amber-950/20">
        <CardHeader>
          <CardTitle className="text-amber-100">Execution Readiness</CardTitle>
          <CardDescription className="text-amber-100/80">
            This summarizes whether the browser session is ready for a real private execution attempt.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {readinessChecks.map((check) => (
            <div
              key={check.label}
              className="flex flex-col gap-2 rounded-lg border border-white/10 bg-slate-900/50 p-4 md:flex-row md:items-center md:justify-between"
            >
              <div>
                <p className="text-sm font-medium text-white">{check.label}</p>
                <p className="text-xs text-slate-400">{check.detail}</p>
              </div>
              <StatusBadge ready={check.ready} readyLabel="Ready" missingLabel="Blocked" />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Input Staging</CardTitle>
          <CardDescription>
            Paste concrete private inputs here so the payload previews below reflect exactly what you plan to test.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="recipient">Recipient</Label>
              <Input
                id="recipient"
                value={recipient}
                onChange={(event) => setRecipient(event.target.value)}
                placeholder="aleo1..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="4500000u128"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="split-amount">Split Amount</Label>
            <Input
              id="split-amount"
              value={splitAmount}
              onChange={(event) => setSplitAmount(event.target.value)}
              placeholder="1000000u128"
            />
            <p className="text-xs text-slate-400">
              Used only for the `test_usdcx_stablecoin.aleo/split` probe.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="token-record">Token.record plaintext</Label>
            <Textarea
              id="token-record"
              value={tokenRecord}
              onChange={(event) => setTokenRecord(event.target.value)}
              className="min-h-[160px] font-mono text-xs"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="credentials-record">Credentials.record plaintext</Label>
            <Textarea
              id="credentials-record"
              value={credentialsRecord}
              onChange={(event) => setCredentialsRecord(event.target.value)}
              className="min-h-[160px] font-mono text-xs"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="proofs-input">[MerkleProof; 2u32] input</Label>
            <Textarea
              id="proofs-input"
              value={proofsInput}
              onChange={(event) => setProofsInput(event.target.value)}
              className="min-h-[140px] font-mono text-xs"
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Payload Preview: `split`</CardTitle>
            <CardDescription>
              Immediate private-record probe. This one is state-changing because it spends the current token record into two new token records.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCopy('split payload', safeStringify(stagedPayloads.stablecoinSplit))}
            >
              Copy Payload
            </Button>
            <Textarea
              readOnly
              value={safeStringify(stagedPayloads.stablecoinSplit)}
              className="min-h-[260px] font-mono text-xs"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payload Preview: `get_creds`</CardTitle>
            <CardDescription>
              This is only a staging preview. Do not execute it until the proof array contains real field siblings and leaf indices.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCopy('get_creds payload', safeStringify(stagedPayloads.probeGetCreds))}
            >
              Copy Payload
            </Button>
            <Textarea
              readOnly
              value={safeStringify(stagedPayloads.probeGetCreds)}
              className="min-h-[260px] font-mono text-xs"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payload Preview: `xfer_with_creds`</CardTitle>
            <CardDescription>
              This should only be attempted after the credentials record exists and the token record plaintext has been pasted from Shield.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCopy('xfer_with_creds payload', safeStringify(stagedPayloads.probeXferWithCreds))}
            >
              Copy Payload
            </Button>
            <Textarea
              readOnly
              value={safeStringify(stagedPayloads.probeXferWithCreds)}
              className="min-h-[260px] font-mono text-xs"
            />
          </CardContent>
        </Card>
      </div>

      <Card className="border-sky-500/20 bg-sky-950/15">
        <CardHeader>
          <CardTitle className="text-sky-100">Live Execution Probe</CardTitle>
          <CardDescription className="text-sky-100/80">
            These buttons call `executeTransaction` with the staged payload exactly as shown. Use them to separate wallet execution issues from proof or record input issues.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <div className="space-y-2">
              <Label htmlFor="execution-fee">Execution Fee</Label>
              <Input
                id="execution-fee"
                value={fee}
                onChange={(event) => setFee(event.target.value)}
                placeholder="1000000"
              />
              <p className="text-xs text-slate-400">TransactionOptions expects an integer microcredit fee.</p>
            </div>

            <label className="flex items-center gap-3 rounded-lg border border-white/10 bg-slate-900/40 px-4 py-3 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={privateFee}
                onChange={(event) => setPrivateFee(event.target.checked)}
                className="h-4 w-4 rounded border border-white/20 bg-slate-800"
              />
              Private fee
            </label>
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <div className="space-y-4 rounded-xl border border-amber-400/20 bg-amber-950/20 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-white">Attempt `split`</h3>
                  <p className="mt-1 text-sm text-slate-300">
                    Real private-record execution probe. If this succeeds, Shield can submit a transaction that consumes a pasted `Token.record`.
                  </p>
                  <p className="mt-2 text-xs text-amber-200/80">
                    Warning: this changes wallet state by replacing the current token record with two new token records.
                  </p>
                </div>
                <StatusBadge ready={canAttemptSplitToken} readyLabel="Ready" missingLabel="Blocked" />
              </div>

              <Button
                className="w-full"
                onClick={() => handleAttemptExecution('splitToken')}
                disabled={!canAttemptSplitToken || pendingExecution !== null}
              >
                {pendingExecution === 'splitToken' ? 'Submitting split...' : 'Attempt split'}
              </Button>

              <AttemptResultPanel result={executionResults.splitToken} />
            </div>

            <div className="space-y-4 rounded-xl border border-white/10 bg-slate-900/35 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-white">Attempt `get_creds`</h3>
                  <p className="mt-1 text-sm text-slate-400">
                    Requires one concrete string input representing `[MerkleProof; 2u32]`.
                  </p>
                </div>
                <StatusBadge ready={canAttemptGetCreds} readyLabel="Ready" missingLabel="Blocked" />
              </div>

              <Button
                className="w-full"
                onClick={() => handleAttemptExecution('getCreds')}
                disabled={!canAttemptGetCreds || pendingExecution !== null}
              >
                {pendingExecution === 'getCreds' ? 'Submitting get_creds...' : 'Attempt get_creds'}
              </Button>

              <AttemptResultPanel result={executionResults.getCreds} />
            </div>

            <div className="space-y-4 rounded-xl border border-white/10 bg-slate-900/35 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-white">Attempt `xfer_with_creds`</h3>
                  <p className="mt-1 text-sm text-slate-400">
                    Requires recipient, amount, `Token.record`, and `Credentials.record` as concrete Leo literals.
                  </p>
                </div>
                <StatusBadge ready={canAttemptXferWithCreds} readyLabel="Ready" missingLabel="Blocked" />
              </div>

              <Button
                className="w-full"
                onClick={() => handleAttemptExecution('xferWithCreds')}
                disabled={!canAttemptXferWithCreds || pendingExecution !== null}
              >
                {pendingExecution === 'xferWithCreds' ? 'Submitting xfer_with_creds...' : 'Attempt xfer_with_creds'}
              </Button>

              <AttemptResultPanel result={executionResults.xferWithCreds} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-emerald-500/20 bg-emerald-950/10">
        <CardHeader>
          <CardTitle className="text-emerald-100">Transaction Follow-up</CardTitle>
          <CardDescription className="text-emerald-100/80">
            Inspect the submitted Shield transaction, pull transition view keys, and load wallet transaction history for the stablecoin program.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto_auto_auto] xl:items-end">
            <div className="space-y-2">
              <Label htmlFor="follow-up-transaction-id">Wallet Transaction ID</Label>
              <Input
                id="follow-up-transaction-id"
                value={followUpTransactionId}
                onChange={(event) => setFollowUpTransactionId(event.target.value)}
                placeholder="shield_... or at1..."
              />
            </div>
            <Button variant="outline" onClick={handleUseLatestSubmittedTransaction}>
              Use Last Submitted
            </Button>
            <Button
              variant="outline"
              onClick={() => handleCheckTransactionStatus()}
              disabled={followUpStatusLoading}
            >
              {followUpStatusLoading ? 'Checking Status...' : 'Check Status'}
            </Button>
            <Button
              variant="outline"
              onClick={() => handleFetchTransitionViewKeys()}
              disabled={viewKeysLoading}
            >
              {viewKeysLoading ? 'Loading TVKs...' : 'Load TVKs'}
            </Button>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <div className="space-y-3 rounded-xl border border-white/10 bg-slate-900/35 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-white">Status Result</p>
                <StatusBadge
                  ready={followUpStatus?.finalStatus === 'confirmed' || followUpStatus?.finalStatus === 'accepted'}
                  readyLabel={followUpStatus?.finalStatus || 'Ready'}
                  missingLabel={followUpStatus?.finalStatus || 'Not checked'}
                />
              </div>
              <pre className="min-h-[220px] overflow-x-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-slate-950/50 p-4 font-mono text-xs text-slate-200">
                {followUpStatus ? safeStringify(followUpStatus) : 'No transaction status check yet.'}
              </pre>
            </div>

            <div className="space-y-3 rounded-xl border border-white/10 bg-slate-900/35 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-white">Transition View Keys</p>
                <StatusBadge
                  ready={Array.isArray(viewKeysResult?.keys) && viewKeysResult.keys.length > 0}
                  readyLabel={`${viewKeysResult?.count ?? 0} key(s)`}
                  missingLabel={viewKeysResult?.error ? 'Error' : 'Not loaded'}
                />
              </div>
              <p className="text-xs text-slate-400">
                TVKs need an on-chain transaction id `at1...`. If `Check Status` already resolved one, this button now uses it automatically.
              </p>
              <pre className="min-h-[220px] overflow-x-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-slate-950/50 p-4 font-mono text-xs text-slate-200">
                {viewKeysResult ? safeStringify(viewKeysResult) : 'No transition view keys loaded yet.'}
              </pre>
            </div>
          </div>

          <div className="space-y-4 rounded-xl border border-white/10 bg-slate-900/35 p-4">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
              <div className="space-y-2">
                <Label htmlFor="history-program-id">History Program ID</Label>
                <Input
                  id="history-program-id"
                  value={historyProgramId}
                  onChange={(event) => setHistoryProgramId(event.target.value)}
                  placeholder={DEFAULT_HISTORY_PROGRAM}
                />
              </div>
              <Button onClick={handleLoadTransactionHistory} disabled={historyLoading}>
                {historyLoading ? 'Loading History...' : 'Load Wallet History'}
              </Button>
            </div>

            <pre className="min-h-[160px] overflow-x-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-slate-950/50 p-4 font-mono text-xs text-slate-200">
              {historyResult ? safeStringify(historyResult) : 'No wallet transaction history loaded yet.'}
            </pre>

            {historyTransactions.length > 0 && (
              <div className="space-y-3">
                {historyTransactions.slice(0, 10).map((entry, index) => {
                  const candidateTransactionId = typeof entry?.transactionId === 'string' && entry.transactionId.trim()
                    ? entry.transactionId.trim()
                    : typeof entry?.id === 'string' && entry.id.trim()
                      ? entry.id.trim()
                      : '';

                  return (
                    <div
                      key={`${candidateTransactionId || 'history'}-${index}`}
                      className="flex flex-col gap-3 rounded-lg border border-white/10 bg-slate-950/40 p-4 xl:flex-row xl:items-center xl:justify-between"
                    >
                      <div className="space-y-1">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">History Entry {index + 1}</p>
                        <p className="break-all font-mono text-xs text-slate-200">{candidateTransactionId || 'No transaction id exposed'}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!candidateTransactionId}
                          onClick={() => setFollowUpTransactionId(candidateTransactionId)}
                        >
                          Use ID
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!candidateTransactionId || followUpStatusLoading}
                          onClick={() => handleCheckTransactionStatus(candidateTransactionId)}
                        >
                          Check Status
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!candidateTransactionId || viewKeysLoading}
                          onClick={() => handleFetchTransitionViewKeys(candidateTransactionId)}
                        >
                          Load TVKs
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Wallet Debug History</CardTitle>
          <CardDescription>
            Shows the latest instrumentation events emitted by the custom Shield adapter wrapper.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-white/10 bg-slate-900/50 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Latest debug entry</p>
            <pre className="mt-3 overflow-x-auto whitespace-pre-wrap font-mono text-xs text-slate-200">
              {runtimeSnapshot.latestDebugEntry ? safeStringify(runtimeSnapshot.latestDebugEntry) : 'No wallet debug entries yet'}
            </pre>
          </div>

          <div className="space-y-3">
            {recentDebugEntries.length > 0 ? (
              recentDebugEntries.map((entry, index) => (
                <div key={`${entry.timestamp}-${index}`} className="rounded-lg border border-white/10 bg-slate-900/40 p-4">
                  <p className="font-mono text-xs text-slate-300">{entry.timestamp}</p>
                  <p className="mt-1 text-sm font-medium text-white">{entry.event || 'Unknown event'}</p>
                  <pre className="mt-3 overflow-x-auto whitespace-pre-wrap font-mono text-xs text-slate-300">
                    {safeStringify(entry)}
                  </pre>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400">No adapter history recorded yet. Connect or switch Shield accounts to populate it.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
