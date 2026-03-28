import { ShieldWalletAdapter } from '@provablehq/aleo-wallet-adaptor-shield';
import { recordWalletDebug } from '@/wallets/walletDebug';

const INITIAL_CONNECT_ACCOUNT_CHANGE_GRACE_MS = 5000;

export class SingleApproveShieldWalletAdapter extends ShieldWalletAdapter {
  constructor(config) {
    super(config);

    this._suppressAccountChangeUntil = 0;
    this._connectPromise = null;
    this._lastKnownAddress = null;

    this._onAccountChange = () => {
      const nextAddress = this._shieldWallet?.publicKey ?? null;
      const currentAddress = this.account?.address ?? this._publicKey ?? this._lastKnownAddress ?? null;

      if (Date.now() < this._suppressAccountChangeUntil) {
        recordWalletDebug('shield-account-change-ignored-grace-window', {
          nextAddress,
          currentAddress,
        });
        console.debug(
          '[SingleApproveShieldWalletAdapter] Ignoring immediate accountChanged event during connect grace window'
        );
        return;
      }

      if (!nextAddress) {
        recordWalletDebug('shield-account-change-ignored-no-public-key', {
          currentAddress,
        });
        console.debug(
          '[SingleApproveShieldWalletAdapter] Ignoring accountChanged event without a new public key'
        );
        return;
      }

      if (nextAddress === currentAddress) {
        recordWalletDebug('shield-account-change-ignored-same-address', {
          nextAddress,
          currentAddress,
        });
        console.debug(
          '[SingleApproveShieldWalletAdapter] Ignoring accountChanged event with the same address'
        );
        return;
      }

      recordWalletDebug('shield-account-change-updated-address', {
        nextAddress,
        currentAddress,
      });
      console.debug(
        '[SingleApproveShieldWalletAdapter] Updating account locally after accountChanged without reauthorizing'
      );

      this._publicKey = nextAddress;
      this.account = { address: nextAddress };
      this._lastKnownAddress = nextAddress;
      this.emit('connect', this.account);
    };
  }

  async connect(network, decryptPermission, programs) {
    if (this.connected && this.account?.address) {
      recordWalletDebug('shield-connect-short-circuit-already-connected', {
        address: this.account.address,
        network,
        decryptPermission,
      });
      return this.account;
    }

    if (this._connectPromise) {
      recordWalletDebug('shield-connect-reused-existing-promise', {
        network,
        decryptPermission,
      });
      return this._connectPromise;
    }

    recordWalletDebug('shield-connect-start', {
      network,
      decryptPermission,
      programs: Array.isArray(programs) ? programs : programs ?? null,
    });

    this._suppressAccountChangeUntil = Date.now() + INITIAL_CONNECT_ACCOUNT_CHANGE_GRACE_MS;

    this._connectPromise = super
      .connect(network, decryptPermission, programs)
      .then((account) => {
        this._lastKnownAddress = account?.address ?? null;
        this._suppressAccountChangeUntil = Date.now() + INITIAL_CONNECT_ACCOUNT_CHANGE_GRACE_MS;
        recordWalletDebug('shield-connect-success', {
          address: this._lastKnownAddress,
          network,
          decryptPermission,
        });
        return account;
      })
      .catch((error) => {
        this._suppressAccountChangeUntil = 0;
        recordWalletDebug('shield-connect-error', {
          network,
          decryptPermission,
          error,
        });
        throw error;
      })
      .finally(() => {
        recordWalletDebug('shield-connect-finished', {
          address: this.account?.address ?? this._lastKnownAddress ?? null,
        });
        this._connectPromise = null;
      });

    return this._connectPromise;
  }

  async disconnect() {
    recordWalletDebug('shield-disconnect-start', {
      address: this.account?.address ?? this._lastKnownAddress ?? null,
    });
    this._suppressAccountChangeUntil = 0;
    this._connectPromise = null;
    this._lastKnownAddress = null;

    try {
      return await super.disconnect();
    } finally {
      recordWalletDebug('shield-disconnect-finished');
    }
  }
}

export default SingleApproveShieldWalletAdapter;
