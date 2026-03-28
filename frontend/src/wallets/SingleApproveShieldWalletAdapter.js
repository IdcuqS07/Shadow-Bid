import { ShieldWalletAdapter } from '@provablehq/aleo-wallet-adaptor-shield';

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
        console.debug(
          '[SingleApproveShieldWalletAdapter] Ignoring immediate accountChanged event during connect grace window'
        );
        return;
      }

      if (!nextAddress) {
        console.debug(
          '[SingleApproveShieldWalletAdapter] Ignoring accountChanged event without a new public key'
        );
        return;
      }

      if (nextAddress === currentAddress) {
        console.debug(
          '[SingleApproveShieldWalletAdapter] Ignoring accountChanged event with the same address'
        );
        return;
      }

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
      return this.account;
    }

    if (this._connectPromise) {
      return this._connectPromise;
    }

    this._suppressAccountChangeUntil = Date.now() + INITIAL_CONNECT_ACCOUNT_CHANGE_GRACE_MS;

    this._connectPromise = super
      .connect(network, decryptPermission, programs)
      .then((account) => {
        this._lastKnownAddress = account?.address ?? null;
        this._suppressAccountChangeUntil = Date.now() + INITIAL_CONNECT_ACCOUNT_CHANGE_GRACE_MS;
        return account;
      })
      .catch((error) => {
        this._suppressAccountChangeUntil = 0;
        throw error;
      })
      .finally(() => {
        this._connectPromise = null;
      });

    return this._connectPromise;
  }

  async disconnect() {
    this._suppressAccountChangeUntil = 0;
    this._connectPromise = null;
    this._lastKnownAddress = null;
    return super.disconnect();
  }
}

export default SingleApproveShieldWalletAdapter;
