// ShadowBid V2.23 record-utils scaffold
// This program tracks split-plan metadata for benchmark execution.
// It does not yet perform private USDCx record splitting.

struct SplitPlan {
    planner: address,
    denomination_root: field,
    purpose_root: field,
    expected_outputs: u8,
    observed_outputs: u8,
    target_value: u128,
    created_at: i64,
    updated_at: i64,
    active: bool,
    ready_for_benchmark: bool
}

final fn finalize_reg_split_plan(
    plan_id: field,
    planner: address,
    denomination_root: field,
    purpose_root: field,
    expected_outputs: u8,
    target_value: u128,
    created_at: i64
) {
    assert(!Mapping::contains(split_plans, plan_id));
    assert(expected_outputs > 0u8);
    assert(target_value > 0u128);

    Mapping::set(split_plans, plan_id, SplitPlan {
        planner,
        denomination_root,
        purpose_root,
        expected_outputs,
        observed_outputs: 0u8,
        target_value,
        created_at,
        updated_at: created_at,
        active: true,
        ready_for_benchmark: false
    });
}

final fn finalize_ready_split_plan(
    plan_id: field,
    planner: address,
    observed_outputs: u8,
    updated_at: i64
) {
    let plan: SplitPlan = Mapping::get(split_plans, plan_id);

    assert_eq(plan.planner, planner);
    assert(plan.active);
    assert(observed_outputs > 0u8);

    Mapping::set(split_plans, plan_id, SplitPlan {
        planner: plan.planner,
        denomination_root: plan.denomination_root,
        purpose_root: plan.purpose_root,
        expected_outputs: plan.expected_outputs,
        observed_outputs,
        target_value: plan.target_value,
        created_at: plan.created_at,
        updated_at,
        active: true,
        ready_for_benchmark: true
    });
}

final fn finalize_close_split_plan(
    plan_id: field,
    planner: address,
    closed_at: i64
) {
    let plan: SplitPlan = Mapping::get(split_plans, plan_id);

    assert_eq(plan.planner, planner);
    assert(plan.active);

    Mapping::set(split_plans, plan_id, SplitPlan {
        planner: plan.planner,
        denomination_root: plan.denomination_root,
        purpose_root: plan.purpose_root,
        expected_outputs: plan.expected_outputs,
        observed_outputs: plan.observed_outputs,
        target_value: plan.target_value,
        created_at: plan.created_at,
        updated_at: closed_at,
        active: false,
        ready_for_benchmark: plan.ready_for_benchmark
    });
}

program shadowbid_usdcx_record_utils_v1.aleo {

    record SplitPlanReceipt {
        owner: address,
        plan_id: field,
        expected_outputs: u8,
        target_value: u128,
        created_at: i64
    }

    mapping split_plans: field => SplitPlan;

    fn register_split_plan(
        public plan_id: field,
        public denomination_root: field,
        public purpose_root: field,
        public expected_outputs: u8,
        public target_value: u128,
        public created_at: i64
    ) -> (SplitPlanReceipt, Final) {
        let signer = self.signer;
        let receipt: SplitPlanReceipt = SplitPlanReceipt {
            owner: signer,
            plan_id,
            expected_outputs,
            target_value,
            created_at
        };

        return (receipt, final {
            finalize_reg_split_plan(
                plan_id,
                signer,
                denomination_root,
                purpose_root,
                expected_outputs,
                target_value,
                created_at
            );
        });
    }

    fn mark_split_plan_ready(
        public plan_id: field,
        public observed_outputs: u8,
        public updated_at: i64
    ) -> Final {
        let signer = self.signer;

        return final {
            finalize_ready_split_plan(plan_id, signer, observed_outputs, updated_at);
        };
    }

    fn close_split_plan(
        public plan_id: field,
        public closed_at: i64
    ) -> Final {
        let signer = self.signer;

        return final {
            finalize_close_split_plan(plan_id, signer, closed_at);
        };
    }

    @noupgrade
    constructor() {}
}
