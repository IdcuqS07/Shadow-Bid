// ShadowBid V2.23 private USDCx probe scaffold
// This program records probe targets and execution intent for imported private rail experiments.
// It now exposes wrapper calls for the imported funding primitives themselves, while keeping
// actual private-record sourcing and custody logic outside the probe package.

import test_usdcx_stablecoin.aleo;

struct ProbeTarget {
    planner: address,
    primitive_kind: u8,
    requires_credentials: bool,
    requires_merkle_proofs: bool,
    leaks_public_amount: bool,
    amount_hint: u128,
    created_at: i64,
    updated_at: i64,
    active: bool
}

final fn finalize_reg_probe_target(
    probe_id: field,
    planner: address,
    primitive_kind: u8,
    requires_credentials: bool,
    requires_merkle_proofs: bool,
    leaks_public_amount: bool,
    amount_hint: u128,
    created_at: i64
) {
    assert(!Mapping::contains(probe_targets, probe_id));
    assert(primitive_kind <= 5u8);

    Mapping::set(probe_targets, probe_id, ProbeTarget {
        planner,
        primitive_kind,
        requires_credentials,
        requires_merkle_proofs,
        leaks_public_amount,
        amount_hint,
        created_at,
        updated_at: created_at,
        active: true
    });
}

final fn finalize_close_probe_target(
    probe_id: field,
    planner: address,
    closed_at: i64
) {
    let target: ProbeTarget = Mapping::get(probe_targets, probe_id);

    assert_eq(target.planner, planner);
    assert(target.active);

    Mapping::set(probe_targets, probe_id, ProbeTarget {
        planner: target.planner,
        primitive_kind: target.primitive_kind,
        requires_credentials: target.requires_credentials,
        requires_merkle_proofs: target.requires_merkle_proofs,
        leaks_public_amount: target.leaks_public_amount,
        amount_hint: target.amount_hint,
        created_at: target.created_at,
        updated_at: closed_at,
        active: false
    });
}

final fn finalize_xfer_with_creds(run_future: Final) {
    run_future.run();
}

final fn finalize_get_creds(run_future: Final) {
    run_future.run();
}

final fn finalize_xfer_priv(run_future: Final) {
    run_future.run();
}

final fn finalize_xfer_priv_to_pub(run_future: Final) {
    run_future.run();
}

final fn finalize_mint_priv(run_future: Final) {
    run_future.run();
}

final fn finalize_xfer_pub_to_priv(run_future: Final) {
    run_future.run();
}

