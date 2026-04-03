use serde::Serialize;
use snarkvm_console_account::Address;
use snarkvm_console_network::{Network, TestnetV0};
use snarkvm_console_types::{Field, prelude::ToFields};
use std::{env, error::Error, str::FromStr};

const PROOF_DEPTH: usize = 16;

#[derive(Clone, Debug)]
struct Arguments {
    target: String,
    root: String,
    leaves: Vec<String>,
}

#[derive(Clone, Debug)]
struct IndexedLeaf {
    index: u32,
    address: String,
    field: Field<TestnetV0>,
}

#[derive(Clone, Debug, Serialize)]
struct ProofJson {
    leaf_index: u32,
    siblings: Vec<String>,
}

#[derive(Clone, Debug, Serialize)]
struct BoundJson {
    index: u32,
    address: String,
    field: String,
}

#[derive(Clone, Debug, Serialize)]
struct OutputJson {
    target_address: String,
    target_field: String,
    expected_root: String,
    computed_root: String,
    root_matches: bool,
    leaf_count: usize,
    target_is_leaf: bool,
    insertion_case: String,
    left_bound: Option<BoundJson>,
    right_bound: Option<BoundJson>,
    proofs: Vec<ProofJson>,
    verify_non_inclusion_local: bool,
}

fn main() -> Result<(), Box<dyn Error>> {
    let args = parse_args(env::args().skip(1).collect())?;
    let expected_root = Field::<TestnetV0>::from_str(&args.root)?;
    let target_address = Address::<TestnetV0>::from_str(&args.target)?;
    let target_field = target_address.to_fields()?.into_iter().next().ok_or("missing target field")?;

    let indexed_leaves = args
        .leaves
        .iter()
        .enumerate()
        .map(|(index, address)| -> Result<IndexedLeaf, Box<dyn Error>> {
            let parsed = Address::<TestnetV0>::from_str(address)?;
            let field = parsed.to_fields()?.into_iter().next().ok_or("missing leaf field")?;
            Ok(IndexedLeaf {
                index: index as u32,
                address: address.clone(),
                field,
            })
        })
        .collect::<Result<Vec<_>, _>>()?;

    if indexed_leaves.is_empty() {
        return Err("at least one --leaf is required".into());
    }

    let leaf_fields = indexed_leaves.iter().map(|leaf| leaf.field).collect::<Vec<_>>();
    let computed_root = compute_root(&leaf_fields)?;
    let root_matches = computed_root == expected_root;

    let insertion = locate_insertion(&leaf_fields, target_field);
    let target_is_leaf = insertion.exact_index.is_some();

    let (proof_indexes, insertion_case, left_bound, right_bound) = match insertion.exact_index {
        Some(index) => {
            let bound = indexed_leaves.get(index).ok_or("missing exact bound")?;
            (
                vec![index as u32, index as u32],
                String::from("exact-leaf"),
                Some(bound_to_json(bound)),
                Some(bound_to_json(bound)),
            )
        }
        None if insertion.right_index == 0 => {
            let first = indexed_leaves.first().ok_or("missing first leaf")?;
            (
                vec![0, 0],
                String::from("before-first"),
                None,
                Some(bound_to_json(first)),
            )
        }
        None if insertion.right_index >= indexed_leaves.len() => {
            let last = indexed_leaves.last().ok_or("missing last leaf")?;
            (
                vec![last.index, last.index],
                String::from("after-last"),
                Some(bound_to_json(last)),
                None,
            )
        }
        None => {
            let left = indexed_leaves
                .get(insertion.right_index.saturating_sub(1))
                .ok_or("missing left bound")?;
            let right = indexed_leaves.get(insertion.right_index).ok_or("missing right bound")?;
            (
                vec![left.index, right.index],
                String::from("between-leaves"),
                Some(bound_to_json(left)),
                Some(bound_to_json(right)),
            )
        }
    };

    let proofs = proof_indexes
        .iter()
        .map(|index| build_proof(&leaf_fields, *index as usize))
        .collect::<Result<Vec<_>, _>>()?;

    let verify_non_inclusion_local = !target_is_leaf
        && root_matches
        && proofs.len() == 2
        && verify_non_inclusion(target_field, &proofs[0], &proofs[1], expected_root)?;

    let output = OutputJson {
        target_address: args.target,
        target_field: target_field.to_string(),
        expected_root: expected_root.to_string(),
        computed_root: computed_root.to_string(),
        root_matches,
        leaf_count: indexed_leaves.len(),
        target_is_leaf,
        insertion_case,
        left_bound,
        right_bound,
        proofs: proofs
            .into_iter()
            .map(|proof| ProofJson {
                leaf_index: proof.leaf_index,
                siblings: proof.siblings.into_iter().map(|field| field.to_string()).collect(),
            })
            .collect(),
        verify_non_inclusion_local,
    };

    println!("{}", serde_json::to_string_pretty(&output)?);
    Ok(())
}

