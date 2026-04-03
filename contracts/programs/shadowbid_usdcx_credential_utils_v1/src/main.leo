// ShadowBid V2.23 credential-utils scaffold
// This program tracks credential-batch metadata for benchmark execution.
// It does not yet mint or validate private USDCx credentials.

struct CredentialBatch {
    planner: address,
    policy_root: field,
    benchmark_root: field,
    expected_credentials: u8,
    issued_credentials: u8,
    created_at: i64,
    updated_at: i64,
    active: bool,
    ready_for_benchmark: bool
}

final fn finalize_reg_cred_batch(
    batch_id: field,
    planner: address,
    policy_root: field,
    benchmark_root: field,
    expected_credentials: u8,
    created_at: i64
) {
    assert(!Mapping::contains(credential_batches, batch_id));
    assert(expected_credentials > 0u8);

    Mapping::set(credential_batches, batch_id, CredentialBatch {
        planner,
        policy_root,
        benchmark_root,
        expected_credentials,
        issued_credentials: 0u8,
        created_at,
        updated_at: created_at,
        active: true,
        ready_for_benchmark: false
    });
}

final fn finalize_ready_cred_batch(
    batch_id: field,
    planner: address,
    issued_credentials: u8,
    updated_at: i64
) {
    let batch: CredentialBatch = Mapping::get(credential_batches, batch_id);

    assert_eq(batch.planner, planner);
    assert(batch.active);
    assert(issued_credentials > 0u8);

    Mapping::set(credential_batches, batch_id, CredentialBatch {
        planner: batch.planner,
        policy_root: batch.policy_root,
        benchmark_root: batch.benchmark_root,
        expected_credentials: batch.expected_credentials,
        issued_credentials,
        created_at: batch.created_at,
        updated_at,
        active: true,
        ready_for_benchmark: true
    });
}

final fn finalize_close_cred_batch(
    batch_id: field,
    planner: address,
    closed_at: i64
) {
    let batch: CredentialBatch = Mapping::get(credential_batches, batch_id);

    assert_eq(batch.planner, planner);
    assert(batch.active);

    Mapping::set(credential_batches, batch_id, CredentialBatch {
        planner: batch.planner,
        policy_root: batch.policy_root,
        benchmark_root: batch.benchmark_root,
        expected_credentials: batch.expected_credentials,
        issued_credentials: batch.issued_credentials,
        created_at: batch.created_at,
        updated_at: closed_at,
        active: false,
        ready_for_benchmark: batch.ready_for_benchmark
    });
}

program shadowbid_usdcx_cred_utils_v1.aleo {

    record CredentialBatchReceipt {
        owner: address,
        batch_id: field,
        expected_credentials: u8,
        created_at: i64
    }

    mapping credential_batches: field => CredentialBatch;

    fn register_credential_batch(
        public batch_id: field,
        public policy_root: field,
        public benchmark_root: field,
        public expected_credentials: u8,
        public created_at: i64
    ) -> (CredentialBatchReceipt, Final) {
        let signer = self.signer;
        let receipt: CredentialBatchReceipt = CredentialBatchReceipt {
            owner: signer,
            batch_id,
            expected_credentials,
            created_at
        };

        return (receipt, final {
            finalize_reg_cred_batch(
                batch_id,
                signer,
                policy_root,
                benchmark_root,
                expected_credentials,
                created_at
            );
        });
    }

    fn mark_credential_batch_ready(
        public batch_id: field,
        public issued_credentials: u8,
        public updated_at: i64
    ) -> Final {
        let signer = self.signer;

        return final {
            finalize_ready_cred_batch(batch_id, signer, issued_credentials, updated_at);
        };
    }

    fn close_credential_batch(
        public batch_id: field,
        public closed_at: i64
    ) -> Final {
        let signer = self.signer;

        return final {
            finalize_close_cred_batch(batch_id, signer, closed_at);
        };
    }

    @noupgrade
    constructor() {}
}