program shadowbid_usdcx_probe_v1.aleo {

    record ProbeReceipt {
        owner: address,
        probe_id: field,
        primitive_kind: u8,
        amount_hint: u128,
        created_at: i64
    }

    mapping probe_targets: field => ProbeTarget;

    fn register_probe_target(
        public probe_id: field,
        public primitive_kind: u8,
        public requires_credentials: bool,
        public requires_merkle_proofs: bool,
        public leaks_public_amount: bool,
        public amount_hint: u128,
        public created_at: i64
    ) -> (ProbeReceipt, Final) {
        let signer = self.signer;
        let receipt: ProbeReceipt = ProbeReceipt {
            owner: signer,
            probe_id,
            primitive_kind,
            amount_hint,
            created_at
        };

        return (receipt, final {
            finalize_reg_probe_target(
                probe_id,
                signer,
                primitive_kind,
                requires_credentials,
                requires_merkle_proofs,
                leaks_public_amount,
                amount_hint,
                created_at
            );
        });
    }

    fn close_probe_target(
        public probe_id: field,
        public closed_at: i64
    ) -> Final {
        let signer = self.signer;

        return final {
            finalize_close_probe_target(probe_id, signer, closed_at);
        };
    }

    fn get_creds(
        proofs: [test_usdcx_stablecoin.aleo::MerkleProof; 2u32]
    ) -> (test_usdcx_stablecoin.aleo::Credentials, Final) {
        let (
            credentials,
            run_future
        ): (
            test_usdcx_stablecoin.aleo::Credentials,
            Final
        ) = test_usdcx_stablecoin.aleo::get_credentials(proofs);

        return (
            credentials,
            final {
                finalize_get_creds(run_future);
            }
        );
    }

    fn xfer_with_creds(
        recipient: address,
        amount: u128,
        token_record: test_usdcx_stablecoin.aleo::Token,
        credentials: test_usdcx_stablecoin.aleo::Credentials
    ) -> (
        test_usdcx_stablecoin.aleo::ComplianceRecord,
        test_usdcx_stablecoin.aleo::Token,
        test_usdcx_stablecoin.aleo::Token,
        test_usdcx_stablecoin.aleo::Credentials,
        Final
    ) {
        let (
            compliance,
            change_record,
            recipient_record,
            refreshed_credentials,
            run_future
        ): (
            test_usdcx_stablecoin.aleo::ComplianceRecord,
            test_usdcx_stablecoin.aleo::Token,
            test_usdcx_stablecoin.aleo::Token,
            test_usdcx_stablecoin.aleo::Credentials,
            Final
        ) = test_usdcx_stablecoin.aleo::transfer_private_with_creds(
            recipient,
            amount,
            token_record,
            credentials
        );

        return (
            compliance,
            change_record,
            recipient_record,
            refreshed_credentials,
            final {
                finalize_xfer_with_creds(run_future);
            }
        );
    }

    fn xfer_priv(
        recipient: address,
        amount: u128,
        token_record: test_usdcx_stablecoin.aleo::Token,
        proofs: [test_usdcx_stablecoin.aleo::MerkleProof; 2u32]
    ) -> (
        test_usdcx_stablecoin.aleo::ComplianceRecord,
        test_usdcx_stablecoin.aleo::Token,
        test_usdcx_stablecoin.aleo::Token,
        Final
    ) {
        let (
            compliance,
            change_record,
            recipient_record,
            run_future
        ): (
            test_usdcx_stablecoin.aleo::ComplianceRecord,
            test_usdcx_stablecoin.aleo::Token,
            test_usdcx_stablecoin.aleo::Token,
            Final
        ) = test_usdcx_stablecoin.aleo::transfer_private(
            recipient,
            amount,
            token_record,
            proofs
        );

        return (
            compliance,
            change_record,
            recipient_record,
            final {
                finalize_xfer_priv(run_future);
            }
        );
    }

    fn xfer_priv_to_pub(
        public recipient: address,
        public amount: u128,
        token_record: test_usdcx_stablecoin.aleo::Token,
        proofs: [test_usdcx_stablecoin.aleo::MerkleProof; 2u32]
    ) -> (
        test_usdcx_stablecoin.aleo::ComplianceRecord,
        test_usdcx_stablecoin.aleo::Token,
        Final
    ) {
        let (
            compliance,
            change_record,
            run_future
        ): (
            test_usdcx_stablecoin.aleo::ComplianceRecord,
            test_usdcx_stablecoin.aleo::Token,
            Final
        ) = test_usdcx_stablecoin.aleo::transfer_private_to_public(
            recipient,
            amount,
            token_record,
            proofs
        );

        return (
            compliance,
            change_record,
            final {
                finalize_xfer_priv_to_pub(run_future);
            }
        );
    }

    fn mint_priv(
        recipient: address,
        public amount: u128
    ) -> (
        test_usdcx_stablecoin.aleo::ComplianceRecord,
        test_usdcx_stablecoin.aleo::Token,
        Final
    ) {
        let (
            compliance,
            token_record,
            run_future
        ): (
            test_usdcx_stablecoin.aleo::ComplianceRecord,
            test_usdcx_stablecoin.aleo::Token,
            Final
        ) = test_usdcx_stablecoin.aleo::mint_private(
            recipient,
            amount
        );

        return (
            compliance,
            token_record,
            final {
                finalize_mint_priv(run_future);
            }
        );
    }

    fn xfer_pub_to_priv(
        recipient: address,
        public amount: u128
    ) -> (
        test_usdcx_stablecoin.aleo::ComplianceRecord,
        test_usdcx_stablecoin.aleo::Token,
        Final
    ) {
        let (
            compliance,
            token_record,
            run_future
        ): (
            test_usdcx_stablecoin.aleo::ComplianceRecord,
            test_usdcx_stablecoin.aleo::Token,
            Final
        ) = test_usdcx_stablecoin.aleo::transfer_public_to_private(
            recipient,
            amount
        );

        return (
            compliance,
            token_record,
            final {
                finalize_xfer_pub_to_priv(run_future);
            }
        );
    }

    @noupgrade
    constructor() {}
}
