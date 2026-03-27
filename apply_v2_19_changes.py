#!/usr/bin/env python3
"""
Script to apply V2.19 changes to contract
Run: python3 apply_v2_19_changes.py
"""

import re

# Read the contract
with open('shadowbid_marketplace_v2_19/src/main.leo', 'r') as f:
    content = f.read()

print("Applying V2.19 changes...")

# Change 1: Already done - constants and struct

# Change 2: Update finalize_create_auction to initialize new fields
old_pattern = r'(Mapping::set\(auctions, auction_id, AuctionInfo \{[^}]+confirmation_timeout: timeout)'
new_text = r'\1,\n            \n            // V2.19 NEW: Initialize settlement timing\n            settled_at: 0i64,\n            claimable_at: 0i64,\n            \n            // V2.19 NEW: Initialize platform fee\n            platform_fee_amount: 0u128,\n            seller_net_amount: 0u128,\n            platform_fee_claimed: false,\n            platform_fee_claimed_at: 0i64,\n            \n            // V2.19 NEW: Initialize reserve price\n            reserve_price,\n            reserve_met: false'

content = re.sub(old_pattern, new_text, content, count=1)

print("✓ Updated create_auction initialization")

# Save
with open('shadowbid_marketplace_v2_19/src/main.leo', 'w') as f:
    f.write(content)

print("✓ V2.19 changes applied!")
print("\nNext: Manually add new functions and update remaining functions")
print("See APPLY_V2_19_CHANGES.md for details")