#[derive(Clone, Debug)]
struct InsertionPoint {
    exact_index: Option<usize>,
    right_index: usize,
}

#[derive(Clone, Debug)]
struct Proof {
    leaf_index: u32,
    siblings: Vec<Field<TestnetV0>>,
}

fn parse_args(tokens: Vec<String>) -> Result<Arguments, Box<dyn Error>> {
    let mut target = None;
    let mut root = None;
    let mut leaves = Vec::new();

    let mut index = 0usize;
    while index < tokens.len() {
        match tokens[index].as_str() {
            "--target" => {
                index += 1;
                target = tokens.get(index).cloned();
            }
            "--root" => {
                index += 1;
                root = tokens.get(index).cloned();
            }
            "--leaf" => {
                index += 1;
                let value = tokens.get(index).cloned().ok_or("missing value for --leaf")?;
                leaves.push(value);
            }
            flag => return Err(format!("unknown argument: {flag}").into()),
        }
        index += 1;
    }

    Ok(Arguments {
        target: target.ok_or("missing --target")?,
        root: root.ok_or("missing --root")?,
        leaves,
    })
}

fn zero_field() -> Field<TestnetV0> {
    Field::<TestnetV0>::from_u8(0)
}

fn one_field() -> Field<TestnetV0> {
    Field::<TestnetV0>::from_u8(1)
}

fn hash_leaf_pair(left: Field<TestnetV0>, right: Field<TestnetV0>) -> Result<Field<TestnetV0>, Box<dyn Error>> {
    Ok(TestnetV0::hash_psd4(&[one_field(), left, right])?)
}

fn hash_internal_pair(left: Field<TestnetV0>, right: Field<TestnetV0>) -> Result<Field<TestnetV0>, Box<dyn Error>> {
    Ok(TestnetV0::hash_psd4(&[zero_field(), left, right])?)
}

fn compute_root(leaves: &[Field<TestnetV0>]) -> Result<Field<TestnetV0>, Box<dyn Error>> {
    if leaves.is_empty() {
        return Err("cannot compute root for an empty leaf set".into());
    }

    let mut level = collapse_leaf_level(leaves)?;
    while level.len() > 1 {
        level = collapse_hash_level(&level)?;
    }
    level.first().copied().ok_or_else(|| "missing computed root".into())
}

fn collapse_leaf_level(leaves: &[Field<TestnetV0>]) -> Result<Vec<Field<TestnetV0>>, Box<dyn Error>> {
    let mut parents = Vec::with_capacity((leaves.len() + 1) / 2);
    let mut index = 0usize;
    while index < leaves.len() {
        let left = leaves[index];
        let right = leaves.get(index + 1).copied().unwrap_or_else(zero_field);
        parents.push(hash_leaf_pair(left, right)?);
        index += 2;
    }
    Ok(parents)
}

fn collapse_hash_level(level: &[Field<TestnetV0>]) -> Result<Vec<Field<TestnetV0>>, Box<dyn Error>> {
    if level.len() <= 1 {
        return Ok(level.to_vec());
    }

    let mut parents = Vec::with_capacity(level.len().div_ceil(2));
    let mut index = 0usize;
    while index < level.len() {
        let left = level[index];
        match level.get(index + 1).copied() {
            Some(right) => parents.push(hash_internal_pair(left, right)?),
            None => parents.push(left),
        }
        index += 2;
    }
    Ok(parents)
}

