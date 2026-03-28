import { ShieldWalletAdapter } from '@provablehq/aleo-wallet-adaptor-shield';

const INITIAL_CONNECT_ACCOUNT_CHANGE_GRACE_MS = 5000;

export class SingleApproveShieldWalletAdapter extends ShieldWalletAdapter {
  constructor(config) {
    super(config);

    this._suppressAccountChangeUntil = 0;

    const originalOnAccountChange = this._onAccountChange;

    this._onAccountChange = () => {
      if (Date.now() < this._suppressAccountChangeUntil) {
        console.debug(
          '[SingleApproveShieldWalletAdapter] Ignoring immediate accountChanged event during connect grace window'
        );
        return;
      }

      originalOnAccountChange?.();
    };
  }

  async connect(network, decryptPermission, programs) {
    this._suppressAccountChangeUntil = Date.now() + INITIAL_CONNECT_ACCOUNT_CHANGE_GRACE_MS;

    try {
      const account = await super.connect(network, decryptPermission, programs);
      this._suppressAccountChangeUntil = Date.now() + INITIAL_CONNECT_ACCOUNT_CHANGE_GRACE_MS;
      return account;
    } catch (error) {
      this._suppressAccountChangeUntil = 0;
      throw error;
    }
  }

  async disconnect() {
    this._suppressAccountChangeUntil = 0;
    return super.disconnect();
  }
}

export default SingleApproveShieldWalletAdapter;
