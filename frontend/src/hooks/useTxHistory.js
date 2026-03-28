import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@provablehq/aleo-wallet-adaptor-react';

const PROGRAM_ID = 'shadowbid_marketplace_v2_20.aleo';

export function useTxHistory({ autoRefresh = false } = {}) {
  const { connected, requestTransactionHistory } = useWallet();
  const [txHistory, setTxHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!connected || !requestTransactionHistory) return;
    setLoading(true);
    try {
      const result = await requestTransactionHistory(PROGRAM_ID);
      setTxHistory(result?.transactions ?? []);
    } catch (e) {
      console.error('requestTransactionHistory error:', e);
    } finally {
      setLoading(false);
    }
  }, [connected, requestTransactionHistory]);

  useEffect(() => {
    if (autoRefresh) {
      refresh();
    }
  }, [autoRefresh, refresh]);

  return { txHistory, loading, refresh };
}