fn locate_insertion(leaves: &[Field<TestnetV0>], target: Field<TestnetV0>) -> InsertionPoint {
    for (index, leaf) in leaves.iter().enumerate() {
        if *leaf == target {
            return InsertionPoint {
                exact_index: Some(index),
                right_index: index,
            };
        }
        if target < *leaf {
            return InsertionPoint {
                exact_index: None,
                right_index: index,
            };
        }
    }

    InsertionPoint {
        exact_index: None,
        right_index: leaves.len(),
    }
}

fn build_proof(leaves: &[Field<TestnetV0>], leaf_index: usize) -> Result<Proof, Box<dyn Error>> {
    if leaf_index >= leaves.len() {
        return Err(format!("leaf index {leaf_index} out of bounds").into());
    }

    let mut siblings = Vec::with_capacity(PROOF_DEPTH);
    let leaf_value = leaves[leaf_index];
    let sibling_leaf = if leaf_index % 2 == 0 {
        leaves.get(leaf_index + 1).copied().unwrap_or_else(zero_field)
    } else {
        leaves[leaf_index - 1]
    };
    siblings.push(leaf_value);
    siblings.push(sibling_leaf);

    let mut position = leaf_index / 2;
    let mut current_level = collapse_leaf_level(leaves)?;

    while siblings.len() < PROOF_DEPTH && current_level.len() > 1 {
        let sibling_hash = if position % 2 == 0 {
            current_level.get(position + 1).copied().unwrap_or_else(zero_field)
        } else {
            current_level[position - 1]
        };
        siblings.push(sibling_hash);
        current_level = collapse_hash_level(&current_level)?;
        position /= 2;
    }

    siblings.resize(PROOF_DEPTH, zero_field());

    Ok(Proof {
        leaf_index: leaf_index as u32,
        siblings,
    })
}

fn compute_root_from_proof(proof: &Proof) -> Result<Field<TestnetV0>, Box<dyn Error>> {
    let bottom = if proof.leaf_index % 2 == 0 {
        hash_leaf_pair(proof.siblings[0], proof.siblings[1])?
    } else {
        hash_leaf_pair(proof.siblings[1], proof.siblings[0])?
    };

    let mut current = bottom;
    for (offset, sibling_hash) in proof.siblings.iter().enumerate().skip(2) {
        if *sibling_hash == zero_field() {
            continue;
        }

        let bit = ((proof.leaf_index as usize) >> (offset - 1)) & 1;
        current = if bit == 0 {
            hash_internal_pair(current, *sibling_hash)?
        } else {
            hash_internal_pair(*sibling_hash, current)?
        };
    }

    Ok(current)
}

fn verify_non_inclusion(
    target: Field<TestnetV0>,
    left: &Proof,
    right: &Proof,
    expected_root: Field<TestnetV0>,
) -> Result<bool, Box<dyn Error>> {
    let left_root = compute_root_from_proof(left)?;
    let right_root = compute_root_from_proof(right)?;
    if left_root != expected_root || right_root != expected_root {
        return Ok(false);
    }

    let same_index = left.leaf_index == right.leaf_index;
    let at_zero = left.leaf_index == 0;

    if same_index && at_zero {
        return Ok(target < left.siblings[0]);
    }

    if same_index {
        if target <= left.siblings[0] {
            return Ok(false);
        }

        let max_index = rightmost_index_from_zero_padding(left);
        return Ok(left.leaf_index == max_index);
    }

    if left.leaf_index + 1 != right.leaf_index {
        return Ok(false);
    }

    Ok(target > left.siblings[0] && target < right.siblings[0])
}

fn rightmost_index_from_zero_padding(proof: &Proof) -> u32 {
    let mut zero_at = 15u32;
    for index in 2..15 {
        if proof.siblings[index] == zero_field() {
            zero_at = index as u32;
            break;
        }
    }
    let exponent = zero_at.saturating_sub(1);
    (1u32 << exponent) - 1
}

fn bound_to_json(bound: &IndexedLeaf) -> BoundJson {
    BoundJson {
        index: bound.index,
        address: bound.address.clone(),
        field: bound.field.to_string(),
    }
}
