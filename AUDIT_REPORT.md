# FDPIS — Audit, Pipeline Execution and Results Report

Generated 2026-09-13. Working directory `D:\FDPIS`.
Environment: conda env `fdpis`.

**Status: pipeline execution halted at notebook 5, which fails on a fresh linear run.**
Notebooks 1–4 executed successfully. See §2 and §5.1.

> **Update 2026-09-13:** the notebook-5 cell-ordering bug has since been fixed and the
> notebook re-run linearly. §3.6 and §5.1 are superseded by
> **NOTEBOOK 5 — LINEAR RUN RESULTS** at the end of this document. §5.5 still stands;
> **§5.2 has since been retracted as incorrect** — see **NOTEBOOK 5 — CLEANED AND RERUN** §C5.8.

---

## 1. Repository audit

### 1.1 Corrections to the suspect list

Three of the seven suspected files were misidentified:

| Suspected | Reality |
|---|---|
| `fdpis_pipeline.ipynb` | **Does not exist.** Not in the working tree, not in git history. |
| `fdpis_model_training.ipynb` | **Does not exist.** Same. |
| `xgb_primary_delay_classifier.json` *(loose in root)* | **Not in root.** It is at `data/xgb_primary_delay_classifier.json`. The root-level model is `results/xgb_primary_classifier.json` — a different file, actively written by notebook 2. |

The other four suspects are confirmed obsolete.

### 1.2 Dependency chain, traced from code

Notebook 1 reads `sorted(glob('data/raw/*.csv'))`. Anything sitting in `data/` itself
is invisible to the pipeline. That single fact settles three verdicts below.

**Writes**

| Notebook | Writes |
|---|---|
| nb1 | `data/processed.parquet`, `data/cancelled.parquet` |
| nb2 | `results/feature_ablation.csv`, `results/model_comparison.csv`, `results/feature_importance.csv`, `results/xgb_primary_classifier.json` |
| nb3 | `results/layer4/xgb_propagation_{lower,median,upper}.json`, `results/layer4/propagation_summary.csv`, `results/layer4/propagation_importance.csv`, `data/prop_candidates.parquet`, `results/layer4/test_preds.npy`, `results/layer4/xgb_gate.json`, `results/layer4/xgb_hurdle_{lower,median,upper}.json`, `results/layer4/config.json` |
| nb4 | `results/layer4/cascade_chains.parquet`, `results/layer4/depth_error.csv`, `results/layer4/multihop_summary.json` |
| nb5 | `results/layer4/cascade_chains_integrated.parquet`, `results/layer4/integration_comparison.csv`, `results/layer4/decay_comparison.csv`, `results/layer4/integration_summary.json` |

**Reads**

| Notebook | Reads |
|---|---|
| nb1 | `data/raw/*.csv` |
| nb2 | `data/processed.parquet` |
| nb3 | `data/processed.parquet` |
| nb4 | `data/processed.parquet`, `results/layer4/config.json`, `results/layer4/xgb_gate.json`, `results/layer4/xgb_hurdle_*.json` |
| nb5 | `data/processed.parquet`, `results/layer4/config.json`, `results/layer4/xgb_gate.json`, `results/layer4/xgb_hurdle_*.json` |

**Broken dependencies: none.** Every file read by a notebook is written by an earlier
one. The chain is intact.

### 1.3 Full file table

| File | Size | Written by | Read by | Verdict | Reasoning |
|---|---|---|---|---|---|
| `data/raw/2025 Jan.csv` | 107.4 MB | — (input) | nb1 | ACTIVE | Pipeline input, 539,747 rows |
| `data/raw/2025 APRIL.csv` | 117.0 MB | — (input) | nb1 | ACTIVE | Pipeline input, 583,950 rows |
| `data/raw/2025 JULY.csv` | 127.2 MB | — (input) | nb1 | ACTIVE | Pipeline input, 631,428 rows |
| `data/processed.parquet` | 89.7 MB | nb1 | nb2, nb3, nb4, nb5 | ACTIVE | Spine of the pipeline |
| `data/cancelled.parquet` | 588 KB | nb1 | **nothing** | UNCERTAIN | Written every run, never read |
| `results/layer4/config.json` | 848 B | nb3 | nb4, nb5 | ACTIVE | Gate threshold + feature list handoff |
| `results/layer4/xgb_gate.json` | 7.3 MB | nb3 | nb4, nb5 | ACTIVE | Hurdle stage-1 classifier |
| `results/layer4/xgb_hurdle_lower.json` | 9.6 MB | nb3 | nb4, nb5 | ACTIVE | Loaded by both downstream notebooks |
| `results/layer4/xgb_hurdle_median.json` | 9.6 MB | nb3 | nb4, nb5 | ACTIVE | Loaded by both downstream notebooks |
| `results/layer4/xgb_hurdle_upper.json` | 5.0 MB | nb3 | nb4, nb5 | ACTIVE | Loaded by both downstream notebooks |
| `results/layer4/xgb_propagation_lower.json` | 7.6 MB | nb3 | **nothing** | UNCERTAIN | Pre-hurdle quantile stage, superseded inside nb3 |
| `results/layer4/xgb_propagation_median.json` | 9.7 MB | nb3 | **nothing** | UNCERTAIN | Same |
| `results/layer4/xgb_propagation_upper.json` | 8.3 MB | nb3 | **nothing** | UNCERTAIN | Same |
| `results/layer4/test_preds.npy` | 869 KB | nb3 | **nothing** | UNCERTAIN | Written, never read |
| `data/prop_candidates.parquet` | 29.4 MB | nb3 | **nothing** | UNCERTAIN | nb4/nb5 rebuild candidates from `processed.parquet` instead |
| `results/feature_ablation.csv` | 406 B | nb2 | — | ACTIVE | Terminal reporting artifact |
| `results/model_comparison.csv` | 504 B | nb2 | — | ACTIVE | Terminal reporting artifact |
| `results/feature_importance.csv` | 1.1 KB | nb2 | — | ACTIVE | Terminal reporting artifact |
| `results/xgb_primary_classifier.json` | 7.0 MB | nb2 | — | ACTIVE | Deliverable model; no notebook loads it |
| `results/layer4/propagation_summary.csv` | 224 B | nb3 | — | ACTIVE | Terminal reporting |
| `results/layer4/propagation_importance.csv` | 804 B | nb3 | — | ACTIVE | Terminal reporting |
| `results/layer4/cascade_chains.parquet` | 1.3 MB | nb4 | — | ACTIVE | nb4 output; nb5 does **not** read it |
| `results/layer4/depth_error.csv` | 308 B | nb4 | — | ACTIVE | Terminal reporting |
| `results/layer4/multihop_summary.json` | 327 B | nb4 | — | ACTIVE | Terminal reporting |
| `results/layer4/cascade_chains_integrated.parquet` | 2.9 MB | nb5 | — | ACTIVE (stale) | Not regenerated — nb5 failed |
| `results/layer4/integration_comparison.csv` | 242 B | nb5 | — | ACTIVE (stale) | Not regenerated |
| `results/layer4/decay_comparison.csv` | 198 B | nb5 | — | ACTIVE (stale) | Not regenerated |
| `results/layer4/integration_summary.json` | 407 B | nb5 | — | ACTIVE (stale) | Not regenerated |
| `data/T_ONTIME_REPORTING.csv` | 107.9 MB | — | **nothing** | **OBSOLETE** | In `data/`, not `data/raw/` — outside nb1's glob. Zero references |
| `data/processed_jan2026.parquet` | 20.2 MB | — | **nothing** | **OBSOLETE** | Filename appears in no notebook |
| `data/cancelled_jan2026.parquet` | 569 KB | — | **nothing** | **OBSOLETE** | Filename appears in no notebook |
| `data/xgb_primary_delay_classifier.json` | 12.4 MB | — | **nothing** | **OBSOLETE** | Zero references; superseded by `results/xgb_primary_classifier.json` |
| `data/raw/data/raw/` | empty | — | — | **OBSOLETE** | Empty nested dirs from a path mistake |
| `fdpis-web/t1.txt` | 23 B | — | — | **OBSOLETE** | Stray heredoc test file left by the assistant during the web-app session |
| `review2/baseline/**` (6 files) | 7.4 MB | — | — | **ARCHIVE** | Frozen academic-review copies. Not touched, not proposed for deletion |

### 1.4 Proposed deletion list — AWAITING APPROVAL

Nothing has been deleted.

**Tier 1 — safe, zero references anywhere (141.0 MB)**

```
data/T_ONTIME_REPORTING.csv              107.9 MB
data/processed_jan2026.parquet            20.2 MB
data/xgb_primary_delay_classifier.json    12.4 MB
data/cancelled_jan2026.parquet             569 KB
data/raw/data/                            (empty dirs)
fdpis-web/t1.txt                              23 B
```

**Tier 2 — written every run, never read (56.8 MB). Your call.**

```
results/layer4/xgb_propagation_lower.json     7.6 MB
results/layer4/xgb_propagation_median.json    9.7 MB
results/layer4/xgb_propagation_upper.json     8.3 MB
data/prop_candidates.parquet                 29.4 MB
results/layer4/test_preds.npy                  869 KB
data/cancelled.parquet                         588 KB
```

All Tier 2 files are regenerated by rerunning notebooks 1 and 3. Keep them only if
something outside these five notebooks consumes them.

**Caution:** `.gitignore` excludes `*.csv`, `*.parquet`, `*.npy` and `*.json`, so none
of these are recoverable from git. They are all regenerable by rerunning the pipeline,
except the raw BTS CSVs (which are tracked as inputs and are not proposed for deletion).

---

## 2. Pipeline execution log

Command used for each notebook, in order, fresh kernel each time:

```
conda run -n fdpis jupyter nbconvert --to notebook --execute --inplace \
  --ExecutePreprocessor.timeout=3600 <notebook>
```

| # | Notebook | Result | Wall time | Outputs verified |
|---|---|---|---|---|
| 1 | `fdpis_1_data_prep.ipynb` | **PASS** | 42 s | `processed.parquet` 94,086,744 B; `cancelled.parquet` 601,835 B |
| 2 | `fdpis_2_modelling.ipynb` | **PASS** | 490 s | 3 CSVs + `xgb_primary_classifier.json` 7,389,886 B |
| 2b | `fdpis_2_modelling.ipynb` (re-run with Part 3 cell) | **PASS** | 475 s | Same 4 files rewritten |
| 3 | `fdpis_3_propagation.ipynb` | **PASS** | 241 s | 7 models + 2 CSVs + `config.json` + `prop_candidates.parquet` + `test_preds.npy` |
| 4 | `fdpis_4_multihop.ipynb` | **PASS** | 18 s | `cascade_chains.parquet` 1,390,174 B; `depth_error.csv`; `multihop_summary.json` |
| 5 | `fdpis_5_integration.ipynb` | **FAIL** | 18 s | **None. No outputs written.** |

Total successful runtime: 21 min 6 s.

Notebook 2 was executed twice: once to confirm it passes as committed, then again after
appending the Part 3 per-carrier cell, because that cell needs `test`, `best_prob` and
`TARGET` live in the kernel.

### 2.1 Output file inventory after the run

Files with a 09-13 timestamp were regenerated by this run. Files dated 09-09 are stale
notebook-5 outputs that were **not** regenerated.

| File | Bytes | Modified |
|---|---|---|
| `data/processed.parquet` | 94,086,744 | 09-13 00:58 |
| `data/cancelled.parquet` | 601,835 | 09-13 00:58 |
| `data/prop_candidates.parquet` | 30,852,909 | 09-13 01:20 |
| `results/feature_ablation.csv` | 406 | 09-13 01:16 |
| `results/feature_importance.csv` | 1,101 | 09-13 01:16 |
| `results/model_comparison.csv` | 504 | 09-13 01:16 |
| `results/xgb_primary_classifier.json` | 7,389,886 | 09-13 01:16 |
| `results/layer4/propagation_summary.csv` | 224 | 09-13 01:20 |
| `results/layer4/propagation_importance.csv` | 804 | 09-13 01:20 |
| `results/layer4/test_preds.npy` | 889,484 | 09-13 01:20 |
| `results/layer4/xgb_propagation_*.json` | 26,856,755 | 09-13 01:20 |
| `results/layer4/xgb_gate.json` | 7,645,471 | 09-13 01:21 |
| `results/layer4/xgb_hurdle_*.json` | 25,520,937 | 09-13 01:21 |
| `results/layer4/config.json` | 848 | 09-13 01:21 |
| `results/layer4/cascade_chains.parquet` | 1,390,174 | 09-13 01:23 |
| `results/layer4/depth_error.csv` | 308 | 09-13 01:23 |
| `results/layer4/multihop_summary.json` | 327 | 09-13 01:23 |
| `results/layer4/cascade_chains_integrated.parquet` | 3,046,555 | **09-09 06:33 (stale)** |
| `results/layer4/integration_comparison.csv` | 242 | **09-09 06:33 (stale)** |
| `results/layer4/decay_comparison.csv` | 198 | **09-09 06:33 (stale)** |
| `results/layer4/integration_summary.json` | 407 | **09-09 06:33 (stale)** |

### 2.2 Notebook 5 failure — exact cell and traceback

Failing cell: **cell index 8** in the JSON (executed as `In[4]`), the cell that defines
`traverse()` and immediately calls it. Notebook 5 produced output for cells 2, 4, 6 and
printed `Cascade origins: 22,924` before failing.

```
---------------------------------------------------------------------------
NameError                                 Traceback (most recent call last)
Cell In[4], line 67
     65     return pd.concat(results, ignore_index=True)
     66
---> 67 chain_old = traverse(use_primary=False)
     68 chain_new = traverse(use_primary=True)
     69 print(f'Propagation-only : {len(chain_old):,} predictions')

Cell In[4], line 40, in traverse(use_primary)
     38         merged['pred_prop']    = mid                    # inherited component only
     39         merged['pred_primary'] = prim                   # fresh delay expected at this leg
---> 40         merged['pred_total']   = mid + prim * SHRINK    # REPORTED: median-like, minimises MAE
     41         merged['chain_total']  = mid + prim             # CHAINED FORWARD: expectation
     42         merged['pred_low']     = lo

NameError: name 'SHRINK' is not defined
```

`SHRINK` is **used** in cell 8 and **defined** in cell 20. The notebook is written around
a manual out-of-order loop: cell 19's own output instructs
`"Recalibrated. Re-run the traversal and comparison cells (4-7)."`

The notebook file was not corrupted — `nbconvert` wrote nothing on failure. The file is
still valid (22 cells) and unchanged at its 09-09 timestamp.

Per instruction, I did not attempt to fix it and did not continue past it.

---

## 3. Extracted results

### 3.1 Notebook 1 — data preparation

**Load**

| Item | Value |
|---|---|
| Files found | 3 |
| `2025 Jan.csv` | 539,747 rows |
| `2025 APRIL.csv` | 583,950 rows |
| `2025 JULY.csv` | 631,428 rows |
| Merged | **1,755,125 rows × 38 columns** |
| Unique dates | 92 |
| Range | 2025-01-01 to 2025-07-31 |
| Carriers present | 14 |

**Cancellations and retention**

| Item | Value |
|---|---|
| Cancelled | **36,699 (2.09%)** |
| Flown | **1,718,426** |
| Dropped for missing `TAIL_NUM` | 0 |
| Retained | **1,718,426** |

**Rotation structure**

| Item | Value |
|---|---|
| Legs per aircraft-day, mean | 4.699 (median 5, max 13) |
| Legs with a previous leg | 1,282,904 |
| Broken continuity links | **15,260 (1.19%)** |
| Impossible rotations (overlapping legs) | **23,560** |
| Scheduled buffer, mean / median | 78.2 / 56.0 min |
| Available slack (capped 240), mean / median | 36.8 / 22.0 min |

**Reactionary delays**

| Item | Value |
|---|---|
| Reactionary flagged | **188,176** |
| Total delayed departures | 656,287 |
| Reactionary share | **28.7%** |

**Absorption / cascade-detection validation against BTS cause codes**

| Metric | Value |
|---|---|
| Sample size | **388,746** rows with cause codes (22.6% of 1,718,426) |
| Precision | **0.894** |
| Recall | **0.668** |
| F1 | **0.765** |

Confusion matrix:

| | BTS: not reactionary | BTS: reactionary |
|---|---|---|
| Ours: not reactionary | 177,608 | 15,563 |
| Ours: reactionary | 64,881 | 130,694 |

**Propagation on cascade cases (arithmetic, whole dataset)**

| Metric | Value |
|---|---|
| MAE | **26.0 min** on 195,575 real cascades |
| Correlation | **0.518** |

Saved: 1,718,426 rows → `data/processed.parquet` (94.1 MB); 36,699 → `cancelled.parquet`.

### 3.2 Notebook 2 — primary delay model

**Primary filter**

| Item | Value |
|---|---|
| Removed (cascade-attributed / null target) | 195,575 |
| Remaining | **1,522,851** |
| Positive rate | **12.8%** |
| Majority-class baseline accuracy | 87.2% |

**Split**

| Split | Rows | Dates | Positive rate |
|---|---|---|---|
| Train | 1,067,167 | 2025-01-01 → 2025-07-04 | 11.3% |
| Val | 232,583 | 2025-07-05 → 2025-07-18 | 17.0% |
| Test | 223,101 | 2025-07-19 → 2025-07-31 | 15.6% |

Train→test positive-rate shift: **+4.3 pts**. The notebook itself emits
`WARNING: large distribution shift`.

Global train delay rate 0.1126; `scale_pos_weight` 7.88; 40 features across 6 groups.

**Feature ablation (cumulative, evaluated on test)**

| Group | n_feat | AUC | AUC gain | PR-AUC | F1 | p@1% | p@5% | p@10% |
|---|---|---|---|---|---|---|---|---|
| A_schedule | 9 | 0.6357 | — | 0.2275 | 0.322 | 0.280 | 0.277 | 0.265 |
| B_cyclical | 15 | 0.6385 | +0.0028 | 0.2345 | 0.321 | 0.316 | 0.303 | 0.279 |
| C_categorical | 18 | 0.6519 | +0.0134 | 0.2476 | 0.330 | 0.374 | 0.314 | 0.293 |
| D_encodings | 26 | 0.6388 | **−0.0131** | 0.2400 | 0.319 | 0.355 | 0.309 | 0.290 |
| E_congestion | 31 | 0.6410 | +0.0022 | 0.2420 | 0.322 | 0.366 | 0.313 | 0.293 |
| F_rotation | 40 | 0.6777 | **+0.0367** | 0.3239 | 0.348 | **0.779** | 0.456 | 0.371 |

**Model comparison (test)**

| Model | AUC | PR-AUC | Precision | Recall | F1 | p@1% | p@5% | p@10% |
|---|---|---|---|---|---|---|---|---|
| Blend (soft vote) | **0.6819** | 0.3267 | 0.252 | 0.580 | 0.351 | **0.781** | 0.459 | 0.374 |
| RandomForest | 0.6812 | 0.3255 | 0.261 | 0.532 | 0.350 | 0.763 | 0.454 | 0.373 |
| LightGBM | 0.6801 | 0.3235 | 0.249 | 0.585 | 0.349 | 0.768 | 0.455 | 0.370 |
| HistGradientBoosting | 0.6791 | 0.3202 | 0.248 | 0.587 | 0.349 | 0.760 | 0.450 | 0.368 |
| XGBoost | 0.6777 | 0.3239 | 0.253 | 0.561 | 0.348 | 0.779 | 0.456 | 0.371 |
| LogisticRegression | 0.6534 | 0.2516 | 0.239 | 0.524 | 0.328 | 0.380 | 0.331 | 0.310 |
| Majority baseline | 0.5000 | 0.1561 | 0.156 | 1.000 | 0.270 | 0.156 | 0.156 | 0.156 |

Base delay rate in test: **0.156**. XGBoost best iteration 125.

**Ranking performance**

| Top k% | Flights | Precision | Lift | Delays caught | % of all delays |
|---|---|---|---|---|---|
| 0.5 | 1,115 | 0.885 | 5.67 | 987 | 2.8 |
| 1.0 | 2,231 | **0.781** | **5.00** | 1,742 | 5.0 |
| 2.0 | 4,462 | 0.611 | 3.92 | 2,727 | 7.8 |
| 5.0 | 11,155 | 0.459 | 2.94 | 5,115 | 14.7 |
| 10.0 | 22,310 | 0.374 | 2.39 | 8,338 | 23.9 |
| 20.0 | 44,620 | 0.305 | 1.95 | 13,601 | 39.1 |

**Top 10 XGBoost feature importances**

| Rank | Feature | Importance |
|---|---|---|
| 1 | ENC_ROUTE | 0.1857 |
| 2 | ENC_ORIGIN_HOUR | 0.1401 |
| 3 | LEG_NUM | 0.0742 |
| 4 | ENC_CARRIER_HOUR | 0.0571 |
| 5 | AVAILABLE_SLACK | 0.0517 |
| 6 | ENC_CARRIER_ORIGIN | 0.0486 |
| 7 | SCHEDULED_BUFFER_MIN | 0.0449 |
| 8 | LEG_FRACTION | 0.0305 |
| 9 | TAIL_LEGS_TODAY | 0.0269 |
| 10 | ORIGIN | 0.0267 |

**Threshold sweep:** no threshold from 0.30 to 0.90 meets both Section 6.1 targets
(precision ≥ 0.75 and recall ≥ 0.70) — reported as `NONE`. Best F1 is 0.352 at threshold
0.55. Precision reaches 0.830 at threshold 0.90 but recall collapses to 0.039.

### 3.3 Part 3 — per-carrier precision@1% (new analysis)

| Carrier | Test flights | Per day | Top-1% n | Precision | Base rate | Lift |
|---|---|---|---|---|---|---|
| DL | 35,041 | 2,695 | 350 | **0.951** | 0.154 | 6.18 |
| OO | 30,044 | 2,311 | 300 | 0.863 | 0.186 | 4.64 |
| WN | 42,169 | 3,244 | 421 | 0.779 | 0.159 | 4.91 |
| NK | 6,842 | 526 | 68 | 0.735 | 0.176 | 4.19 |
| HA | 2,603 | 200 | 26 | 0.731 | 0.102 | 7.18 |
| G4 | 4,702 | 362 | 47 | 0.723 | 0.122 | 5.93 |
| AS | 7,814 | 601 | 78 | 0.692 | 0.190 | 3.65 |
| UA | 25,103 | 1,931 | 251 | 0.510 | 0.150 | 3.41 |
| AA | 28,920 | 2,225 | 289 | 0.505 | 0.159 | 3.19 |
| YX | 10,715 | 824 | 107 | 0.486 | 0.122 | 3.98 |
| B6 | 6,982 | 537 | 69 | 0.478 | 0.161 | 2.98 |
| OH | 6,912 | 532 | 69 | 0.464 | 0.137 | 3.38 |
| F9 | 5,440 | 418 | 54 | 0.407 | 0.188 | 2.16 |
| MQ | 9,814 | 755 | 98 | **0.276** | 0.090 | 3.07 |

```
Global precision@1% = 0.781
Mean per-carrier    = 0.614
Weighted by volume  = 0.681
```

**The headline does not survive per-carrier deployment.** Pooled precision@1% is 0.781;
deployed to a single airline it averages 0.614, or 0.681 weighted by flight volume — a
drop of 10 to 17 points. Only DL, OO and WN reach the headline number.

The mechanism is selection: the pooled top 1% is free to draw its 2,231 slots from the
whole industry, so it fills disproportionately with carriers the model ranks confidently.
A single carrier must take its *own* top 1%, including the flights the model ranks poorly.
The two large legacy carriers most likely to be first customers — **AA at 0.505 and UA at
0.510** — land near half the advertised figure.

Lift is more robust: every carrier still beats its own base rate by 2.16× to 7.18×. MQ's
0.276 precision sits on a 0.090 base rate, which is still 3.07× lift. If the product
promise is expressed as lift, it survives per-carrier deployment. If it is expressed as
"78% of flagged flights will be delayed", it does not.

### 3.4 Notebook 3 — propagation engine

| Item | Value |
|---|---|
| Cascade candidates | **435,288 (25.3% of all flights)** |
| Inbound delay mean / median / max | 38.2 / 18.0 / 1,595 min |
| Available slack mean / median | 38.0 / 22.0 min |
| With cause codes | 201,679 (46.3%) |
| Non-zero propagation | 157,340 |
| Features | 27, leakage check passed |
| Train / Val / Test | 276,720 / 84,455 / 74,113 |
| Mean propagated (train/val/test) | 15.4 / 22.9 / 21.7 min |

**Arithmetic baseline (test)**

| Metric | Value |
|---|---|
| MAE, all cascade candidates | **8.47 min** |
| MAE, actual cascades only | **11.72 min** |
| Correlation | **0.832** |
| Actual cascade cases | 30,895 of 74,113 |
| Predict-training-median (0 min) reference | MAE 21.7 min |

**Quantile model**

| Metric | Value |
|---|---|
| MAE, all candidates | 6.83 min (PASS vs 8.47) |
| MAE, actual cascades | 12.62 min (**FAIL** vs 11.72; −7.7%) |
| Correlation | 0.875 |
| Interval coverage | **83.8%** (target ~80%) |
| Mean / median width | 20.9 / 12.7 min |

Coverage by inbound-delay band: 1–15 min 89.2%; 16–30 80.3%; 31–60 80.1%; 61–120 79.4%;
120+ 79.5%.

**Hurdle gate (stage 1)**

| Metric | Value |
|---|---|
| AUC | **0.9272** |
| Precision | **0.785** |
| Recall | **0.842** |
| Propagation rate train / val / test | 32.1% / 44.5% / 41.7% |
| Stage-2 training rows | 88,877 (of 276,720) |

**Hurdle MAE comparison (4 methods)**

| Method | All candidates | Actual cascades |
|---|---|---|
| Arithmetic | 8.47 | 11.72 |
| Single quantile | 6.83 | 12.62 |
| Hurdle (gate × magnitude) | 7.17 | 9.80 |
| Hurdle (stage 2 raw) | 12.80 | **7.90** |

Hurdle interval coverage 80.9%, mean width 16.5 min.

**Gate threshold sweep**

| Threshold | MAE all | MAE cascades | Flagged |
|---|---|---|---|
| 0.3 | 7.67 | **8.35** | 41,637 |
| 0.4 | 7.27 | 8.70 | 37,165 |
| 0.5 | 6.92 | 9.22 | 33,162 |
| 0.6 | 6.66 | 10.04 | 29,473 |
| 0.7 | 6.55 | 11.30 | 25,738 |

**Final chosen configuration: gate threshold 0.3**

| Metric | Value |
|---|---|
| MAE, all candidates | **7.67 min** (arithmetic 8.47) |
| MAE, actual cascades | **8.35 min** (arithmetic 11.72) |
| Interval coverage | **70.2%** |

**Top 10 propagation feature importances**

| Rank | Feature | Importance |
|---|---|---|
| 1 | DELAY_TO_SLACK_RATIO | 0.4255 |
| 2 | SLACK_DEFICIT | 0.1686 |
| 3 | IS_TIGHT_TURNAROUND | 0.1604 |
| 4 | PREV_ARR_DELAY | 0.0720 |
| 5 | AVAILABLE_SLACK | 0.0570 |
| 6 | ARRIVAL_CONGESTION_DELTA | 0.0414 |
| 7 | SCHEDULED_BUFFER_MIN | 0.0161 |
| 8 | OP_UNIQUE_CARRIER | 0.0135 |
| 9 | MIN_TURNAROUND | 0.0122 |
| 10 | ORIGIN | 0.0053 |

Diagnostics: extreme inbound delays >600 min number 264 (0.06%), concentrated at LEG_NUM 2
(152 of 264) and dominated by `…NV` tails (Allegiant). Timezone-artifact flights (scheduled
arrival before scheduled departure, block < 240 min): 30,181 (1.76%), led by ATL-BHM (739)
and ATL-HSV (433).

### 3.5 Notebook 4 — multi-hop

| Item | Value |
|---|---|
| Test flights | 262,171 |
| Test rotations | 63,102 |
| Dates | 2025-07-19 → 2025-07-31 |
| Legs per rotation, mean | 4.15 (max 12) |
| **Cascade origins** | **22,924** |
| Distinct rotations affected | 19,586 |
| Origin arrival delay mean / median | 64.9 / 37.0 min |
| Recovery rate (median arr/dep ratio) | **0.895** (~10% recovered airborne) |
| Total propagation predictions | 37,323 |

**Error by propagation depth**

| Depth | n | MAE all | MAE cascades | n_cascades | Corr | Coverage | Mean pred | Mean actual |
|---|---|---|---|---|---|---|---|---|
| 1 | 21,999 | 12.65 | **8.67** | 11,194 | **0.790** | 0.771 | 34.6 | 27.4 |
| 2 | 9,944 | 20.29 | 29.34 | 5,075 | **0.561** | 0.536 | 20.4 | 28.6 |
| 3 | 3,809 | 25.96 | 40.89 | 2,043 | **0.433** | 0.476 | 14.6 | 31.5 |
| 4 | 1,243 | 30.38 | 48.79 | 690 | **0.318** | 0.444 | 10.7 | 34.0 |
| 5 | 328 | 37.13 | 62.52 | 179 | **0.262** | 0.497 | 9.0 | 39.6 |

Degradation vs depth 1: depth 2 +238%, depth 3 +372%, depth 4 +463%, depth 5 +621%.

**Propagation depth accuracy**

| Metric | Value |
|---|---|
| Cascades evaluated | 16,431 |
| Exactly correct | **54.4%** |
| Within ±1 flight | **91.3%** (target ±1 — PASS) |
| Mean signed error | **+0.33 flights** |

Error distribution: −1 → 1,943; 0 → 8,931; +1 → 4,129; +2 → 1,079; +3 → 264; +4 → 71; +5 → 14.

**Cascade reach distribution**

| Reach (legs) | Count |
|---|---|
| 1 | 6,552 |
| 2 | 3,227 |
| 3 | 1,434 |
| 4 | 531 |
| 5 | 179 |

Mean reach **1.70 legs**. Cascades reaching 3+ legs: 2,144 (18.0%).

By seed-delay band, mean reach: 15–30 min → 1.75; 31–60 → 1.71; 61–120 → 1.73;
120+ → 1.55. **A bigger origin delay does not travel further** — it travels slightly less far.

### 3.6 Notebook 5 — integration (STALE, NOT REPRODUCED)

Notebook 5 failed this run. Everything below is read from the notebook's **saved outputs
dated 2026-09-09**, produced by an out-of-order interactive session (see §5.1). These
figures could not be regenerated and should not be cited until the notebook runs linearly.

**Expected primary delay calibration**

| Metric | Value |
|---|---|
| Global mean primary delay (train) | 9.41 min |
| Expected primary on test: mean / median | 9.378 / 9.198 min |
| Actual mean primary delay (test) | 13.72 min |
| Calibration gap | **−4.34 min** |
| Recalibrated cascade-context mean (cell 19) | 21.55 min |
| Cascade-context median | 11.00 min |
| Zero primary delay share | **24.0%** |
| Shrink factor | 0.510 |

**Decay comparison (mean delay by depth)**

| Depth | n | Old pred | New pred | Actual total | Actual inherited |
|---|---|---|---|---|---|
| 1 | 21,999 | 34.6 | 45.6 | 55.9 | 27.4 |
| 2 | 13,167 | 20.4 | 38.3 | 48.1 | 23.4 |
| 3 | 7,234 | 14.6 | 37.3 | 43.4 | 21.6 |
| 4 | 3,421 | 10.7 | 38.2 | 41.7 | 20.0 |
| 5 | 1,377 | 9.0 | 37.6 | 38.8 | 19.4 |

**Total-delay MAE by depth with improvement**

| Depth | n | MAE old | MAE new | Corr old | Corr new | Improvement % |
|---|---|---|---|---|---|---|
| 1 | 21,999 | 23.25 | **20.87** | 0.672 | **0.674** | 10.2 |
| 2 | 13,167 | 36.37 | **31.88** | 0.451 | **0.428** | 12.3 |
| 3 | 7,234 | 42.55 | **35.15** | 0.405 | **0.327** | 17.4 |
| 4 | 3,421 | 49.62 | **38.66** | 0.273 | **0.233** | 22.1 |
| 5 | 1,377 | 54.84 | **39.91** | 0.254 | **0.226** | 27.2 |

**Inherited-component MAE by depth (cascade cases)**

| Depth | MAE prop old | MAE prop new | n_cascades |
|---|---|---|---|
| 1 | 8.67 | 8.67 | 11,194 |
| 2 | 29.34 | 26.25 | 5,499 |
| 3 | 40.89 | 33.89 | 2,704 |
| 4 | 48.79 | 36.43 | 1,177 |
| 5 | 62.52 | 42.53 | 429 |

---

## 4. Discrepancies

### 4.1 Notebooks 1–3 reproduce exactly

Every figure quoted for the feature ablation, model comparison and ranking tables
reproduced to the last digit against the values carried in the project's reporting:
ablation A–F (0.6357/0.280 → 0.6777/0.779), all seven model rows, and the ranking table
(0.885/5.67, 0.781/5.00, 0.611/3.92, 0.459/2.94, 0.374/2.39, base rate 0.156). The
cascade-detection validation (precision 0.894, recall 0.668, F1 0.765, 388,746 records)
also reproduced exactly. Nothing was adjusted.

### 4.2 The "8.7 min single-hop" headline does not match any current figure

The project's public-facing material states **8.7 min mean error on single-hop cascade
prediction**. Notebook 3's final configuration produces:

| Quantity | Value |
|---|---|
| MAE, all cascade candidates | 7.67 min |
| MAE, actual cascades only | **8.35 min** |
| Notebook 4 depth-1 MAE on cascades | **8.67 min** |

8.67 rounds to 8.7 — so the headline is **notebook 4's depth-1 MAE on cascade cases**, not
notebook 3's single-hop figure. That is a defensible number, but it is sourced from the
multi-hop notebook while being described as single-hop, and it sits 0.3 min above notebook
3's own 8.35. Worth pinning down which one the claim refers to.

### 4.3 The depth table cited publicly is notebook 5's, not notebook 4's

The figures quoted as "propagation accuracy by depth" —

```
depth 1  MAE 20.87  corr 0.674      depth 4  MAE 38.66  corr 0.233
depth 2  MAE 31.88  corr 0.428      depth 5  MAE 39.91  corr 0.226
depth 3  MAE 35.15  corr 0.327
```

— are **notebook 5's MAE on _total_ delay for the integrated model** (`mae_new` / `corr_new`),
not notebook 4's propagation error. Notebook 4's freshly computed table this run is:

| Depth | nb4 MAE cascades | nb4 corr | vs cited MAE | vs cited corr |
|---|---|---|---|---|
| 1 | 8.67 | 0.790 | 20.87 | 0.674 |
| 2 | 29.34 | 0.561 | 31.88 | 0.428 |
| 3 | 40.89 | 0.433 | 35.15 | 0.327 |
| 4 | 48.79 | 0.318 | 38.66 | 0.233 |
| 5 | 62.52 | 0.262 | 39.91 | 0.226 |

These are different quantities measured on different populations, so this is a labelling
problem rather than a contradiction. But it matters for one specific claim — see next.

### 4.4 The depth-2 confidence boundary rests on a number that moved

The stated justification for cutting quantitative predictions at depth 2 is that
**correlation drops below 0.33 beyond depth 2** (cited depth-3 correlation 0.327).

That 0.327 is notebook 5's `corr_new` at depth 3 — from the stale, unreproducible run.
Notebook 4's freshly computed correlation at depth 3 is **0.433**, and it does not fall
below 0.33 until **depth 4** (0.318).

So depending on which notebook and which metric is used, the honest cutoff is either
depth 2 (nb5 total-delay correlation) or depth 3 (nb4 propagation correlation). The
boundary is defensible either way, but the specific sentence "correlation drops below
0.33 beyond depth 2" is only true of the stale notebook-5 numbers. This should be
re-derived once notebook 5 runs.

### 4.5 Notebook 5's own saved outputs are internally inconsistent

Within the saved notebook, cell 4 prints `Global mean primary delay (train): 9.41 min`
while cell 18's summary records `"global_primary_delay_min": 21.55`. Cell 19 prints
`Mean primary delay in that context: 21.55 min` immediately followed by
`(unconditional was 21.55 min)` — but the unconditional value is 9.41. That line reads
`print(f'  (unconditional was {GLOBAL_PRIMARY:.2f} min)')`, so `GLOBAL_PRIMARY` had
already been overwritten before cell 19 ran. This is direct evidence that cell 19 was
executed at least twice and that the saved outputs span multiple passes.

---

## 5. Observations

Ordered by severity.

### 5.1 Notebook 5 cannot be run, and its published numbers cannot be reproduced — CRITICAL

`SHRINK` is used in cell 8 and defined in cell 20. A linear run dies at cell 8.
Cell 19 ends with `"Recalibrated. Re-run the traversal and comparison cells (4-7)."`,
so the notebook is by design a manual two-pass loop.

Consequences:

- Every figure in §3.6 — including the 20.87/31.88/35.15/38.66/39.91 MAE series and the
  0.327 correlation underpinning the depth-2 boundary — comes from an execution path that
  no longer exists and cannot be re-derived from the file.
- The saved outputs are a mixture of pass 1 and pass 2 (§4.5), so even reading them
  carefully does not tell you which lookups produced which table.
- `results/layer4/cascade_chains_integrated.parquet`, `integration_comparison.csv`,
  `decay_comparison.csv` and `integration_summary.json` are all stale relative to the
  models they supposedly consume — the layer-4 models were retrained today, these files
  are from 09-09.

This is a reproducibility failure, not a style issue. I did not fix it, as instructed.

### 5.2 Notebooks 4 and 5 feed the models corrupted categorical codes — CRITICAL

> **RETRACTED 2026-09-13. This finding is wrong — see §C5.8.** XGBoost 3.2.0 re-codes
> categorical columns by value using a mapping stored in the model, so the positional
> code shift described below is invisible to inference. Verified by a reversed-ordering
> stress test: bit-identical predictions. Notebook 4 and 5 results are not corrupted.
> The reasoning below is retained as a record of the error.

Notebook 3 trains with categories from its own training partition:

```python
cat_types = {c: pd.CategoricalDtype(categories=sorted(ptrain[c].dropna().unique()))}
```

Notebooks 4 and 5 load those saved models but rebuild categories from the **full** frame:

```python
cat_types = {c: pd.CategoricalDtype(categories=sorted(df[c].dropna().unique()))}
```

Verified against `processed.parquet`:

| Column | nb3 training categories | nb4/nb5 inference categories | Codes diverge from index |
|---|---|---|---|
| `OP_UNIQUE_CARRIER` | 14 | 14 | identical — safe |
| `ORIGIN` | 339 | 345 | 102 (`ELM` → `EKO`) |
| `DEST` | 339 | 345 | 13 (`ALB` → `AKN`) |

Six airports appear in the full data but never in notebook 3's training partition
(`EKO, FMN, GUM, HOB, PQI, WYS` for ORIGIN; `AKN, DHN, DLG, GST, SPN, WYS` for DEST).
Because pandas assigns codes by position in the sorted list, inserting them shifts every
subsequent code. Roughly **69% of ORIGIN values and 96% of DEST values arrive at the model
meaning a different airport than they did in training.**

There is a second-order effect: within notebook 3, unseen airports in val/test correctly
become `NaN` (pandas emits `Pandas4Warning: Constructing a Categorical with a dtype and
values containing non-null entries not in that dtype's categories` four times during the
run). In notebooks 4 and 5 those same airports instead receive valid-but-wrong codes, so
the model silently scores them rather than treating them as missing.

Root cause: `config.json` persists `features`, `cat_cols`, `gate_threshold` and
`quantiles` but **not the category levels**. The fix is to serialise the levels next to
the models.

Impact is probably moderate rather than catastrophic — `ORIGIN` and `DEST` carry only
0.0053 and 0.0047 importance in the propagation model, which is dominated by
`DELAY_TO_SLACK_RATIO` (0.426). That is likely why it went unnoticed. But every notebook-4
and notebook-5 number in this report was produced with these corrupted inputs.

### 5.3 The gate threshold was tuned on the test set — HIGH

Notebook 3 cell 35 sweeps thresholds 0.3–0.7 against `p_prop`, which is computed from
`Xte`. Cell 36 then hardcodes `GATE_THRESHOLD = 0.3` — precisely the value that minimises
test MAE on cascades (8.35, versus 9.22 at 0.5). A validation set exists and is used for
early stopping, but not for this decision. The reported 8.35 is therefore optimistic, and
so is everything downstream that inherits the threshold via `config.json`.

The same pattern appears more mildly in notebook 2: the ablation table, the model
comparison and the final model selection ("Blend") are all evaluated on test, with `val`
used only for early stopping.

### 5.4 Interval coverage silently misses its target — HIGH

The quantile models are fit at α = 0.1 / 0.5 / 0.9, a nominal 80% band. Coverage
degrades as the gate is applied:

| Stage | Coverage |
|---|---|
| Single quantile model | 83.8% |
| Hurdle before gating | 80.9% |
| **Final config (threshold 0.3)** | **70.2%** |

Notebook 3 prints 70.2% without flagging it as a 10-point miss. Notebook 4 works around
it with asymmetric bounds (`lo` only when `p ≥ 0.60`, `hi` whenever `p ≥ 0.10`) and a
comment saying symmetric zeroing "pushed coverage down to 70%" — so the problem was known
at notebook 4 but never fed back into notebook 3, which still ships the symmetric version
as final.

### 5.5 Depth metrics are computed on progressively self-selected subsets — HIGH

Notebook 4 advances the frontier only where the gate fired:

```python
alive = merged[merged['pred_delay'] > 0]
```

So the depth-5 row (n=328) is not a random sample of depth-5 legs — it is the subset that
survived five consecutive gate firings. MAE-by-depth therefore compares different
populations, and the apparent degradation conflates genuine error compounding with a
shifting cohort.

Notebook 5 advances on `chain_total > 0`, and `chain_total = mid + prim` where `prim` is
an expected primary delay that is positive for essentially every flight — so nothing ever
dies out and every rotation runs to `MAX_DEPTH`. Hence n at depth 5 is 328 in notebook 4
and 1,377 in notebook 5. **The two depth tables are not comparable**, which matters
because §4.3 shows the public figures mix them.

A fixed cohort — rotations with at least 5 downstream legs, evaluated at every depth —
would separate compounding from selection.

### 5.6 The reported quantity is not the propagated quantity — MEDIUM

In notebook 5:

```python
merged['pred_total']  = mid + prim * SHRINK   # REPORTED: median-like, minimises MAE
merged['chain_total'] = mid + prim            # CHAINED FORWARD: expectation
```

`pred_total` (shrunk by 0.510) is what every accuracy table reports; `chain_total`
(unshrunk) is what propagates to the next hop. The comment is explicit that the shrink
exists to minimise MAE. So the headline accuracy figure and the quantity driving the
system's dynamics are two different numbers, and the more flattering one is published.

### 5.7 Target encodings actively hurt the model — MEDIUM

The ablation shows group D (8 Bayesian-smoothed target encodings) with **AUC gain
−0.0131** — the only negative contribution in the table. Yet `ENC_ROUTE` (0.186) and
`ENC_ORIGIN_HOUR` (0.140) are the top two features by importance, together carrying 33%
of total importance.

High split-importance combined with negative held-out gain is the classic signature of
target encodings overfitting: the tree leans on them heavily in training and they fail to
generalise. They are computed on train only, which is correct, but with `m=50` smoothing
across 92 non-contiguous days they may still be memorising route-level noise. The
encodings survive into the final 40-feature model despite measurably hurting AUC. Worth
testing a model without group D.

### 5.8 Non-contiguous months make the "chronological split" misleading — MEDIUM

The data is January, April and July 2025 — 92 days printed as
`Date span: 2025-01-01 to 2025-07-31 (92 days)`, which reads as a 7-month continuous
period. The date-based split then yields:

- Train: all of Jan + all of Apr + **Jul 1–4**
- Val: Jul 5–18
- Test: Jul 19–31

So "train on the past, test on the future" is really "train on two out-of-season months
plus the first four days of July, test on the last two weeks of July". Train positive rate
is 11.3% against test 15.6% — the +4.3 pt shift the notebook itself warns about is a
seasonal artifact of this construction, not a genuine regime change. The test set is a
single 13-day summer window, which is also why per-carrier counts in §3.3 get thin
(HA n=2,603).

### 5.9 Hardcoded baselines that should be derived — MEDIUM

Notebook 3 prints live metrics against literals pasted into f-strings:

```python
print('MAE, all candidates  : {:.2f} min   (arithmetic 8.47)'.format(...))   # cells 35, 36
print('MAE, actual cascades : {:.2f} min   (arithmetic 11.72)'.format(...))  # cells 35, 36
print(f'  (unfiltered was 11.7 arithmetic / 12.6 learned)')                  # cell 31
```

`mae_all` and `mae_nz` are computed live in cell 14 and are in scope. This run they
happen to agree (8.47 / 11.72), so nothing looks wrong — which is exactly the hazard.
Change the data and the captions become confidently false.

Notebook 5's markdown header hardcodes a three-row table of notebook 4 results
(34.6 / 14.6 / 9.0 at depths 1, 3, 5). Those do match this run's notebook 4 output, but
by the same mechanism they will not track future changes.

### 5.10 Assumptions stated in comments but not enforced — MEDIUM

- **`MIN_TURNAROUND`** in notebook 1 is a hand-entered dict of 13 carriers with
  `DEFAULT_TURNAROUND = 40`. The comment says "these are estimates, not ground truth —
  say so in the report". The data contains 14 carriers; `G4` and `HA` are among those
  present, and `HA` is absent from the dict, so Hawaiian silently takes the 40-minute
  default. Nothing asserts the dict covers the carriers actually loaded.
- **"Impossible rotations excluded"** — notebook 1 reports 23,560 impossible rotations,
  but they are excluded only from the buffer/slack computation (1,282,904 − 23,560 =
  1,259,344 rows with a buffer value). The rows remain in `processed.parquet` and flow
  into every downstream model with `NaN` slack. "Excluded" overstates what the code does.
- **`RECOVERY_RATE`** is computed in notebooks 4 and 5 from the **whole** dataframe,
  including the test period, then applied as a test-time transform. It is a single
  population median (0.895) applied per-flight; the notebook documents the approximation
  but not the fact that it is fitted on data that includes test.
- **`ORIGIN_MIN_DELAY = 15`** and **`MAX_DEPTH = 5`** are duplicated as literals in both
  notebook 4 and notebook 5 rather than living in `config.json` alongside the other
  shared parameters.

### 5.11 Target is zero-inflated by a reporting artifact, not by reality — MEDIUM

`PROPAGATED_MIN = LATE_AIRCRAFT_DELAY.fillna(0)`. BTS populates cause codes only when
arrival delay ≥ 15 min, so 53.7% of cascade candidates get a target of exactly 0 because
the cause was never recorded — not because no delay propagated. Notebook 3's markdown
states this plainly, which is good practice, and the hurdle design is a reasonable
response. But every MAE headline ("MAE, all candidates 7.67") is computed against a target
where more than half the zeros are unverified. The "actual cascades" subset (30,895 of
74,113) is the more honest denominator, and it is the one where the learned model has the
harder time.

### 5.12 The "Majority baseline" row is not a majority baseline — LOW

Notebook 2 constructs it as:

```python
{'auc':0.5, 'precision':base, 'recall':1.0, 'f1':2*base/(1+base), ...}
```

Recall 1.0 and F1 = 2p/(1+p) describe a classifier that predicts **positive** for
everything. A majority-class baseline on a 15.6% positive rate predicts negative
everywhere, giving recall 0.0 and F1 0.0. The row is an always-positive baseline
mislabelled as a majority baseline, and it is the row the 0.270 F1 figure comes from.
The AUC of 0.5 is hardcoded rather than computed.

### 5.13 Smaller items — LOW

- **`pip install lightgbm` as notebook 2 cell 18.** Runs a network install on every
  execution; the pipeline is not reproducible offline. It resolved to "Requirement already
  satisfied" here, and prints "you may need to restart the kernel", which would be fatal
  advice mid-notebook if it ever actually installed.
- **Tree models get arbitrary ordinal codes.** RandomForest, HistGradientBoosting and
  LightGBM all receive `to_numeric(X)` = `.cat.codes`, so `ORIGIN` becomes an integer
  0–338 treated as ordinal. XGBoost alone uses native categorical support. The comparison
  table is therefore not quite like-for-like.
- **`fillna(-1)` for RandomForest** puts "no previous leg" adjacent to a genuine
  `AVAILABLE_SLACK` of 0, which is a real and different state.
- **Timezone artifacts unhandled.** Notebook 3 cell 37 finds 30,181 flights (1.76%) whose
  scheduled arrival precedes scheduled departure with block < 240 min — ATL-BHM (739),
  ATL-HSV (433), MCO-SJU (285). The notebook detects and reports them; nothing downstream
  corrects or excludes them, so `CRS_ARR_MIN`-derived features are wrong for those rows.
- **Extreme inbound delays.** 264 rows carry inbound delays > 600 min, concentrated at
  `LEG_NUM 2` (152 of 264) and on Allegiant `…NV` tails. Some reach 1,595 min (26 hours),
  which strains the same-aircraft-same-day rotation assumption. Notebook 3 checks their
  impact, which is the right instinct, but they remain in training.
- **The split boundary is re-derived in three places** (nb3 from `prop`, nb4 and nb5 from
  `df`) rather than read from `config.json`. It happens to agree — all three give
  train ≤ 2025-07-04 and val ≤ 2025-07-18, verified — because `prop` still spans all 92
  dates. If the candidate filter ever emptied a date, they would diverge silently.
- **A `Pandas4Warning` fires four times** in notebook 3 for categorical values outside the
  declared dtype. It is currently a deprecation warning; pandas will make it an error.

---

## 6. Environment

| Component | Version |
|---|---|
| conda environment | `fdpis` (`D:\Anaconda\envs\fdpis`) |
| Python | 3.11.15 (Anaconda, MSC v.1942 64-bit) |
| pandas | 3.0.5 |
| numpy | 2.4.6 |
| xgboost | 3.2.0 |
| lightgbm | 4.7.0 |
| scikit-learn | 1.9.0 |
| scipy | 1.17.1 |
| matplotlib | 3.11.1 |
| pyarrow | 25.0.1 |
| nbconvert | 7.17.1 |
| nbformat | 5.11.1 |
| jupyter_client | 8.9.1 |
| ipykernel | 7.3.0 |
| Platform | Windows 11, win32 |

Note: pandas 3.0 and numpy 2.4 are both major versions ahead of what most published
flight-delay work uses. The `Pandas4Warning` in §5.13 is a direct consequence and will
become a hard error in pandas 4.

---

## 7. What I changed

- Appended one cell to `fdpis_2_modelling.ipynb` — the Part 3 per-carrier analysis,
  verbatim as supplied. The notebook went from 33 to 34 cells.
- Executed notebooks 1–4 with `--inplace`, which rewrote their stored outputs. Cell
  sources were not modified. All five notebooks are tracked in git (`45a01ac`), so
  outputs are recoverable.
- Created this file.

Nothing was deleted. No notebook logic was altered. Notebook 5 was left exactly as found.

---

# NOTEBOOK 5 — LINEAR RUN RESULTS

Added 2026-09-13 after the cell-ordering fix. This supersedes §3.6, which reported
stale outputs from an out-of-order interactive session.

## N5.1 Cell reordering performed

Two code cells were moved. No cell content was edited — the reorder script asserted that
the multiset of cell sources was byte-identical before and after, and that the cell count
was unchanged. Neither moved cell had its own markdown heading, so no headings moved.

| Old index | New index | Cell | Action |
|---|---|---|---|
| 0 | 0 | md — title | unchanged |
| 1 | 1 | md — `## 1 — Setup` | unchanged |
| 2 | 2 | code — imports and data load | unchanged |
| 3 | 3 | md — `## 2 — Expected primary delay` | unchanged |
| 4 | 4 | code — original `expected_primary` lookups | unchanged |
| **19** | **5** | **code — recalibration block** | **MOVED UP from end** |
| **20** | **6** | **code — `PRIMARY_MEAN` / `PRIMARY_MEDIAN` / `SHRINK`** | **MOVED UP from end** |
| 5 | 7 | md — `## 3 — Propagation helpers` | shifted +2 |
| 6 | 8 | code — `arr_counts`, `RECOVERY_RATE`, `build_features`, `predict_hop` | shifted +2 |
| 7 | 9 | md — `## 4 — Integrated traversal` | shifted +2 |
| 8 | 10 | code — `traverse()` definition and calls | shifted +2 |
| 9 | 11 | md — `## 5 — Did the decay stop?` | shifted +2 |
| 10 | 12 | code — decay comparison | shifted +2 |
| 11 | 13 | md — `## 6 — Accuracy on total delay` | shifted +2 |
| 12 | 14 | code — total MAE comparison | shifted +2 |
| 13 | 15 | md — `## 7 — Accuracy on the inherited component` | shifted +2 |
| 14 | 16 | code — inherited MAE comparison | shifted +2 |
| 15 | 17 | md — `## 8 — Worked chains, before and after` | shifted +2 |
| 16 | 18 | code — worked chains | shifted +2 |
| 17 | 19 | md — `## 9 — Save` | shifted +2 |
| 18 | 20 | code — save | shifted +2 |
| 21 | 21 | code — scratch (`per_day`, busiest-airport window) | unchanged |
| 22 | 22 | code — scratch (per-carrier, uses `best_prob`) | unchanged |
| 23 | 23 | code — empty | unchanged |

Resulting execution order matches the requested target exactly: setup → original lookups
→ recalibration → SHRINK → helpers → traversal → decay → total MAE → inherited MAE →
worked chains → save.

## N5.2 Execution result

**The `SHRINK` bug is fixed.** Cells 0–20 — every cell in the requested target order,
including the save cell — executed cleanly. The notebook no longer dies at the traversal
cell.

**The run still fails, on a different and pre-existing bug.**

| Run | Command | Result | Wall time |
|---|---|---|---|
| 1 | exactly as specified | **FAIL at cell 22** | 34 s |
| 2 | same + `--allow-errors` (diagnostic only, no code change) | completed, all outputs captured | 66 s |

Failing cell: **index 22**, executed as `In[13]` — the second of two trailing scratch
cells that sit *after* the save cell and are not part of the requested target order.

```
---------------------------------------------------------------------------
NameError                                 Traceback (most recent call last)
Cell In[13], line 6
      2 for carr, g in test.groupby('OP_UNIQUE_CARRIER'):
      3     if len(g) < 2000:
      4         continue
      5     idx = g.index
----> 6     prob = best_prob[test.index.get_indexer(idx)]
      7     k = max(int(len(g) * 0.01), 1)
      8     top = np.argsort(-prob)[:k]
      9     hits = g['DEP_DEL15'].values[top].sum()

NameError: name 'best_prob' is not defined
```

`best_prob` is a notebook-2 variable. In notebook 5 it is read once, at cell 22, and
never assigned anywhere — confirmed by grep across all 24 cells. This is unrelated to the
cell-ordering bug and cannot be fixed by reordering.

Context on those two cells: `git show HEAD:fdpis_5_integration.ipynb` has **22 cells**;
the working copy has **24**. Cells 21 and 22 are uncommitted scratch added to the working
copy between 01:29 and 01:33 today, at which point stored outputs were also cleared
(file went 89,907 → 37,216 bytes). Cell 21 runs fine. Cell 22 does not.

Per instruction, no further fix was attempted. The two scratch cells were left in place
and were not deleted.

Run 2 used `--allow-errors` purely to capture the printed tables for §N5.4–N5.7, since a
failing `nbconvert --inplace` writes nothing back to the notebook. No code, parameter or
threshold was altered for it. One consequence: the notebook now stores an error output in
cell 22.

## N5.3 Output files

All four target files were written with fresh timestamps; they were stale at 09-09 before
this run. The save cell (new index 20) runs before the failing scratch cell, so it
completed in both runs. Timestamps below are from run 2.

| File | Size | Timestamp | Previously |
|---|---|---|---|
| `results/layer4/cascade_chains_integrated.parquet` | 3,046,555 B | 2026-09-13 01:48:41 | 09-09 06:33 (stale) |
| `results/layer4/integration_comparison.csv` | 242 B | 2026-09-13 01:48:41 | 09-09 06:33 (stale) |
| `results/layer4/decay_comparison.csv` | 198 B | 2026-09-13 01:48:41 | 09-09 06:33 (stale) |
| `results/layer4/integration_summary.json` | 407 B | 2026-09-13 01:48:41 | 09-09 06:33 (stale) |
| `fdpis_5_integration.ipynb` | 98,821 B | 2026-09-13 01:48:43 | — |

## N5.4 Recalibration output

From cells 5 and 6 (the two moved blocks), now running in linear order:

| Quantity | Value |
|---|---|
| Cascade-context flights in train | **149,556** |
| Mean primary delay in that context | **21.55 min** |
| Median primary delay | **11.00 min** |
| Zero primary delay share | **24.0%** |
| `SHRINK` | **0.510** |
| Unconditional global primary (printed for comparison) | **9.41 min** |

Train 1,176,905 | Test 262,171 | Rotations 63,102 | Cascade origins 22,924 |
Propagation-only 37,323 predictions | Integrated 47,198 predictions | Recovery rate 0.895.

**The internal inconsistency reported in §4.5 is resolved.** Cell 5 now prints
`(unconditional was 9.41 min)`. The stale saved output printed
`(unconditional was 21.55 min)` — self-contradictory, since 21.55 *is* the conditional
value. That line reads `print(f'  (unconditional was {GLOBAL_PRIMARY:.2f} min)')`, so the
old file proved `GLOBAL_PRIMARY` had already been overwritten by a prior pass. In linear
order it prints the genuine unconditional figure. That is positive evidence the new cell
order is the one the notebook was always meant to have.

## N5.5 Decay comparison — mean delay by depth

| Depth | n | old_pred | new_pred | actual_total | actual_inherited |
|---|---|---|---|---|---|
| 1 | 21,999 | 34.6 | 45.6 | 55.9 | 27.4 |
| 2 | 13,167 | 20.4 | 38.3 | 48.1 | 23.4 |
| 3 | 7,234 | 14.6 | 37.3 | 43.4 | 21.6 |
| 4 | 3,421 | 10.7 | 38.2 | 41.7 | 20.0 |
| 5 | 1,377 | 9.0 | 37.6 | 38.8 | 19.4 |

## N5.6 Total delay MAE by depth

| Depth | n | mae_old | mae_new | corr_old | corr_new | improvement % |
|---|---|---|---|---|---|---|
| 1 | 21,999 | 23.25 | 20.87 | 0.672 | 0.674 | 10.2 |
| 2 | 13,167 | 36.37 | 31.88 | 0.451 | 0.428 | 12.3 |
| 3 | 7,234 | 42.55 | 35.15 | 0.405 | 0.327 | 17.4 |
| 4 | 3,421 | 49.62 | 38.66 | 0.273 | 0.233 | 22.1 |
| 5 | 1,377 | 54.84 | 39.91 | 0.254 | 0.226 | 27.2 |

## N5.7 Inherited component MAE by depth (cascade cases)

| Depth | mae_prop_old | mae_prop_new | n_cascades |
|---|---|---|---|
| 1 | 8.67 | 8.67 | 11,194 |
| 2 | 29.34 | 26.25 | 5,499 |
| 3 | 40.89 | 33.89 | 2,704 |
| 4 | 48.79 | 36.43 | 1,177 |
| 5 | 62.52 | 42.53 | 429 |

Notebook 4 depth-1 reference: 8.67 min.

## N5.8 integration_summary.json

```json
{
  "cascade_origins": 22924,
  "predictions": 47198,
  "global_primary_delay_min": 21.55,
  "recovery_rate": 0.895,
  "mae_total_by_depth_old": [23.25, 36.37, 42.55, 49.62, 54.84],
  "mae_total_by_depth_new": [20.87, 31.88, 35.15, 38.66, 39.91],
  "improvement_pct_by_depth": [10.2, 12.3, 17.4, 22.1, 27.2]
}
```

`global_primary_delay_min` is 21.55 because the save cell reads `GLOBAL_PRIMARY` after
the recalibration block has reassigned it — correct and expected under the new order.

## N5.9 Discrepancies

**None. Every checked value matches the previously observed figures exactly.**

| Quantity | Previously observed | Linear run | Match |
|---|---|---|---|
| `SHRINK` | 0.510 | 0.510 | yes |
| `PRIMARY_MEAN` | 21.55 | 21.55 | yes |
| `PRIMARY_MEDIAN` | 11.00 | 11.00 | yes |
| Zero-share | 24.0% | 24.0% | yes |
| Total MAE new, depth 1 | 20.87 | 20.87 | yes |
| Total MAE new, depth 2 | 31.88 | 31.88 | yes |
| Total MAE new, depth 3 | 35.15 | 35.15 | yes |
| Total MAE new, depth 4 | 38.66 | 38.66 | yes |
| Total MAE new, depth 5 | 39.91 | 39.91 | yes |
| Correlation new, depth 1 | 0.674 | 0.674 | yes |
| Correlation new, depth 2 | 0.428 | 0.428 | yes |
| Correlation new, depth 3 | 0.327 | 0.327 | yes |
| Correlation new, depth 4 | 0.233 | 0.233 | yes |
| Correlation new, depth 5 | 0.226 | 0.226 | yes |
| Inherited MAE new, depth 1 | 8.67 | 8.67 | yes |
| Inherited MAE new, depth 2 | 26.25 | 26.25 | yes |
| Inherited MAE new, depth 3 | 33.89 | 33.89 | yes |
| Inherited MAE new, depth 4 | 36.43 | 36.43 | yes |
| Inherited MAE new, depth 5 | 42.53 | 42.53 | yes |

The manual out-of-order session and the clean linear run produce **identical state**. The
old outputs were correct; they simply were not reproducible from the file. The reordering
changes no result — it makes the existing results defensible.

### What this settles, and what it does not

**Settled.** §5.1 of the audit (notebook 5 cannot be run; results not reproducible) is
resolved for cells 0–20. Notebook 5's numbers are now regenerable from the file, the four
downstream artifacts are current rather than stale, and the depth-2 confidence boundary
discussed in §4.4 rests on a reproducible depth-3 correlation of **0.327**.

**Not settled.** Two audit findings are untouched by this fix and still stand:

- **§5.2 — corrupted categorical codes.** *(Superseded: this was retracted on 2026-09-13,
  see §C5.8 — the mismatch has no effect on predictions.)* Notebook 5 still builds `cat_types` from the
  full dataframe (345 ORIGIN / 345 DEST categories) while the loaded models were trained
  on notebook 3's training partition (339 / 339). Every number in §N5.4–N5.8 was produced
  through that mismatch. Reordering does not address it.
- **§5.5 — inconsistent depth populations.** Notebook 5 still advances on
  `chain_total > 0`, which is positive for essentially every flight, so nothing prunes and
  each depth keeps a different cohort from notebook 4 (n=1,377 at depth 5 here versus 328
  in notebook 4).

### Outstanding items for your decision

1. **Cells 21 and 22** — uncommitted scratch, not in the requested target order. Cell 22
   is permanently broken in this notebook (`best_prob` never exists here; it duplicates
   the per-carrier analysis already added to notebook 2 and reported in §3.3). I did not
   delete them. Removing both, or clearing cell 22, would let the notebook pass the exact
   verification command with zero errors.
2. **The error output now stored in cell 22** is an artifact of the `--allow-errors`
   diagnostic run and will persist in the file until that cell is removed or re-run clean.

### Files changed in this task

- `fdpis_5_integration.ipynb` — two cells moved (19→5, 20→6); no cell content edited;
  outputs regenerated by execution. A pre-move backup is at
  `<scratchpad>/nb5_before_reorder.ipynb`, and `git show HEAD:fdpis_5_integration.ipynb`
  still holds the committed 22-cell version.
- `AUDIT_REPORT.md` — this section appended.
- The four `results/layer4/` integration artifacts — regenerated with fresh timestamps.

Notebooks 1–4 were not modified. Nothing was deleted.

---

# NOTEBOOK 5 — CLEANED AND RERUN

Added 2026-09-13. Supersedes **NOTEBOOK 5 — LINEAR RUN RESULTS** on execution hygiene,
and **retracts finding §5.2** (see §C5.7).

A pre-change backup is at `<scratchpad>/nb5_before_cleanup.ipynb` (41,124 B).

## C5.1 Cells deleted

Three cells removed, located by content rather than index:

| Old index | First line of code | Why |
|---|---|---|
| 21 | `per_day = len(test) / test['FL_DATE'].nunique()` | Scratch volume check; also printed two hardcoded literals (`precision 0.253`, `precision 0.781`) |
| 22 | `rows = []` (loop `for carr, g in test.groupby('OP_UNIQUE_CARRIER')`, references `best_prob`) | Duplicate of the per-carrier analysis already in notebook 2 (§3.3); `best_prob` is a notebook-2 variable that never exists here |
| 24 | *(empty cell)* | Trailing empty cell |

Cell 22 was distinguished from the three other cells that also begin `rows = []`
(indices 12, 14, 16 — the decay, total-MAE and inherited-MAE tables) by requiring both
the `groupby('OP_UNIQUE_CARRIER')` loop and the `best_prob` reference. Those three
analysis cells were left untouched.

Verified post-change: no cell anywhere in the notebook still contains `best_prob` or
`per_day = len(test)`.

## C5.2 Diagnostic cell replaced

The cell starting `import json, xgboost as xgb` (old index 23) had its entire contents
replaced with the supplied category-mismatch diagnostic. It previously failed with
`NameError: name 'prop' is not defined` — `prop` is a notebook-3 variable.

The replacement was written to a file and inserted verbatim; a byte-for-byte comparison
of the stored cell source against the supplied text returned `True`.

A markdown cell `## 10 — Category mismatch check` was inserted immediately before it.

Notebook went from **25 cells to 23** (3 deleted, 1 markdown added). All stored outputs
and execution counts were cleared before the run.

## C5.3 Execution result

```
conda run -n fdpis jupyter nbconvert --to notebook --execute --inplace \
  --ExecutePreprocessor.timeout=3600 fdpis_5_integration.ipynb
```

| Item | Value |
|---|---|
| Result | **PASS — zero errors** |
| Wall time | **33 s** |
| Exit code | 0 |
| Code cells | 12 |
| Execution counts | `1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12` |
| Sequential 1..N, no gaps | **yes** |
| Error outputs in file | **none** |

The notebook is now readable as a record: every cell carries an output from the same
kernel session, in order. The previous file spanned execution counts 5 to 38 across at
least four separate sessions, with stored errors in five cells.

## C5.4 Output files

| File | Size | Timestamp |
|---|---|---|
| `results/layer4/cascade_chains_integrated.parquet` | 3,046,555 B | 2026-09-13 02:00:16 |
| `results/layer4/integration_comparison.csv` | 242 B | 2026-09-13 02:00:16 |
| `results/layer4/decay_comparison.csv` | 198 B | 2026-09-13 02:00:16 |
| `results/layer4/integration_summary.json` | 407 B | 2026-09-13 02:00:16 |
| `fdpis_5_integration.ipynb` | 98,157 B | 2026-09-13 02:00:18 |

## C5.5 Category mismatch diagnostic — full output, verbatim

```
Category counts:
  OP_UNIQUE_CARRIER    train=  14  full=  14  extra=0  []
  ORIGIN               train= 345  full= 345  extra=0  []
  DEST                 train= 345  full= 345  extra=0  []

Sample rows: 5,000

=== GATE PROBABILITY ===
  Max abs difference : 0.00000000
  Mean abs difference: 0.00000000
  Rows differing >0.01: 0

=== MAGNITUDE PREDICTION (minutes) ===
  Max abs difference : 0.000000
  Mean abs difference: 0.000000

SAFE — category mismatch has no measurable effect.
All notebook 4 and 5 numbers stand. Document as a known non-issue.
```

**The diagnostic as written does not test the mismatch it was meant to test.** It builds
its `trn_df` baseline from the **full** dataset's 70% date split:

```python
dates_chk = np.sort(df['FL_DATE'].unique())
train_end_chk = dates_chk[int(len(dates_chk)*0.70)]
trn_df = df[df['FL_DATE'] <= train_end_chk]
```

Notebook 3 built its `cat_types` from `ptrain` — the training split of the **cascade
candidates** (`CONTINUOUS_ROTATION & PREV_ARR_DELAY > 0`, 276,720 rows), not of the full
1,718,426-row frame. The full-frame train split contains all 345 airports, so the
diagnostic compared 345 against 345 and reported `extra=0`. The real comparison is 339
against 345.

That is why every difference is exactly `0.00000000`: two identical category sets were
compared. The printed `SAFE` verdict is, on its own, not evidence.

## C5.6 Independent verification of the real comparison

Run outside the notebook against the same models and the same 5,000-row sample, using
notebook 3's actual `ptrain` categories on one side and notebook 5's full-frame
categories on the other.

```
Category set sizes
column                nb3 ptrain  diag trn_df   full df
OP_UNIQUE_CARRIER             14           14        14
ORIGIN                       339          345       345
    missing from nb3 ptrain: ['EKO', 'FMN', 'GUM', 'HOB', 'PQI', 'WYS']
DEST                         339          345       345
    missing from nb3 ptrain: ['AKN', 'DHN', 'DLG', 'GST', 'SPN', 'WYS']

Sample rows: 5,000

=== REAL COMPARISON: nb3-training categories (339) vs nb4/nb5 inference categories (345) ===
GATE PROBABILITY
  Max abs difference  : 0.00000000
  Mean abs difference : 0.00000000
  Rows differing >0.01: 0
MAGNITUDE PREDICTION (minutes)
  Max abs difference  : 0.000000
  Mean abs difference : 0.000000
  Rows differing >1min: 0
  Gate decisions flipped at threshold 0.3: 0 of 5,000
```

The correct comparison also returns exactly zero. To establish *why*, a deliberate stress
test reversed the category ordering entirely:

```
xgboost version      : 3.2.0
booster feature_types: ['float', 'float', ...] (n=27)
model JSON mentions 'categories': True

sample distinct ORIGIN: 181   distinct DEST: 186

code for DEST='ALB' under normal order : 14
code for DEST='ALB' under reversed order: 330

REVERSED-ORDER STRESS TEST
  max abs gate-prob difference: 0.00000000
  -> predictions are INVARIANT to category ordering.
```

And the models do rely on those columns heavily, so invariance is not an artifact of
the features being ignored:

```
gate:            feature_types marked categorical: ['OP_UNIQUE_CARRIER','ORIGIN','DEST']
    splits on OP_UNIQUE_CARRIER: 1810    ORIGIN: 3433    DEST: 3462
hurdle_median:   feature_types marked categorical: ['OP_UNIQUE_CARRIER','ORIGIN','DEST']
    splits on OP_UNIQUE_CARRIER: 2455    ORIGIN: 4728    DEST: 4966
```

XGBoost 3.2.0 stores the category values in the saved model and re-codes incoming
categorical columns **by value**, not by positional code. Moving `ALB` from code 14 to
code 330 changes nothing, across models that split on `DEST` nearly 5,000 times.

## C5.7 Re-verification of all figures against the clean run

**No differences. Every value matches.**

| Quantity | Expected | Clean run | Match |
|---|---|---|---|
| `SHRINK` | 0.510 | 0.510 | yes |
| `PRIMARY_MEAN` | 21.55 | 21.55 | yes |
| `PRIMARY_MEDIAN` | 11.00 | 11.00 | yes |
| Zero-share | 24.0% | 24.0% | yes |
| Total MAE, depth 1 | 20.87 | 20.87 | yes |
| Total MAE, depth 2 | 31.88 | 31.88 | yes |
| Total MAE, depth 3 | 35.15 | 35.15 | yes |
| Total MAE, depth 4 | 38.66 | 38.66 | yes |
| Total MAE, depth 5 | 39.91 | 39.91 | yes |
| Correlation, depth 1 | 0.674 | 0.674 | yes |
| Correlation, depth 2 | 0.428 | 0.428 | yes |
| Correlation, depth 3 | 0.327 | 0.327 | yes |
| Correlation, depth 4 | 0.233 | 0.233 | yes |
| Correlation, depth 5 | 0.226 | 0.226 | yes |
| Inherited MAE, depth 1 | 8.67 | 8.67 | yes |
| Inherited MAE, depth 2 | 26.25 | 26.25 | yes |
| Inherited MAE, depth 3 | 33.89 | 33.89 | yes |
| Inherited MAE, depth 4 | 36.43 | 36.43 | yes |
| Inherited MAE, depth 5 | 42.53 | 42.53 | yes |

Supporting figures also unchanged: cascade-context flights 149,556; unconditional global
primary 9.41 min; cascade origins 22,924; integrated predictions 47,198; recovery rate
0.895; depth counts 21,999 / 13,167 / 7,234 / 3,421 / 1,377.

## C5.8 Assessment — what the diagnostic means for notebooks 4 and 5

### Finding §5.2 is retracted. It was wrong.

The audit reported the category mismatch as a CRITICAL defect, stating that "roughly 69%
of ORIGIN values and 96% of DEST values arrive at the model meaning a different airport
than they did in training." **That conclusion was incorrect.** It was reasoned from how
pandas assigns positional codes, without testing how XGBoost consumes them.

XGBoost 3.2.0 persists the category values inside the saved model and re-codes incoming
categorical columns by value. The positional shift I identified is real — `ALB` genuinely
moves from code 13/14 to a different index — but it is invisible to the model. The
reversed-order stress test settles it: with every category index scrambled, predictions
are bit-identical to eight decimal places, on models that split on `ORIGIN` and `DEST`
thousands of times.

**Notebook 4 and notebook 5 results are not corrupted by this.** Every figure in §3.5,
§3.6, §N5.4–N5.8 and §C5.7 stands as computed.

### But the supplied diagnostic does not prove that

The in-notebook check compares 345 categories against 345 and reports `extra=0`. It would
print `SAFE` even on a build of XGBoost that *did* break under code shifts, because it
never constructs the mismatched pair. Its verdict is correct here only by coincidence.

Two things would make it a real test: derive the baseline from the cascade-candidate
training split rather than the full frame, and assert on a deliberately scrambled
ordering. The independent runs in §C5.6 do both, and they are what actually supports the
retraction.

### What remains true

- **The mismatch is still a latent fragility, just not an active bug.** It depends on an
  XGBoost implementation detail. Pinning `xgboost==3.2.0`, or persisting the category
  levels in `config.json` alongside `features` and `cat_cols`, would remove the
  dependence on that behaviour. The cost is a few lines.
- **Six airports are genuinely absent from notebook 3's training data** (`EKO, FMN, GUM,
  HOB, PQI, WYS` as origins; `AKN, DHN, DLG, GST, SPN, WYS` as destinations). At
  inference the model sees categories it never trained on. That is an out-of-vocabulary
  question, not an encoding question, and it is unaffected by the retraction — though
  with 345 airports and these being among the smallest, the practical impact is slight.
- **Finding §5.5 stands unchanged.** Notebook 5 still advances the frontier on
  `chain_total > 0`, which is positive for essentially every flight, so nothing prunes and
  each depth carries a different cohort from notebook 4 (n=1,377 at depth 5 versus 328).
  The depth tables in §3.5 and §C5.7 are still not directly comparable.
- **The audit's other findings are untouched**: test-set gate-threshold tuning (§5.3),
  interval coverage at 70.2% against a nominal 80% (§5.4), reported-versus-propagated
  quantity (§5.6), negative ablation gain on the target encodings (§5.7), and the
  non-contiguous-month split (§5.8).

### Net effect on the audit

One CRITICAL finding retracted (§5.2). One CRITICAL finding resolved by the earlier
reorder (§5.1). The remaining findings are unchanged. Notebook 5 now runs top to bottom
from a fresh kernel with sequential execution counts and no scratch cells, and its four
downstream artifacts are current.

### Files changed in this task

- `fdpis_5_integration.ipynb` — 3 cells deleted, 1 cell's contents replaced, 1 markdown
  cell added, all outputs regenerated by a clean run. Backup at
  `<scratchpad>/nb5_before_cleanup.ipynb`.
- `AUDIT_REPORT.md` — this section appended.
- The four `results/layer4/` integration artifacts — regenerated.

Notebooks 1–4 were not modified. No data files were deleted.

---

# TIER 1 DELETION LOG

Executed 2026-09-13 on explicit approval of Tier 1 only. Tier 2 was not touched.

## T1.1 Safety checks

All four checks passed before anything was deleted.

### Check 1 — targets exist, with actual sizes

| Path | Size | Status |
|---|---|---|
| `data/T_ONTIME_REPORTING.csv` | 113,140,357 B | exists |
| `data/processed_jan2026.parquet` | 21,136,699 B | exists |
| `data/xgb_primary_delay_classifier.json` | 12,975,162 B | exists |
| `data/cancelled_jan2026.parquet` | 582,589 B | exists |
| `fdpis-web/t1.txt` | 23 B | exists |
| `data/raw/data/` | directory tree | exists |

### Check 2 — zero references

Grepped every `.ipynb`, `.py`, `.md`, `.json`, `.js`, `.ts`, `.tsx` in the repository
(excluding `node_modules`, `.next`, `.git`) for each filename.

| Term | Files containing it | Where |
|---|---|---|
| `T_ONTIME_REPORTING.csv` | 1 | `AUDIT_REPORT.md` lines 90, 105 |
| `processed_jan2026.parquet` | 1 | `AUDIT_REPORT.md` lines 91, 106 |
| `xgb_primary_delay_classifier.json` | 1 | `AUDIT_REPORT.md` lines 26, 93, 107 |
| `cancelled_jan2026.parquet` | 1 | `AUDIT_REPORT.md` lines 92, 108 |
| `t1.txt` | 1 | `AUDIT_REPORT.md` lines 95, 110 |

**Zero hits in any notebook or source file.** Every hit is inside this report.

**Model-file disambiguation.** The two are different files, not two paths to one file:

| | `data/xgb_primary_delay_classifier.json` | `results/xgb_primary_classifier.json` |
|---|---|---|
| Filename | contains `_delay_` | no `_delay_` |
| Size | 12,975,162 B | 7,389,886 B |
| MD5 | `63fe114ace8cb602b7bfd6a254079c8c` | `e19ea0aaed5c7f4f90f8f110447da138` |
| Referenced by | nothing | `fdpis_2_modelling.ipynb:1085` (and the archived copy) |
| Action | **deleted** | **kept** |

The deletion targeted the one in `data/`. The active model in `results/` was verified
present after deletion at its original 7,389,886 B.

### Check 3 — `data/raw/data/` contains no files

```
entries: data/raw/data, data/raw/data/raw
files at any depth: 0
dirs  at any depth: 2
```

Removal used `rmdir` on each level rather than `rm -rf`, so the operation would have
failed outright had any file been present.

### Check 4 — files that must survive

| Path | Size before | Size after | Survived |
|---|---|---|---|
| `data/raw/2025 Jan.csv` | 112,592,301 B | 112,592,301 B | yes |
| `data/raw/2025 APRIL.csv` | 122,732,173 B | 122,732,173 B | yes |
| `data/raw/2025 JULY.csv` | 133,349,544 B | 133,349,544 B | yes |
| `data/processed.parquet` | 94,086,744 B | 94,086,744 B | yes |
| `data/cancelled.parquet` | 601,835 B | 601,835 B | yes |
| `results/xgb_primary_classifier.json` | 7,389,886 B | 7,389,886 B | yes |
| `review2/baseline/fdpis_1_data_prep.ipynb` | 29,149 B | 29,149 B | yes |
| `review2/baseline/fdpis_2_modelling.ipynb` | 109,236 B | 109,236 B | yes |
| `review2/baseline/results/feature_ablation.csv` | 406 B | 406 B | yes |
| `review2/baseline/results/feature_importance.csv` | 1,101 B | 1,101 B | yes |
| `review2/baseline/results/model_comparison.csv` | 504 B | 504 B | yes |
| `review2/baseline/results/xgb_primary_classifier.json` | 7,389,886 B | 7,389,886 B | yes |

All 6 archive files under `review2/baseline/` present and untouched.

## T1.2 Files deleted

| Path | Bytes |
|---|---|
| `data/T_ONTIME_REPORTING.csv` | 113,140,357 |
| `data/processed_jan2026.parquet` | 21,136,699 |
| `data/xgb_primary_delay_classifier.json` | 12,975,162 |
| `data/cancelled_jan2026.parquet` | 582,589 |
| `fdpis-web/t1.txt` | 23 |
| `data/raw/data/` (2 empty dirs) | 0 |

**Total reclaimed: 147,834,830 bytes = 141.0 MiB.**

All six confirmed absent after deletion.

## T1.3 Notebook 1 verification

```
conda run -n fdpis jupyter nbconvert --to notebook --execute --inplace \
  --ExecutePreprocessor.timeout=3600 fdpis_1_data_prep.ipynb
```

**Result: PASS.** Exit code 0, zero error outputs, runtime **39 s**.

| Check | Expected | Actual | Match |
|---|---|---|---|
| CSVs found in `data/raw/` | 3 | 3 | yes |
| Merged rows | 1,755,125 | **1,755,125** | yes |
| Flown rows | 1,718,426 | **1,718,426** | yes |

Per-file row counts, unchanged:

```
Found 3 file(s):
  2025 APRIL.csv                                 583,950 rows
  2025 JULY.csv                                  631,428 rows
  2025 Jan.csv                                   539,747 rows

Merged: 1,755,125 rows x 38 columns
```

```
Cancelled :   36,699 (2.09%)
Flown     : 1,718,426

Dropped 0 flown rows with no TAIL_NUM (rotation impossible without it)
Remaining : 1,718,426
```

```
Saved 1,718,426 rows -> data/processed.parquet (94.1 MB)
Saved 36,699 rows -> data/cancelled.parquet

Date span: 2025-01-01 to 2025-07-31 (92 days)
```

Every figure is identical to the pre-deletion run recorded in §3.1. The removal of
`data/raw/data/` had no effect because notebook 1 globs `data/raw/*.csv`, which matches
files only, never directories.

Notebooks 2–5 were not rerun, as instructed.

## T1.4 Directory tree after deletion

### `data/` — 494,215,506 B (471.3 MiB)

```
data/
  cancelled.parquet                             601,835
  processed.parquet                          94,086,744
  prop_candidates.parquet                    30,852,909
  raw/
    2025 APRIL.csv                          122,732,173
    2025 JULY.csv                           133,349,544
    2025 Jan.csv                            112,592,301
```

The nested `data/raw/data/raw/` path is gone; `data/raw/` now holds the three BTS CSVs
and nothing else.

### `results/` — 72,744,631 B (69.4 MiB)

```
results/
  feature_ablation.csv                              406
  feature_importance.csv                          1,101
  model_comparison.csv                              504
  xgb_primary_classifier.json                 7,389,886
  layer4/
    cascade_chains.parquet                    1,390,174
    cascade_chains_integrated.parquet         3,046,555
    config.json                                     848
    decay_comparison.csv                            198
    depth_error.csv                                 308
    integration_comparison.csv                      242
    integration_summary.json                        407
    multihop_summary.json                           327
    propagation_importance.csv                      804
    propagation_summary.csv                         224
    test_preds.npy                              889,484
    xgb_gate.json                             7,645,471
    xgb_hurdle_lower.json                    10,115,496
    xgb_hurdle_median.json                   10,119,059
    xgb_hurdle_upper.json                     5,286,382
    xgb_propagation_lower.json                7,964,788
    xgb_propagation_median.json              10,211,462
    xgb_propagation_upper.json                8,680,505
```

## T1.5 Tier 2 candidates — still present, awaiting a future decision

Written on every run, read by nothing. All are regenerated by rerunning notebooks 1
and 3, so deleting them costs only compute.

| Path | Bytes | Written by | Read by |
|---|---|---|---|
| `data/prop_candidates.parquet` | 30,852,909 | nb3 | nothing |
| `results/layer4/xgb_propagation_median.json` | 10,211,462 | nb3 | nothing |
| `results/layer4/xgb_propagation_upper.json` | 8,680,505 | nb3 | nothing |
| `results/layer4/xgb_propagation_lower.json` | 7,964,788 | nb3 | nothing |
| `results/layer4/test_preds.npy` | 889,484 | nb3 | nothing |
| `data/cancelled.parquet` | 601,835 | nb1 | nothing |

**Total if approved: 59,200,983 bytes = 56.5 MiB.**

Caveat unchanged from §1.4: `.gitignore` excludes `*.csv`, `*.parquet`, `*.npy` and
`*.json`, so none of these are recoverable from git — only regenerable by rerunning the
pipeline. The three `xgb_propagation_*` models are the pre-hurdle quantile stage,
superseded inside notebook 3 itself by the hurdle models that notebooks 4 and 5 actually
load.

Nothing outside the Tier 1 list was deleted. No notebook was modified.

### Recoverability of the deleted items

| Path | Git-tracked | Recoverable |
|---|---|---|
| `data/T_ONTIME_REPORTING.csv` | no (gitignored `*.csv`) | **no** |
| `data/processed_jan2026.parquet` | no (gitignored `*.parquet`) | **no** |
| `data/xgb_primary_delay_classifier.json` | no (gitignored `*.json`) | **no** |
| `data/cancelled_jan2026.parquet` | no (gitignored `*.parquet`) | **no** |
| `fdpis-web/t1.txt` | **yes** | yes — `git checkout -- fdpis-web/t1.txt` |
| `data/raw/data/` | n/a (empty dirs) | trivially recreatable |

The four data files are permanently gone. That was expected and is consistent with the
audit's verdict that they have zero references anywhere in the pipeline; notebook 1's
successful rerun with identical row counts is the practical confirmation. `t1.txt` shows
as `D` in `git status` and can be restored if ever wanted — it was a stray heredoc test
artifact, so no reason to.

---

# FIXES 1-3 APPLIED

Applied and rerun 2026-09-13. Notebooks 2, 3, 4, 5 all executed linearly from a fresh
kernel with **zero errors and sequential execution counts**. Notebook 1 was not rerun —
no change affects it. Backups of all five notebooks at
`<scratchpad>/backup_fixes123/`.

| Notebook | Runtime | Result | Code cells | Sequential |
|---|---|---|---|---|
| `fdpis_2_modelling.ipynb` | 632 s | PASS | 21 | yes |
| `fdpis_3_propagation.ipynb` | 353 s | PASS | 24 | yes |
| `fdpis_4_multihop.ipynb` | 36 s | PASS | 14 | yes |
| `fdpis_5_integration.ipynb` | 61 s | PASS | 14 | yes |

## F1. Fix 1 — target encodings persisted

Two cells added after the `lookups` cell in notebook 2 (plus a markdown heading). The
computation of the encodings was not touched; only persistence and verification.

**`results/encodings.json` — 407,225 bytes (397.7 KB)**, `smoothing_m = 50`,
`global_rate = 0.112631`.

| Group | Keys | Entries |
|---|---|---|
| CARRIER | `OP_UNIQUE_CARRIER` | 14 |
| ORIGIN | `ORIGIN` | 345 |
| DEST | `DEST` | 345 |
| ROUTE | `ORIGIN,DEST` | 6,407 |
| ORIGIN_HOUR | `ORIGIN,DEP_HOUR` | 3,973 |
| CARRIER_ORIGIN | `OP_UNIQUE_CARRIER,ORIGIN` | 1,572 |
| CARRIER_HOUR | `OP_UNIQUE_CARRIER,DEP_HOUR` | 292 |
| DOW_HOUR | `DAY_OF_WEEK,DEP_HOUR` | 168 |
| **TOTAL** | | **13,116** |

Composite keys are `"|"`-joined strings (`ABE|BNA`, `1|0`); all values are native Python
floats.

### Round-trip verification

The JSON is loaded back and the `ENC_*` columns are rebuilt on the test set using only
what a serving process would have, then compared against the in-memory columns.

| Column | Max abs difference | Status |
|---|---|---|
| ENC_CARRIER | 0 | OK |
| ENC_ORIGIN | 0 | OK |
| ENC_DEST | 0 | OK |
| ENC_ROUTE | 0 | OK |
| ENC_ORIGIN_HOUR | 0 | OK |
| ENC_CARRIER_ORIGIN | 0 | OK |
| ENC_CARRIER_HOUR | 0 | OK |
| ENC_DOW_HOUR | 0 | OK |
| **worst across all columns** | **0** | **PASS** |

The cell carries an `assert worst == 0.0`, so any future drift fails the notebook rather
than passing silently. The model is now servable.

## F2. Fix 2 — gate threshold selected on validation

The sweep in notebook 3 now runs on `Xv` / `pval` and selects the threshold minimising
**validation** MAE on actual cascades. The selection rule is unchanged; only the split
it reads changed.

### Validation sweep (this is what now drives the choice)

| Threshold | val_mae_all | val_mae_cascades | val_flagged |
|---|---|---|---|
| **0.3** | 7.71 | **8.40** | 48,533 |
| 0.4 | 7.32 | 8.81 | 43,326 |
| 0.5 | 7.05 | 9.42 | 38,829 |
| 0.6 | 6.84 | 10.26 | 34,578 |
| 0.7 | 6.81 | 11.51 | 30,342 |

```
Threshold selected on VALIDATION = 0.3. Test metrics below are now unbiased.
Validation selected 0.3 - the same value that was previously chosen on test.
The number is unchanged, but it is now arrived at without touching test.
```

**The selected threshold is 0.3 — identical to the previous test-selected value.**
`GATE_THRESHOLD` is now derived from the sweep; the string `GATE_THRESHOLD = 0.3` no
longer appears anywhere in the notebook.

The validation and test sweeps have the same shape — `mae_cascades` rises monotonically
with threshold on both, so both minimise at 0.3.

## F3. Fix 3 — category levels persisted

### 3a — written to `results/layer4/config.json`

Source: `cat_types[c].categories`, i.e. the `ptrain` cascade-candidate training split —
the same object used to build the matrices the models were trained on.

| Column | Levels written |
|---|---|
| `OP_UNIQUE_CARRIER` | 14 |
| `ORIGIN` | 339 |
| `DEST` | 339 |

### 3b — read by notebooks 4 and 5, with out-of-vocabulary counts

Both notebooks now build `cat_types` from `cfg['category_levels']`, falling back to the
old full-dataset derivation behind an explicit warning if the key is absent. Identical
output from both:

```
Category levels loaded from config.json (training-time levels):
  OP_UNIQUE_CARRIER      14 levels | out-of-vocabulary rows: 0 of 1,718,426 (0.0000%)
  ORIGIN                339 levels | out-of-vocabulary rows: 665 of 1,718,426 (0.0387%)
  DEST                  339 levels | out-of-vocabulary rows: 289 of 1,718,426 (0.0168%)
  (Out-of-vocabulary values become NaN, which XGBoost routes via its default branch.)
```

The six missing airports per column were previously given valid codes silently; they are
now explicitly NaN and counted. 954 rows of 1,718,426 are affected in total.

## F4. Before / after comparison

### Notebook 2 — confirmed unchanged

| Metric | Before | After | Difference |
|---|---|---|---|
| AUC (Blend) | 0.6819 | 0.6819 | **0** |
| F1 | 0.351 | 0.351 | **0** |
| precision@1% | 0.781 | 0.781 | **0** |

The full 7-row model comparison and the ablation table are byte-identical. Fix 1 only
adds persistence, so this is the expected result and confirms nothing was disturbed.

### Notebook 3

| Metric | Before | After | Difference |
|---|---|---|---|
| Gate AUC | 0.9272 | 0.9272 | **0** |
| Gate precision | 0.785 | 0.785 | **0** |
| Gate recall | 0.842 | 0.842 | **0** |
| Hurdle MAE, all candidates (gate × mag) | 7.17 | 7.17 | **0** |
| Hurdle MAE, actual cascades (gate × mag) | 9.80 | 9.80 | **0** |
| Hurdle interval coverage (pre-gate) | 80.9% | 80.9% | **0** |
| **Chosen threshold** | **0.30** *(from test)* | **0.30** *(from validation)* | **0 — but now unbiased** |
| MAE at chosen threshold, all candidates | 7.67 | 7.67 | **0** |
| MAE at chosen threshold, actual cascades | 8.35 | 8.35 | **0** |
| Interval coverage at chosen threshold | 70.2% | 70.2% | **0** |

The gate and hurdle models themselves are unchanged — Fix 2 alters only which split the
threshold is read from, not any training. Every metric is identical.

### Notebook 4

| Depth | n before | n after | MAE cascades before | after | Corr before | after | Coverage before | after |
|---|---|---|---|---|---|---|---|---|
| 1 | 21,999 | 21,999 | 8.67 | 8.67 | 0.790 | 0.790 | 0.771 | **0.770** |
| 2 | 9,944 | **9,945** | 29.34 | 29.34 | 0.561 | **0.560** | 0.536 | 0.536 |
| 3 | 3,809 | **3,810** | 40.89 | 40.89 | 0.433 | 0.433 | 0.476 | 0.476 |
| 4 | 1,243 | 1,243 | 48.79 | 48.79 | 0.318 | 0.318 | 0.444 | 0.444 |
| 5 | 328 | 328 | 62.52 | 62.52 | 0.262 | 0.262 | 0.497 | 0.497 |

`n_cascades` at depth 2: 5,075 → **5,076**. All other cascade counts unchanged.

Propagation depth accuracy:

| Metric | Before | After | Difference |
|---|---|---|---|
| Cascades evaluated | 16,431 | **16,432** | **+1** |
| Exactly correct | 54.4% | **54.3%** | **−0.1 pt** |
| Within ±1 flight | 91.3% | 91.3% | **0** |
| Mean signed error | +0.33 | +0.33 | **0** |

**These are the only material changes in the whole exercise, and they come from Fix 3b.**
With the 954 out-of-vocabulary rows now encoded as NaN rather than given codes, the gate
fires on one additional leg at depth 2 and one at depth 3, carrying one extra cascade
into the depth-accuracy population. MAE is unmoved at every depth; correlation shifts by
0.001 at depth 2 and coverage by 0.001 at depth 1, both rounding-level.

### Notebook 5

| Metric | Before | After | Difference |
|---|---|---|---|
| `SHRINK` | 0.510 | 0.510 | **0** |
| `PRIMARY_MEAN` | 21.55 | 21.55 | **0** |
| `PRIMARY_MEDIAN` | 11.00 | 11.00 | **0** |
| Zero-share | 24.0% | 24.0% | **0** |

Total delay MAE by depth:

| Depth | Before | After | Difference |
|---|---|---|---|
| 1 | 20.87 | 20.87 | **0** |
| 2 | 31.88 | 31.88 | **0** |
| 3 | 35.15 | 35.15 | **0** |
| 4 | 38.66 | 38.66 | **0** |
| 5 | 39.91 | 39.91 | **0** |

Correlation by depth:

| Depth | Before | After | Difference |
|---|---|---|---|
| 1 | 0.674 | 0.674 | **0** |
| 2 | 0.428 | 0.428 | **0** |
| 3 | 0.327 | 0.327 | **0** |
| 4 | 0.233 | 0.233 | **0** |
| 5 | 0.226 | 0.226 | **0** |

Inherited component MAE by depth:

| Depth | Before | After | Difference |
|---|---|---|---|
| 1 | 8.67 | 8.67 | **0** |
| 2 | 26.25 | 26.25 | **0** |
| 3 | 33.89 | 33.89 | **0** |
| 4 | 36.43 | 36.43 | **0** |
| 5 | 42.53 | 42.53 | **0** |

One incidental change: the **propagation-only baseline** `mae_old` at depth 3 moved
**42.55 → 42.54** (−0.01). That is the Notebook-4-style chain, which inherits the extra
depth-3 leg from Fix 3b. Every integrated figure is unchanged. Depth counts
(21,999 / 13,167 / 7,234 / 3,421 / 1,377) are identical — notebook 5 does not prune, so
the extra legs notebook 4 picked up do not alter its populations.

## F5. Assessment

### Did the unbiased threshold change conclusions? No — marginally at most.

**Validation independently selects 0.30, the same threshold previously chosen on test.**
Every downstream metric is therefore identical: MAE 7.67 all candidates, 8.35 on actual
cascades, coverage 70.2%. The contamination described in audit §5.3 was real as a
*process* defect, but it turned out to have **no numerical consequence**. The two sweeps
have the same monotone shape, so both land on the same end of the grid.

**No previously reported figure needs revising in project documentation.** The headline
numbers — precision@1% 0.781, 5.0× lift, AUC 0.6819, Layer 4 MAE 8.35, the depth tables —
all stand exactly as published. What changed is their *defensibility*: the threshold is
now selected without the test set, so the reported test performance is genuinely
out-of-sample rather than merely believed to be.

That is worth saying precisely, because it is a stronger claim than "the numbers didn't
move". Before this fix we could not have distinguished "0.3 is genuinely optimal" from
"0.3 looks optimal because we peeked". Now we can, and it is the former.

### One caveat on the sweep itself

On both validation and test, `mae_cascades` **increases monotonically** across the grid
and the minimum sits at **0.3, the lowest value swept**. The optimum may well lie below
0.3 — the grid never looks there. This was equally true of the original test-based sweep,
so it is not a regression, but the selected threshold is a boundary solution rather than
an interior minimum. Extending the grid downward (0.1, 0.15, 0.2, 0.25) on validation
would either confirm 0.3 or find something better, and it is cheap. I have not changed
the grid, since the brief was explicit about sweeping the same thresholds.

### Fix 3 turned a silent assumption into a measured one

The audit retracted §5.2 after establishing that XGBoost 3.2.0 re-codes categories by
value, so the positional mismatch was harmless. Fix 3 removes the reliance on that
behaviour entirely — but it also surfaced something the old code hid: **954 rows carry an
airport the models never trained on** (665 ORIGIN, 289 DEST, 0.0387% and 0.0168%). Those
were previously handed valid-looking codes; they are now explicitly NaN and counted in
the output.

That is the source of the only real movement in this exercise: one extra leg at depth 2,
one at depth 3, one extra cascade in the depth-accuracy population, and a 0.1 pt drop in
"exactly correct" (54.4% → 54.3%). These are rounding-scale and do not affect any
conclusion. The value of the change is that the out-of-vocabulary count is now visible on
every run instead of being invisible.

### Fix 1 is the one with real operational consequence

Neither Fix 2 nor Fix 3 moved a number that matters. Fix 1 changes what the project can
actually do: before it, the trained classifier could not be deployed, because the eight
`ENC_*` features — which include the two highest-importance features in the entire model
(`ENC_ROUTE` 0.186, `ENC_ORIGIN_HOUR` 0.140, together 33% of total importance) — existed
only in a dead kernel. `results/encodings.json` with a verified-exact round trip closes
that gap.

Note this interacts with audit §5.7, which still stands: the target-encoding group has a
**negative ablation gain (−0.0131 AUC)** while dominating feature importance. The
encodings are now servable; whether they should be in the model at all remains an open
question worth a no-group-D comparison run.

### Remaining audit findings, unaffected

§5.4 (interval coverage 70.2% against a nominal 80%), §5.5 (depth cohorts differ between
notebooks 4 and 5), §5.6 (reported `pred_total` is shrunk while `chain_total` propagates
unshrunk), §5.7 (negative ablation gain on encodings), §5.8 (non-contiguous months) are
all untouched by these three fixes.

### Files changed

- `fdpis_2_modelling.ipynb` — markdown heading + 2 cells added after the `lookups` cell
  (37 cells, was 34).
- `fdpis_3_propagation.ipynb` — sweep cell rewritten for validation selection; save cell
  rewritten to derive `GATE_THRESHOLD` and persist `category_levels`.
- `fdpis_4_multihop.ipynb`, `fdpis_5_integration.ipynb` — `cat_types` now read from
  config with fallback and OOV reporting.
- New artifact: `results/encodings.json` (407,225 B).
- `results/layer4/config.json` now carries `category_levels`.
- All model and results artifacts regenerated by the rerun.

No model hyperparameters, feature sets or split logic were changed. Notebook 1 was not
modified or rerun.

---

# CHECKS A AND B

Run 2026-09-13. Both checks are additive — new cells only, no existing cell modified,
no configuration changed. Backups at `<scratchpad>/backup_checksAB/`.

| Notebook | Runtime | Result | Cells |
|---|---|---|---|
| `fdpis_3_propagation.ipynb` (Check A) | 238 s | PASS, zero errors | 40 → 42 |
| `fdpis_2_modelling.ipynb` (Check B) | 843 s | PASS, zero errors | 37 → 41 |

Notebooks 1, 4 and 5 were not rerun — nothing affecting them changed.

## A1. Extended validation sweep (the selection basis)

Validation rows 84,455 | genuinely propagating 37,568 (44.5%).

| Threshold | val_mae_all | val_mae_cascades | flagged | flagged % | gate precision | gate recall |
|---|---|---|---|---|---|---|
| **0.05** | 9.31 | **7.97** | 66,533 | 78.8 | 0.563 | 0.997 |
| 0.10 | 8.76 | 8.00 | 61,837 | 73.2 | 0.601 | 0.990 |
| 0.15 | 8.43 | 8.06 | 58,098 | 68.8 | 0.633 | 0.978 |
| 0.20 | 8.17 | 8.15 | 54,543 | 64.6 | 0.663 | 0.962 |
| 0.25 | 7.92 | 8.26 | 51,405 | 60.9 | 0.691 | 0.945 |
| **0.30** *(deployed)* | 7.71 | 8.40 | 48,533 | 57.5 | **0.716** | **0.925** |
| 0.40 | 7.32 | 8.81 | 43,326 | 51.3 | 0.764 | 0.881 |
| 0.50 | 7.05 | 9.42 | 38,829 | 46.0 | 0.808 | 0.835 |
| 0.60 | 6.84 | 10.26 | 34,578 | 40.9 | 0.849 | 0.782 |
| 0.70 | 6.81 | 11.51 | 30,342 | 35.9 | 0.888 | 0.717 |

```
Minimises val_mae_cascades : threshold 0.05  (val_mae_cascades 7.97)
Position in grid           : STILL AT BOUNDARY   (grid spans 0.05 to 0.7)
At threshold 0.05          : gate precision 0.563 | recall 0.997 | flags 78.8% of rows
Deployed GATE_THRESHOLD remains 0.3 - this cell changes nothing.
```

## A2. Extended test sweep — REPORTING ONLY, NOT FOR SELECTION

| Threshold | test_mae_all | test_mae_cascades | flagged | flagged % | gate precision | gate recall |
|---|---|---|---|---|---|---|
| 0.05 | 9.35 | 7.92 | 57,763 | 77.9 | 0.533 | 0.997 |
| 0.10 | 8.78 | 7.96 | 53,594 | 72.3 | 0.570 | 0.989 |
| 0.15 | 8.44 | 8.02 | 50,123 | 67.6 | 0.602 | 0.976 |
| 0.20 | 8.16 | 8.10 | 47,061 | 63.5 | 0.632 | 0.962 |
| 0.25 | 7.89 | 8.21 | 44,214 | 59.7 | 0.660 | 0.945 |
| **0.30** | 7.67 | 8.35 | 41,637 | 56.2 | **0.688** | **0.927** |
| 0.40 | 7.27 | 8.70 | 37,165 | 50.1 | 0.738 | 0.888 |
| 0.50 | 6.92 | 9.22 | 33,162 | 44.7 | 0.785 | 0.842 |
| 0.60 | 6.66 | 10.04 | 29,473 | 39.8 | 0.830 | 0.792 |
| 0.70 | 6.55 | 11.30 | 25,738 | 34.7 | 0.874 | 0.728 |

Test tracks validation closely at every threshold, so the picture generalises.

## A3. Assessment — is a threshold below 0.30 usable?

**No.**

The argmin is 0.05 and it is **still at the boundary**. Extending the grid did not find
an interior optimum because — and this is the substantive finding — **the selection
metric cannot have one.**

`mae_cascades` is measured only on rows where the target is already greater than zero.
On those rows, emitting `h_mid` always beats emitting 0, so lowering the threshold flags
more of them and the metric improves. It is **monotonically decreasing as the threshold
approaches 0, by construction**, and is minimised by flagging everything. No grid
extension will ever produce an interior minimum.

Meanwhile `mae_all` moves the opposite way (9.31 at 0.05 down to 6.81 at 0.70) and is
minimised at the *highest* threshold. The two objectives pull in opposite directions and
neither has an interior optimum. **0.30 was never an optimum in either metric.** It is a
judgement call about where to sit on the precision/recall curve — which the extended grid
makes visible rather than changes.

The gate columns settle usability. Moving 0.30 → 0.05 buys 0.43 min of `mae_cascades`
(8.40 → 7.97, about 5%) and costs:

- flag volume **57.5% → 78.8%** of all cascade candidates
- gate precision **0.716 → 0.563** — barely better than a coin flip per flag
- `mae_all` **7.71 → 9.31**, a 21% *degradation*

A gate that fires on four flights in five is not a gate. It has stopped discriminating,
and the MAE gain is an artifact of the metric's construction rather than a real
improvement.

**Recommendation: leave `GATE_THRESHOLD` at 0.30.** At that point the gate catches 93% of
genuine propagation at ~72% precision while flagging 58% of candidates — a defensible
operating point. Nothing was changed; `config.json` is untouched.

If you want a principled selection rather than a judgement call, the fix is to change the
**objective**, not the grid: minimise `mae_all`, maximise gate F1, or apply an explicit
cost ratio for a false flag versus a missed cascade. That is a decision about operational
cost, so it belongs to you rather than to a diagnostic cell.

## B1-B3. Feature group D ablation

Both variants use the full model's exact hyperparameters, splits, `scale_pos_weight` and
`random_state`; only the feature list differs.

| Configuration | n_feat | AUC | F1 | p@1% | p@5% |
|---|---|---|---|---|---|
| Full — Blend (published baseline) | 40 | 0.6819 | 0.351 | 0.781 | 0.459 |
| Full — XGBoost (like-for-like) | 40 | 0.6777 | 0.348 | 0.779 | 0.456 |
| **Without ENC_\* group** | **32** | **0.6879** | **0.357** | 0.772 | 0.455 |
| Without raw categoricals | 37 | 0.6795 | 0.349 | 0.757 | 0.457 |

Full metric rows:

```
Without ENC_* group      auc 0.6879  pr_auc 0.3295  precision 0.26  recall 0.57  f1 0.357  p@1% 0.772  p@5% 0.455  p@10% 0.374
Without raw categoricals auc 0.6795  pr_auc 0.3230  precision 0.25  recall 0.58  f1 0.349  p@1% 0.757  p@5% 0.457  p@10% 0.373
```

**Deltas vs the like-for-like full-feature XGBoost baseline** (the B1/B2 variants are
single XGBoost models, so the Blend is not a valid comparator for them):

| Configuration | n_feat | ΔAUC | ΔF1 | Δp@1% | Δp@5% |
|---|---|---|---|---|---|
| Without ENC_* group | 32 | **+0.0102** | **+0.009** | −0.007 | −0.001 |
| Without raw categoricals | 37 | +0.0018 | +0.001 | **−0.022** | +0.001 |

Early stopping: full model best iter 125; no-ENC 68; no-raw 225.

## B4. Verdict string as printed

```
No-ENC model vs like-for-like baseline: dAUC = +0.0102 | dp@1% = -0.007
Rule: |dAUC| < 0.005 AND |dp@1%| < 0.02
      |0.0102| = 0.0102 >= 0.005
      |-0.007| = 0.007 < 0.02

ENCODINGS REQUIRED - Fix 1 persistence was necessary
```

**The rule fired, but it fires the wrong way here.** It tests `|ΔAUC|` — magnitude, not
direction — and was written on the assumption that dropping the encodings would *cost*
AUC. The measured delta is **+0.0102: dropping them makes the model better**. A large
improvement trips the same branch a large degradation would. Read literally the output
says "REQUIRED"; read correctly the evidence says the opposite. Both are recorded here;
see B6.

## B5. Top 15 importances, 32-feature model (no ENC_*)

| Rank | Feature | Importance |
|---|---|---|
| 1 | LEG_FRACTION | 0.1624 |
| 2 | LEG_NUM | 0.1095 |
| 3 | SCHEDULED_BUFFER_MIN | 0.0820 |
| 4 | IS_LAST_LEG | 0.0646 |
| 5 | DEP_HOUR_SIN | 0.0581 |
| 6 | AVAILABLE_SLACK | 0.0571 |
| 7 | ORIGIN | 0.0445 |
| 8 | OP_UNIQUE_CARRIER | 0.0418 |
| 9 | TAIL_LEGS_TODAY | 0.0415 |
| 10 | CRS_DEP_TIME | 0.0384 |
| 11 | DEST | 0.0359 |
| 12 | ARR_HOUR_COS | 0.0252 |
| 13 | DAY_OF_WEEK | 0.0226 |
| 14 | ORIGIN_DAY_DEPARTURES | 0.0176 |
| 15 | DOW_SIN | 0.0159 |

Full 40-feature model top 5 for contrast: ENC_ROUTE 0.1857, ENC_ORIGIN_HOUR 0.1401,
LEG_NUM 0.0742, ENC_CARRIER_HOUR 0.0571, AVAILABLE_SLACK 0.0517.

With the encodings gone the model falls back onto **rotation structure** —
`LEG_FRACTION`, `LEG_NUM`, `SCHEDULED_BUFFER_MIN`, `IS_LAST_LEG`, `AVAILABLE_SLACK` are
five of the top six, and the raw categoricals `ORIGIN`/`OP_UNIQUE_CARRIER`/`DEST` pick up
the location signal directly. This is the same conclusion as the feature ablation in
§3.2: rotation features carry the model.

## B6. Assessment — should the encodings stay in production?

**On this evidence, no. They should go.** Three findings point the same way.

**1. Dropping them improves the model.** The 32-feature variant beats the like-for-like
40-feature XGBoost on AUC (+0.0102) and F1 (+0.009), ties on p@5% (−0.001), and loses
only 0.007 on p@1% (0.779 → 0.772). Eight features removed, and the primary discrimination
metric goes *up*. This is consistent with the feature ablation in §3.2, where group D was
the only group with a negative marginal gain (−0.0131 AUC). Two independent experiments
now agree the encodings subtract from AUC.

**2. The reverse test confirms they are the weaker representation.** This was the test's
purpose, and it answers cleanly:

- dropping the 8 encodings → p@1% **−0.007**
- dropping the 3 raw categoricals → p@1% **−0.022**, three times worse

The raw categoricals carry location and carrier signal more efficiently than the
encodings do. When both are present the trees prefer the encodings by split count —
33% of importance — but that preference does not convert into held-out performance. High
split-usage with negative held-out gain is the standard signature of target-encoding
overfitting, and it reproduces here.

**3. It converges faster.** Best iteration 68 without the encodings versus 125 with them
— roughly half the trees for a better AUC.

### The one reservation

**p@1% is the product's headline metric, and it does dip.** 0.779 → 0.772 on the
like-for-like comparison, and the *published* figure is the Blend's 0.781, which was not
re-tested without encodings. A no-ENC blend is the missing experiment. Before committing
to a 32-feature production model I would rerun the three-model blend on `FEATS_NO_ENC` and
confirm p@1% holds near 0.78. That is one cheap run and it removes the only genuine
objection.

### What this means for the Fix 1 persistence work

Fix 1 is **not wasted, but it may become unnecessary**. It was correct to build: at the
time, the encodings were in the production feature set and the model was unservable
without them. If you adopt the 32-feature model:

- `results/encodings.json` (407 KB, 13,116 entries) stops being a deployment artifact
- the API needs no unseen-key fallback and no `global_rate` default path
- the serving feature set is 32 columns, all derivable from the schedule plus the
  rotation graph, with no fitted lookup state to version or refresh
- the training/serving skew risk that target encodings introduce disappears entirely

That last point is worth weighing beyond the metrics. Target encodings are fitted state:
they must be recomputed as the network changes, versioned alongside the model, and kept
consistent between training and serving. Removing them removes a whole class of
production failure for, on this evidence, no measurable cost.

**Recommendation:** run the no-ENC blend to confirm p@1%, and if it holds near 0.78, drop
group D from the production feature set. Keep `encodings.json` and its verification cell
in the repository either way — they are the evidence for the decision, and they are needed
if the encodings stay.

## B7. Confirmation — baseline unchanged, `ALL_FEATURES` not modified

| Metric | Expected | Measured | Match |
|---|---|---|---|
| AUC (Blend) | 0.6819 | 0.6819 | yes |
| F1 | 0.351 | 0.351 | yes |
| precision@1% | 0.781 | 0.781 | yes |

Printed by the notebook at the end of Check B:

```
ALL_FEATURES untouched: 40 features; ENC_* still present: True
```

`ALL_FEATURES` still holds 40 features with all eight `ENC_*` columns present. The
production feature set, the saved model `results/xgb_primary_classifier.json`, and the
three results CSVs are unchanged. Both checks are diagnostic cells only: the Check B
insertion asserted at apply time that every pre-existing cell source was byte-identical
after the append, and Check A changed no configuration value.

Nothing in `results/layer4/config.json` was modified — `gate_threshold` remains 0.3.

---

# BLEND WITHOUT ENCODINGS

Run 2026-09-13. Diagnostic only — four cells appended to `fdpis_2_modelling.ipynb`
(41 → 45 cells), no existing cell modified, `ALL_FEATURES` unchanged, production model
not overwritten. Notebook 2 executed linearly: **748 s, zero errors, sequential
execution counts**. Backup at `<scratchpad>/backup_blend/`.

All three components use hyperparameters, splits, `scale_pos_weight` and `random_state`
identical to the production blend; the soft vote is the same mean of three predicted
probabilities. Only the feature list differs.

## BL1. Blend comparison

| Configuration | n_feat | AUC | PR-AUC | Prec | Recall | F1 | p@1% | p@5% | p@10% |
|---|---|---|---|---|---|---|---|---|---|
| Blend WITH encodings | 40 | 0.6819 | 0.3267 | 0.252 | 0.580 | 0.351 | **0.781** | 0.459 | 0.374 |
| Blend WITHOUT encodings | 32 | **0.6924** | **0.3339** | **0.260** | **0.585** | **0.360** | **0.781** | 0.458 | **0.380** |
| **DELTA (without − with)** | **−8** | **+0.0105** | **+0.0072** | **+0.008** | **+0.005** | **+0.009** | **0.000** | **−0.001** | **+0.006** |

**p@1% is identical to three decimal places — 0.781 either way.** Every other metric
except p@5% (−0.001) improves, on eight fewer features.

## BL2. Per-component results, 32 features

| Model | AUC | PR-AUC | Prec | Recall | F1 | p@1% | p@5% | p@10% |
|---|---|---|---|---|---|---|---|---|
| XGBoost (no ENC) | 0.6879 | 0.3295 | 0.260 | 0.570 | 0.357 | 0.772 | 0.455 | 0.374 |
| HistGradientBoosting (no ENC) | 0.6880 | 0.3276 | 0.254 | 0.591 | 0.356 | 0.775 | 0.452 | 0.372 |
| LightGBM (no ENC) | 0.6855 | 0.3248 | 0.254 | 0.585 | 0.355 | 0.768 | 0.443 | 0.372 |
| **Blend (soft vote, no ENC)** | **0.6924** | **0.3339** | 0.260 | 0.585 | **0.360** | **0.781** | 0.458 | **0.380** |

Component-by-component against their with-encoding counterparts:

| Component | AUC with | AUC without | ΔAUC | p@1% with | p@1% without | Δp@1% |
|---|---|---|---|---|---|---|
| XGBoost | 0.6777 | 0.6879 | **+0.0102** | 0.779 | 0.772 | −0.007 |
| HistGradientBoosting | 0.6791 | 0.6880 | **+0.0089** | 0.760 | 0.775 | **+0.015** |
| LightGBM | 0.6801 | 0.6855 | **+0.0054** | 0.768 | 0.768 | 0.000 |
| Blend | 0.6819 | 0.6924 | **+0.0105** | 0.781 | 0.781 | 0.000 |

**The AUC gain holds across all three components — it is not driven by one model.**
On p@1% the components disagree in direction (XGBoost −0.007, HistGB +0.015, LightGBM 0),
and the blend averages those disagreements out to exactly zero. That is the blend doing
its job: the p@1% dip that Check B found in the single XGBoost is a component-level
artifact, not a property of the ensemble.

Note also that the blend without encodings (0.6924) beats every individual model in the
original 7-model comparison, including the 40-feature blend.

## BL3. Verdict as printed

```
delta_p1  = +0.0000
delta_auc = +0.0105

DROP ENCODINGS - blend holds, model is simpler and AUC improves
```

Rule satisfied on both arms: `delta_p1 (0.0000) >= -0.01` and `delta_auc (+0.0105) > 0`.
Unlike the Check B rule, this one tests direction, so it fires correctly.

## BL4. Per-carrier precision@1%

| Carrier | Test flights | Top-1% n | Base rate | Prec WITH | Prec WITHOUT | Δ | Lift without |
|---|---|---|---|---|---|---|---|
| DL | 35,041 | 350 | 0.154 | 0.951 | 0.951 | 0.000 | 6.18 |
| OO | 30,044 | 300 | 0.186 | 0.863 | 0.880 | +0.017 | 4.73 |
| G4 | 4,702 | 47 | 0.122 | 0.723 | 0.809 | **+0.085** | 6.62 |
| WN | 42,169 | 421 | 0.159 | 0.779 | 0.800 | +0.021 | 5.04 |
| NK | 6,842 | 68 | 0.176 | 0.735 | 0.794 | +0.059 | 4.52 |
| AS | 7,814 | 78 | 0.190 | 0.692 | 0.782 | **+0.090** | 4.12 |
| HA | 2,603 | 26 | 0.102 | 0.731 | 0.577 | **−0.154** | 5.67 |
| UA | 25,103 | 251 | 0.150 | 0.510 | 0.534 | +0.024 | 3.57 |
| AA | 28,920 | 289 | 0.159 | 0.505 | 0.533 | +0.028 | 3.36 |
| B6 | 6,982 | 69 | 0.161 | 0.478 | 0.493 | +0.014 | 3.07 |
| YX | 10,715 | 107 | 0.122 | 0.486 | 0.458 | −0.028 | 3.75 |
| F9 | 5,440 | 54 | 0.188 | 0.407 | 0.426 | +0.019 | 2.26 |
| OH | 6,912 | 69 | 0.137 | 0.464 | 0.391 | −0.072 | 2.86 |
| MQ | 9,814 | 98 | 0.090 | 0.276 | 0.276 | 0.000 | 3.07 |

| Aggregate | WITH enc | WITHOUT enc | Δ |
|---|---|---|---|
| Global precision@1% | 0.781 | 0.781 | **+0.000** |
| Mean per-carrier | 0.614 | 0.622 | **+0.007** |
| Weighted by volume | 0.681 | **0.696** | **+0.015** |

**Eleven of fourteen carriers improve or hold.** Three degrade: HA −0.154, OH −0.072,
YX −0.028. HA is the smallest carrier in the set — 2,603 test flights, top-1% of just
**26 flights**, where a single flight moves precision by 3.8 points, so a −0.154 swing is
four flights and is inside the noise. OH and YX are regionals with 69 and 107 flights in
their review queues respectively; both are also thin.

The carriers that matter commercially move the right way: **AA +0.028 and UA +0.024**,
the two large legacy carriers previously identified in §3.3 as landing near half the
headline figure. They remain the weakest large carriers, but both improve.

## BL5. Assessment — drop the encodings from the production feature set

**Yes. The evidence is now unambiguous, and the one reservation from §B6 is resolved.**

The objection to Check B was that it tested a single XGBoost while the headline comes
from the blend. That objection is answered: **the blend holds p@1% at exactly 0.781** —
not approximately, identically — while AUC rises 0.6819 → 0.6924, F1 0.351 → 0.360 and
p@10% 0.374 → 0.380, on eight fewer features. The only metric that moves against is
p@5%, by 0.001.

Four independent results now point the same way:

1. **The §3.2 feature ablation** gave group D a marginal gain of **−0.0131 AUC** — the
   only negative group in the table.
2. **Check B** showed a single XGBoost improves by **+0.0102 AUC** when they are removed.
3. **Check B's reverse test** showed dropping the raw categoricals costs three times more
   p@1% (−0.022) than dropping the encodings (−0.007) — the encodings are the weaker of
   the two representations.
4. **This blend test** shows the ensemble improves on AUC and holds the headline metric
   exactly.

The mechanism is consistent throughout: the encodings carry real signal individually —
`ENC_ROUTE` 0.186 and `ENC_ORIGIN_HOUR` 0.140 are the top two features by split count —
but that signal is **already available** from `ORIGIN`, `DEST` and `OP_UNIQUE_CARRIER`,
which the trees can split on directly. High split-usage combined with negative held-out
gain is the textbook signature of target-encoding overfitting, and it reproduces at every
level of the stack.

Per-carrier deployment, which is how the product would actually be sold, also improves:
volume-weighted precision **0.681 → 0.696**.

### What changes if you adopt the 32-feature model

- **Production feature set becomes 32 columns**, all derivable from the published
  schedule plus the rotation graph. No fitted lookup state.
- **`results/encodings.json` stops being a deployment artifact.** 407 KB and 13,116
  entries no longer need to be versioned, shipped or refreshed alongside the model.
- **The API needs no unseen-key fallback** and no `global_rate` default path.
- **A whole class of production failure disappears.** Target encodings are fitted state
  that must stay consistent between training and serving; when the route network changes
  they go stale silently. Removing them removes that risk entirely.
- **Training is faster** — XGBoost early-stops at iteration 68 instead of 125.

### Caveats worth stating

- **p@1% is identical, not better.** The case for dropping rests on AUC, F1, simplicity
  and operational risk — not on a headline improvement. If AUC is not a metric the
  project cares about, the honest summary is "no worse, and much simpler".
- **Three small carriers degrade** (HA, OH, YX), all with review queues under 110
  flights where a handful of flights swings the number. Worth re-checking on more data
  before promising per-carrier figures to a regional operator.
- **The published documentation does not need revising if you drop them.** Global p@1%
  stays 0.781 and lift stays 5.0×. The weighted per-carrier figure would improve from
  0.681 to 0.696 and should be updated if it is quoted anywhere.
- **Fix 1 was not wasted.** It was correct when the encodings were in the production set,
  it produced the verified-exact persistence that made the model servable at the time, and
  `encodings.json` plus its round-trip cell remain the evidence for this decision. Keep
  them in the repository regardless.

### Recommendation

Drop feature group D from the production feature set and adopt the 32-feature blend.
This is a change to `ALL_FEATURES` and a retrain of the saved model, which I have **not**
made — the production configuration is untouched and this section is diagnostic only.

## BL6. Confirmation — nothing production was changed

| Check | Expected | Measured | Match |
|---|---|---|---|
| Blend AUC | 0.6819 | 0.6819 | yes |
| Blend F1 | 0.351 | 0.351 | yes |
| Blend precision@1% | 0.781 | 0.781 | yes |

```
ALL_FEATURES untouched: 40 features; ENC_* still present: True
```

`results/model_comparison.csv` still reports the 40-feature blend at
`0.6819,0.3267,0.252,0.58,0.351,0.781,0.459,0.374`. `ALL_FEATURES` still holds 40
features with all eight `ENC_*` columns. `results/xgb_primary_classifier.json` is the
40-feature model, regenerated by this run at its usual 7,389,886 bytes — the diagnostic
models were held in local variables and never saved. The insertion asserted at apply time
that every pre-existing cell source was byte-identical after the append.

---

# PRODUCTION: ENCODINGS REMOVED

Applied 2026-09-13. This is a production change: the 8 `ENC_*` target-encoding features
are no longer part of `ALL_FEATURES` and the saved model is retrained on 32 features.
Backups of all five notebooks at `<scratchpad>/backup_prod_enc_removal/`.

Evidence base (four independent results, all recorded above): §3.2 ablation group D
marginal gain **−0.0131 AUC**; Check B single model **+0.0102 AUC** when dropped; Check B
reverse test — dropping raw categoricals costs **3× more** p@1%; blend confirmation
**+0.0105 AUC, +0.009 F1, p@1% unchanged at 0.781**.

## P1. `ALL_FEATURES` is now 32 features

```
32 PRODUCTION features across 5 groups - leakage check passed.
  A_schedule      9
  B_cyclical      6
  C_categorical   3
  E_congestion    5
  F_rotation      9

Ablation study retains all 6 groups (40 features) so the published table stays reproducible.
  excluded from production: ['D_encodings'] (8 features)
```

The exact production list:

| Group | Features |
|---|---|
| A_schedule (9) | `CRS_DEP_TIME`, `CRS_ARR_TIME`, `DEP_HOUR`, `ARR_HOUR`, `CRS_ELAPSED_TIME`, `DISTANCE`, `SPEED_PROXY`, `DAY_OF_WEEK`, `IS_WEEKEND` |
| B_cyclical (6) | `DEP_HOUR_SIN`, `DEP_HOUR_COS`, `ARR_HOUR_SIN`, `ARR_HOUR_COS`, `DOW_SIN`, `DOW_COS` |
| C_categorical (3) | `OP_UNIQUE_CARRIER`, `ORIGIN`, `DEST` |
| E_congestion (5) | `ORIGIN_HOUR_DEPARTURES`, `DEST_HOUR_ARRIVALS`, `ORIGIN_DAY_DEPARTURES`, `CARRIER_ORIGIN_FLIGHTS`, `CARRIER_ORIGIN_SHARE` |
| F_rotation (9) | `LEG_NUM`, `TAIL_LEGS_TODAY`, `LEG_FRACTION`, `IS_LAST_LEG`, `MINUTES_INTO_TAIL_DAY`, `SCHEDULED_BUFFER_MIN`, `AVAILABLE_SLACK`, `IS_TIGHT_TURNAROUND`, `LONG_GROUND_TIME` |

Removed from production: `ENC_CARRIER`, `ENC_ORIGIN`, `ENC_DEST`, `ENC_ROUTE`,
`ENC_ORIGIN_HOUR`, `ENC_CARRIER_ORIGIN`, `ENC_CARRIER_HOUR`, `ENC_DOW_HOUR`.

**How it was restructured.** The cell now defines `ABLATION_GROUPS` with all six groups
(the published study) and derives the production set from it:

```python
DROPPED_GROUPS = ['D_encodings']
GROUPS = {k: v for k, v in ABLATION_GROUPS.items() if k not in DROPPED_GROUPS}
ALL_FEATURES = [f for g in GROUPS.values() for f in g]
```

The ablation loop iterates `ABLATION_GROUPS`; everything else uses `ALL_FEATURES`. The
encoding computation cell was **not** deleted — the ablation needs it.

## P2. The §3.2 ablation still produces all six rows, unchanged

```
        model  n_feat    auc auc_gain  pr_auc    f1  p@1%  p@5%  p@10%
   A_schedule       9 0.6357           0.2275 0.322 0.280 0.277  0.265
   B_cyclical      15 0.6385   0.0028  0.2345 0.321 0.316 0.303  0.279
C_categorical      18 0.6519   0.0134  0.2476 0.330 0.374 0.314  0.293
  D_encodings      26 0.6388  -0.0131  0.2400 0.319 0.355 0.309  0.290
 E_congestion      31 0.6410   0.0022  0.2420 0.322 0.366 0.313  0.293
   F_rotation      40 0.6777   0.0367  0.3239 0.348 0.779 0.456  0.371
```

Byte-identical to the published table in §3.2, including the `D_encodings` row and its
−0.0131 gain. The ablation remains reproducible.

## P3. New production metrics vs previously published

Seven-way model comparison, 32 features:

| Model | AUC | PR-AUC | Prec | Recall | F1 | p@1% | p@5% | p@10% |
|---|---|---|---|---|---|---|---|---|
| **Blend (soft vote)** | **0.6924** | **0.3339** | 0.260 | 0.585 | **0.360** | **0.781** | 0.458 | 0.380 |
| RandomForest | 0.6894 | 0.3305 | 0.267 | 0.542 | 0.358 | 0.775 | 0.456 | 0.374 |
| HistGradientBoosting | 0.6880 | 0.3276 | 0.254 | 0.591 | 0.356 | 0.775 | 0.452 | 0.372 |
| XGBoost | 0.6879 | 0.3295 | 0.260 | 0.570 | 0.357 | 0.772 | 0.455 | 0.374 |
| LightGBM | 0.6855 | 0.3248 | 0.254 | 0.585 | 0.355 | 0.768 | 0.443 | 0.372 |
| LogisticRegression | 0.6551 | 0.2543 | 0.237 | 0.551 | 0.331 | 0.382 | 0.342 | 0.312 |
| Majority baseline | 0.5000 | 0.1561 | 0.156 | 1.000 | 0.270 | 0.156 | 0.156 | 0.156 |

Headline blend, old vs new:

| Metric | Old (40 feat) | New (32 feat) | Delta |
|---|---|---|---|
| AUC | 0.6819 | **0.6924** | **+0.0105** |
| PR-AUC | 0.3267 | 0.3339 | +0.0072 |
| Precision | 0.252 | 0.260 | +0.008 |
| Recall | 0.580 | 0.585 | +0.005 |
| F1 | 0.351 | **0.360** | **+0.009** |
| p@1% | 0.781 | **0.781** | **0.000** |
| p@5% | 0.459 | 0.458 | −0.001 |
| p@10% | 0.374 | 0.380 | +0.006 |
| Lift @1% | 5.00× | 5.01× | +0.01 |

Tolerance check from the notebook — all five gated metrics exact to four decimals:

```
metric      expected    actual     delta   status
auc           0.6924    0.6924   +0.0000   OK
f1            0.3600    0.3600   +0.0000   OK
p@1%          0.7810    0.7810   +0.0000   OK
p@5%          0.4580    0.4580   +0.0000   OK
p@10%         0.3800    0.3800   +0.0000   OK
```

Saved artifact `results/xgb_primary_classifier.json` is the XGBoost component:
AUC 0.6879, PR-AUC 0.3295, F1 0.357, p@1% 0.772. **Size 5,467,472 bytes, down from
7,389,886** — a 26% smaller model, rewritten 2026-09-13 13:39:21.

Top feature importances now: `LEG_FRACTION` 0.162, `LEG_NUM` 0.109,
`SCHEDULED_BUFFER_MIN` 0.082, `IS_LAST_LEG` 0.065, `DEP_HOUR_SIN` 0.058,
`AVAILABLE_SLACK` 0.057, `ORIGIN` 0.044, `OP_UNIQUE_CARRIER` 0.042. Rotation structure
dominates, which is the §3.2 conclusion restated.

## P4. Per-carrier precision@1%, 32-feature production model

| Carrier | Test flights | Per day | Top-1% n | Precision | Base rate | Lift |
|---|---|---|---|---|---|---|
| DL | 35,041 | 2,695 | 350 | 0.951 | 0.154 | 6.18 |
| OO | 30,044 | 2,311 | 300 | 0.880 | 0.186 | 4.73 |
| G4 | 4,702 | 362 | 47 | 0.809 | 0.122 | 6.62 |
| WN | 42,169 | 3,244 | 421 | 0.800 | 0.159 | 5.04 |
| NK | 6,842 | 526 | 68 | 0.794 | 0.176 | 4.52 |
| AS | 7,814 | 601 | 78 | 0.782 | 0.190 | 4.12 |
| HA | 2,603 | 200 | 26 | 0.577 | 0.102 | 5.67 |
| UA | 25,103 | 1,931 | 251 | 0.534 | 0.150 | 3.57 |
| AA | 28,920 | 2,225 | 289 | 0.533 | 0.159 | 3.36 |
| B6 | 6,982 | 537 | 69 | 0.493 | 0.161 | 3.07 |
| YX | 10,715 | 824 | 107 | 0.458 | 0.122 | 3.75 |
| F9 | 5,440 | 418 | 54 | 0.426 | 0.188 | 2.26 |
| OH | 6,912 | 532 | 69 | 0.391 | 0.137 | 2.86 |
| MQ | 9,814 | 755 | 98 | 0.276 | 0.090 | 3.07 |

| Aggregate | Old (40 feat) | New (32 feat) | Delta |
|---|---|---|---|
| Global precision@1% | 0.781 | 0.781 | 0.000 |
| Mean per-carrier | 0.614 | **0.622** | **+0.007** |
| **Weighted by volume** | 0.681 | **0.696** | **+0.015** |

## P5. Step 2 — downstream dependency check: NONE

| Artifact | `ENC_*` occurrences | Verdict |
|---|---|---|
| `PROP_FEATURES` (notebook 3, 27 features) | 0 | no dependency |
| `results/layer4/config.json` (`features`, `cat_cols`) | 0 | no dependency |
| `fdpis_3_propagation.ipynb` | 0 | no dependency |
| `fdpis_4_multihop.ipynb` | 0 | no dependency |
| `fdpis_5_integration.ipynb` | 2 | **markdown prose only**, no code |
| `encodings.json` referenced outside notebook 2 | none | no dependency |

Layer 4 consumes an **observed** delay, not a Layer 3 prediction, and builds its own
feature list. Notebooks 3–5 required no code changes.

## P6. Notebooks 3, 4, 5 — rerun, figures unchanged

| Notebook | Runtime | Result | Errors | Sequential |
|---|---|---|---|---|
| `fdpis_3_propagation.ipynb` | 239 s | PASS | 0 | yes |
| `fdpis_4_multihop.ipynb` | 18 s | PASS | 0 | yes |
| `fdpis_5_integration.ipynb` | 29 s | PASS | 0 | yes |

Notebook 3 — identical: gate AUC **0.9272**, precision **0.785**, recall **0.842**;
final MAE **7.67** all candidates / **8.35** actual cascades; interval coverage **70.2%**;
threshold **0.3** selected on validation; category levels 14/339/339.

Notebook 4 — identical depth table:

| Depth | n | MAE cascades | Corr | Coverage |
|---|---|---|---|---|
| 1 | 21,999 | 8.67 | 0.790 | 0.770 |
| 2 | 9,945 | 29.34 | 0.560 | 0.536 |
| 3 | 3,810 | 40.89 | 0.433 | 0.476 |
| 4 | 1,243 | 48.79 | 0.318 | 0.444 |
| 5 | 328 | 62.52 | 0.262 | 0.497 |

Notebook 5 — identical: total-delay MAE **20.87 / 31.88 / 35.15 / 38.66 / 39.91**,
correlation **0.674 / 0.428 / 0.327 / 0.233 / 0.226**.

Every downstream figure matches the pre-change run exactly, confirming the Layer 3 and
Layer 4 feature sets are genuinely independent.

## P7. Files and cells removed

**Deleted file:** `results/encodings.json` — 407,225 bytes, 13,116 entries. No longer a
deployment artifact.

**Cells removed from `fdpis_2_modelling.ipynb` (43 → 35 cells):**

| # | Type | First line |
|---|---|---|
| 1 | markdown | `## 4b — Persist the target encodings (Fix 1)` |
| 2 | code | `# ===== FIX 1: persist the target encodings so the model can…` |
| 3 | code | `# ===== FIX 1 verification: the JSON round trip must be numerically exact` |
| 4 | markdown | `## 15 — Check B: is feature group D earning its place? (diagnostic)` |
| 5 | code | `# ===== CHECK B: is feature group D (the ENC_* encodings) earning its place?` |
| 6 | code | `# ===== B3/B4: comparison table, deltas and verdict =====` |
| 7 | code | `# ===== B5: what does the 32-feature model rely on without the encodings?` |
| 8 | markdown | `## 16 — Blend without encodings (diagnostic)` |
| 9 | code | `# ===== BLEND WITHOUT ENCODINGS - diagnostic only =====` |
| 10 | code | `# ===== Comparison against the production blend, plus the verdict =====` |
| 11 | code | `# ===== Per-carrier precision@1% for the 32-feature blend =====` |

The six diagnostic cells plus two headings were removed after the production change made
them self-referential — `FEATS_NO_ENC` resolved to `ALL_FEATURES`, so they compared the
32-feature set against itself and printed a row labelled "Blend WITH encodings | 32".
Their evidence is permanently recorded above under **CHECKS A AND B** and
**BLEND WITHOUT ENCODINGS**.

**Cell added:** a production confirmation cell after the model save, asserting the blend
metrics against expectation within ±0.002.

**Runtime effect:** notebook 2 now runs in **414 s (6m 54s)**, down from **748 s
(12m 28s)** with the diagnostics — **45% faster**, five fewer models trained per run.

Verified still present and correct: the encoding computation cell, the six-row ablation,
the seven-way model comparison, the per-carrier analysis, and the production save path.

## P8. Documentation items needing update

| # | Location | Old | New |
|---|---|---|---|
| 1 | Model / feature-set description | 40 features across 6 groups | **32 features across 5 groups** |
| 2 | Headline AUC | 0.6819 | **0.6924** |
| 3 | Headline F1 | 0.351 | **0.360** |
| 4 | PR-AUC | 0.3267 | **0.3339** |
| 5 | Precision / recall at 0.5 | 0.252 / 0.580 | **0.260 / 0.585** |
| 6 | p@5% | 0.459 | **0.458** |
| 7 | p@10% | 0.374 | **0.380** |
| 8 | Weighted per-carrier p@1% | 0.681 | **0.696** |
| 9 | Mean per-carrier p@1% | 0.614 | **0.622** |
| 10 | Top feature importances | ENC_ROUTE 0.186, ENC_ORIGIN_HOUR 0.140 | **LEG_FRACTION 0.162, LEG_NUM 0.109** |
| 11 | Model comparison table (7 rows) | 40-feature figures | **32-feature figures, §P3** |
| 12 | Saved model size | 7,389,886 bytes | **5,467,472 bytes** |
| 13 | Serving requirements | model + `encodings.json` + unseen-key fallback | **model only** |
| 14 | `fdpis_5_integration.ipynb` markdown, cell 3 | see below | see below |

**Unchanged and safe to keep as published:** global precision@1% **0.781**, lift **5.0×**,
base delay rate **0.156**, the entire §3.2 ablation table, all Layer 4 / Layer 5 figures,
and the cascade-detection validation (0.894 / 0.668 / 0.765).

### Item 14 — stale prose in `fdpis_5_integration.ipynb`, markdown cell 3

Not edited, per instruction. The Layer 5 integration logic it describes is unaffected;
only the sentence's supporting claim is now wrong. Current text:

> This uses the same signal that dominated Layer 3's feature importance — `ENC_ROUTE` at
> 18.6% and `ENC_ORIGIN_HOUR` at 14.0%, together a third of the model — without needing
> to rebuild…

`ENC_ROUTE` and `ENC_ORIGIN_HOUR` are no longer in the Layer 3 model at all. Suggested
replacement preserving the argument:

> This uses the same route- and hour-level delay signal that Layer 3 relies on. In the
> current 32-feature model that signal arrives through the raw categoricals `ORIGIN`
> (4.4%) and `OP_UNIQUE_CARRIER` (4.2%) alongside the rotation features that dominate it
> — `LEG_FRACTION` at 16.2% and `LEG_NUM` at 10.9% — rather than through the target
> encodings, which were removed from production after four independent tests showed they
> subtracted from AUC. The empirical lookup below is built directly from training data,
> so it needs no fitted encoding state either way.

Also worth a look when that cell is revised: the surrounding paragraph argues the
empirical primary-delay lookup avoids "rebuilding" the encodings. That argument is now
stronger, not weaker — there are no encodings to rebuild.

## P9. What this changes operationally

The production model is now **32 schedule- and rotation-derived features with no fitted
lookup state**. Serving needs the model artifact alone: no `encodings.json` to version or
refresh, no unseen-key fallback, no `global_rate` default path, and no training/serving
skew risk from stale target encodings as the route network changes. The model is 26%
smaller and XGBoost early-stops at iteration 68 rather than 125.

The headline the project sells on — precision@1% of 0.781 at 5.0× lift — is unchanged.
Everything else moved in the right direction.

---

# WEATHER INTEGRATION

Run 2026-10-16 in the new notebook `fdpis_7_weather.ipynb`. **This is not a production
change.** `fdpis_2_modelling.ipynb` and every production artifact in `results/` and `api/` are
untouched (all `results/` files still dated 2026-09-13). The Variant B model is saved as a
candidate in `results/candidates/weather_b/`.

The question was whether historical airport weather improves the Layer 3 primary-delay model.
There were two variants, because training on actual departure-hour weather is perfect hindsight:

- **Variant A, weather at departure.** The origin observation at the scheduled departure hour
  and the destination observation at the scheduled arrival hour. This is an **upper bound**
  (equivalent to a perfect forecast) and cannot be deployed.
- **Variant B, weather 3 h before departure.** The latest observation at or before
  `floor(scheduled departure) − 3 h`, at both the origin and the destination. It is keyed on
  the UTC instant, because "3 h before departure" is a single moment even when the two airports
  are in different zones. This is the **honest number**. The notebook asserts that every
  observation used is at least 3 h before departure: minimum lead 3:00, median 3:34, at both
  ends.

**Verdict: Variant B does not help.** AUC changes by **−0.0014** and p@1% by **−0.022**. It fails
the promotion rule, so the recommendation is to keep it as a documented experiment.

## W1. Stations

| | Count |
|---|---|
| Unique ORIGIN ∪ DEST in `processed.parquet` | **345** |
| Returned data | **345** |
| Missing | **0** |
| Observations (routine + special METAR, 2025-01-01 → 2025-08-01) | 2,213,510 (median 6,256 per station) |

Source: IEM ASOS archive, one request per station, 1.5 s between requests. Each response is
cached to `data/weather/raw/{IATA}.csv`, with the IEM ID that worked in `{IATA}.meta` and the
summary in `data/weather/station_manifest.csv`.

42 stations returned nothing under their IATA code and were fetched under the ICAO code from
`airportsdata`. These fall into three groups:

- Alaska, Hawaii and the territories, which IEM indexes by ICAO: ANC→PANC, HNL→PHNL, GUM→PGUM,
  SJU→TJSJ, PPG→NSTU and others.
- Airports whose FAA identifier differs from their IATA code: AZA→KIWA, CLD→KCRQ, FCA→KGPI,
  GUF→KJKA, HHH→KHXD, MQT→KSAW, SCE→KUNV, USA→KJQF, YUM→KNYL.
- **PBI→KDJT.** Palm Beach International has been re-designated. Both `airportsdata` (whose
  lat/lon matches West Palm Beach) and IEM now key the same ASOS station as DJT/KDJT, and PBI
  and KPBI both return no data. It is the correct physical station.

Data-quality note: the raw archive contains a few implausible values (max wind 189 kt, max gust
231 kt). They were left in. Tree models split on them, but they are too rare to move the
metrics.

## W2. Timezone verification

METAR timestamps are UTC and BTS schedules are local. Every observation was converted with the
`airportsdata` IANA zone before joining. The table shows one instant (the first observation at
or after 2025-07-15 18:00 UTC):

| Station | Zone | UTC | Local | Offset |
|---|---|---|---|---|
| ATL | America/New_York | 2025-07-15 18:52 | 2025-07-15 14:52 | −4 h |
| ORD | America/Chicago | 2025-07-15 18:51 | 2025-07-15 13:51 | −5 h |
| DEN | America/Denver | 2025-07-15 18:35 | 2025-07-15 12:35 | −6 h |
| PHX | America/Phoenix | 2025-07-15 18:51 | 2025-07-15 11:51 | −7 h (no DST) |
| LAX | America/Los_Angeles | 2025-07-15 18:53 | 2025-07-15 11:53 | −7 h |
| HNL | Pacific/Honolulu | 2025-07-15 18:53 | 2025-07-15 08:53 | −10 h |

DST check: ATL in January is −5 h (EST). All offsets are asserted in the notebook.

## W3. Missing-data rates

These are the percentages of all 1,718,426 flights with no value after a forward-fill of up to
2 h within each station. NaN beyond that is left for the trees.

| | Variant A | Variant B |
|---|---|---|
| Origin, no weather row | 0.27% | 0.15% |
| Destination, no weather row | 0.42% | 0.14% |
| Worst single feature | 0.43% (DEST visibility/wind/temp/ceiling) | 0.17% (ORIG visibility/wind/temp) |

The per-feature table is in `data/weather/missing_rates.csv`. Coverage is effectively complete
for both variants.

Feature definitions:

- Visibility is capped at 10 mi.
- Gust is 0 when not reported.
- A trace of precipitation is recorded as 0.0001 in.
- Ceiling is the lowest BKN, OVC or **VV** layer, or 10,000 ft if there is none, capped at
  10,000. VV (vertical visibility) is how METAR reports an indefinite ceiling in fog, and the
  FAA counts it as a ceiling.
- TS, SN and FG are matched as substrings of the present-weather codes, so `TSRA` and `VCTS`
  count as TS.
- IFR means visibility < 3 mi or ceiling < 1,000 ft.

## W4. Sanity check against `WEATHER_DELAY`: **PASS**

The sample is 388,746 flights with cause codes: 29,050 with `WEATHER_DELAY > 0` and 359,696 with
`WEATHER_DELAY = 0`. It uses Variant A origin weather.

| Feature | WEATHER_DELAY > 0 | WEATHER_DELAY = 0 | Ratio |
|---|---|---|---|
| ORIG_WX_IS_IFR | 0.1384 | 0.0559 | **2.48×** |
| ORIG_WX_IS_THUNDER | 0.2100 | 0.0199 | **10.54×** |
| ORIG_WX_VISIBILITY (mi) | 8.39 | 9.42 | 0.89× |
| ORIG_WX_CEILING_FT | 6,877 | 8,100 | 0.85× |
| ORIG_WX_PRECIP_IN | 0.0330 | 0.0041 | 7.97× |

All three required directions hold: weather-delayed flights have more IFR, more thunder and lower
visibility.

As a second check, the origin join key was shifted by −8 to +8 hours. A timezone bug would put
the peak 4–10 h away from zero. The thunder separation peaks at exactly **0 h** (10.54×), falls
to 6.7× at −1 h and 6.5× at +2 h, and is down to about 3× at ±4–5 h.

**The join is aligned correctly.**

## W5. Comparison: baseline vs A vs B

Test split: 223,101 flights, 2025-07-19 → 2025-07-31. Setup identical to notebook 2: same 32
features, same date split, scale_pos_weight 7.88, XGBoost + HistGradientBoosting + LightGBM soft
vote, random_state 42. The baseline reproduced production **exactly** (AUC 0.6924, p@1% 0.781)
before any weather model ran.

| Config | AUC | PR-AUC | F1 | p@0.5% | p@1% | p@5% | p@10% | Carrier-wtd p@1% |
|---|---|---|---|---|---|---|---|---|
| Baseline (32 production) | 0.6924 | 0.3339 | 0.360 | 0.891 | 0.781 | 0.458 | 0.380 | 0.696 |
| + Weather A (upper bound) | 0.7002 | 0.3478 | 0.366 | 0.874 | 0.804 | 0.486 | 0.395 | 0.741 |
| + Weather B (honest) | 0.6910 | 0.3274 | 0.355 | 0.876 | 0.759 | 0.445 | 0.369 | 0.692 |
| **Δ A** | **+0.0078** | +0.0139 | +0.006 | −0.017 | **+0.023** | +0.028 | +0.015 | +0.045 |
| **Δ B** | **−0.0014** | −0.0065 | −0.005 | −0.015 | **−0.022** | −0.013 | −0.011 | −0.004 |

F1 is at a 0.5 threshold. B's F1 fell even though recall rose from 0.585 to 0.657, because
precision fell from 0.260 to 0.243.

## W6. The value of a perfect forecast

**A − B = +0.0092 AUC, +0.045 p@1%, +0.049 carrier-weighted p@1%.**

Stated plainly:

- Knowing the actual weather at departure would lift the model by nearly a point of AUC and
  4.5 points of top-1% precision.
- Knowing only the weather 3 hours earlier gives **none** of that. It is slightly worse than no
  weather at all.
- The weather signal that matters for primary delay is the weather **at the time of the
  operation**, and a 3-hour-old observation is not a usable proxy for it.
- A real **forecast** product (TAF, or convective outlooks such as the FAA CCFP/TCF) is the only
  route to capturing part of that gap. It would need its own historical archive to train on,
  which this experiment did not have.

## W7. Variant B: importances and ablation

XGBoost component, same importance measure as notebook 2. Top 15:

| Rank | Feature | Importance | Weather? |
|---|---|---|---|
| 1 | LEG_FRACTION | 0.0858 | |
| 2 | LEG_NUM | 0.0797 | |
| 3 | DEP_HOUR_SIN | 0.0510 | |
| 4 | SCHEDULED_BUFFER_MIN | 0.0449 | |
| 5 | AVAILABLE_SLACK | 0.0447 | |
| 6 | ORIG_WX_PRECIP_IN | 0.0433 | ✓ |
| 7 | DEST_WX_PRECIP_IN | 0.0397 | ✓ |
| 8 | ORIGIN | 0.0257 | |
| 9 | ORIG_WX_IS_THUNDER | 0.0245 | ✓ |
| 10 | DEST_WX_IS_IFR | 0.0242 | ✓ |
| 11 | DEST_WX_IS_THUNDER | 0.0239 | ✓ |
| 12 | DEST_WX_IS_SNOW | 0.0235 | ✓ |
| 13 | TAIL_LEGS_TODAY | 0.0233 | |
| 14 | OP_UNIQUE_CARRIER | 0.0224 | |
| 15 | DEP_HOUR | 0.0222 | |

Six of the top 15 are weather features, and weather takes **35.7%** of total importance. **High
importance alongside zero test gain** means the trees split on weather to fit the training
period (January snow, April and early-July storms) in ways that do not carry over to late July.
Importance shows that the model used a feature, not that the feature helped.

Ablation (Variant B):

| Config | AUC | Δ AUC | p@1% | Δ p@1% |
|---|---|---|---|---|
| Baseline | 0.6924 | — | 0.781 | — |
| Origin weather only | 0.6916 | −0.0008 | 0.771 | −0.010 |
| Destination weather only | 0.6881 | −0.0043 | 0.761 | −0.020 |
| Both | 0.6910 | −0.0014 | 0.759 | −0.022 |

Origin weather is roughly neutral. Destination weather 3 h before departure is the larger drag,
which makes sense: it predates the arrival it is meant to describe by the flight time plus 3 h.

**By season:** the test split spans only July (07-19 → 07-31), so AUC by month cannot be
computed. As the closest substitute, the test set was segmented by the weather the honest model
could see:

| Segment (Variant B conditions) | Flights | Delay rate | AUC baseline | AUC B | Δ |
|---|---|---|---|---|---|
| All test flights | 223,101 | 0.156 | 0.6924 | 0.6910 | −0.0014 |
| Origin thunder 3 h before | 2,373 | 0.319 | 0.6873 | 0.6924 | +0.0051 |
| Origin IFR 3 h before | 6,048 | 0.153 | 0.7064 | 0.7097 | +0.0033 |
| Origin precip > 0 3 h before | 9,826 | 0.232 | 0.7030 | 0.7099 | +0.0069 |
| Destination thunder 3 h before | 2,554 | 0.279 | 0.6774 | 0.6800 | +0.0027 |
| No adverse weather at either end | 198,889 | 0.151 | 0.6895 | 0.6852 | −0.0043 |

Weather helps a little on the roughly 4–5% of flights where adverse weather is already visible 3
hours out. It costs more on the 89% where it is not, so overall the net is negative. The
segments are small, so the positive deltas are suggestive, not established.

## W8. Recommendation: **keep as a documented experiment. Do not promote.**

Rule: promote if B improves AUC by ≥ 0.005 **and** does not reduce p@1% by more than 0.01.

- Δ AUC = **−0.0014**, against a requirement of ≥ +0.005. **Fails.**
- Δ p@1% = **−0.022**, against a limit of ≥ −0.010. **Fails.**

Variant B fails both conditions. The candidate remains in `results/candidates/weather_b/`:

- `xgb.json`, `hgb.joblib` and `lgbm.txt` (the three blend components)
- `config.json` (ordered feature names, category levels, weather definition, metrics)
- `comparison.csv`, `ablation_origin_dest.csv`, `feature_importance.csv` and
  `weather_segments.csv`

A reload of the saved components reproduces the in-memory blend exactly (max diff 0.0).

The production limitation "No weather features are integrated"
(`api/performance_data.py`) is now better stated as: *"Weather was tested. Observations available
3 h before departure did not improve the model (AUC −0.0014). A perfect forecast would be worth
+0.009 AUC and +4.5 points of p@1%, so a forecast product is the open lever."* That wording
change has **not** been made.

Possible follow-ups if weather is revisited:

1. Archived TAF forecasts valid at the departure hour. This is the deployable version of
   Variant A.
2. A shorter lead time, such as 1 h, if the briefing can run later.
3. Weather features restricted to a "storm present" gate rather than continuous values, given
   that the segment table shows gains only in adverse conditions.

## W9. API changes needed for promotion

Not applicable, because promotion is not recommended. No API file was changed.

For the record, serving any weather model would also need something the API does not have at
all: a **live METAR/TAF ingestion feed**. The API currently serves historical flights from the
training parquet only.

## Files created

- `fdpis_7_weather.ipynb`: new notebook, fully executed.
- `data/weather/`:
  - `raw/{IATA}.csv` and `.meta` (345 stations)
  - `station_manifest.csv`
  - `missing_rates.csv`
  - `weather_features.parquet` (1,718,426 rows; keys `FL_DATE, OP_UNIQUE_CARRIER,
    OP_CARRIER_FL_NUM, ORIGIN, DEST`; 20 features × suffix `_A`/`_B`)
- `results/candidates/weather_b/`: the candidate, as listed in W8.
- Package added to the `fdpis` conda env: `airportsdata`.

---

# LAYER 5 AND CREW ALERTS

Built 2026-10-16. Layer 5 (the recommendation engine) is now a backend service in
`api/layer5/`, and it replaces the client-side TypeScript rules. The old rules came from
planning documents, were never checked against a regulation, and applied DGCA-style
thresholds to US data.

**Layers 3 and 4 are unchanged.** `api/propagation.py`, `models.py`, `features.py` and
`config.py` were not modified, and `api/test_parity.py` still passes (see L5.5).

| Component | File | Purpose |
|---|---|---|
| Rule profiles | `api/layer5/rules/faa_part117.json`, `dgca_fdtl.json` | Every threshold, with citation and `verified` flag |
| Engine | `api/layer5/engine.py` | Loads a profile, evaluates rules, assigns alert ids |
| Crew proxy | `api/layer5/crew.py` | Duty projection, FDP / rest limits, action deadlines |
| Day feed | `api/layer5/feed.py` | Batched propagation for every aircraft of a day |
| Outbox | `api/layer5/notify.py` | **Simulated** crew notifications |
| Time zones | `api/layer5/tz.py` | Converts local BTS times to UTC (via `airportsdata`) |
| Tests | `api/layer5/test_rules.py` | 24 tests, stdlib `unittest` |

New endpoints:

- `GET /api/rules`
- `POST /api/recommendations`
- `GET /api/alerts`
- `POST /api/alerts/{id}/notify`
- `GET /api/notifications`

New and changed frontend pieces:

- **New page:** `/alerts`, added to the nav.
- **Rewritten:** `RecommendationPanel` now calls `POST /api/recommendations`, has an FAA/DGCA
  switcher and shows the disclosure banner.
- **Updated:** the /performance page has a weather section.

## L5.1 Rules implemented

How sources were obtained:

- **US text.** The eCFR website redirects automated clients to a block page, so the US text
  came from the official **eCFR versioner API**. That API returns the same regulatory text
  (14 CFR, up to date as of 2026-10-13).
- **DGCA text.** Fetched from the official dgca.gov.in digigov portal.
- **Rev 2 of the DGCA FDTL CAR.** This was only available as a third-party mirror. A text diff
  against the official Rev 1 shows the only substantive change is para 2.2 (it drops the
  01 June 2024 deadline). Every numeric limit below is identical in both versions and is cited
  from the official Rev 1.

**Every rule below was read in primary text: `verified: true`.**

### FAA profile (`faa_part117`)

| Rule id | Threshold | Comparator | Source |
|---|---|---|---|
| `crew_fdp_limit` | Table B, encoded as the full table: 10 report-time rows × 1–7+ segments, 9 h to 14 h (e.g. 0700–1159 → 14/14/13/13/12.5/12/11.5 h) | FDP > limit | 14 CFR 117.13(a) and Table B to Part 117 |
| `crew_fdp_extension_limit` | Table B + 120 min | FDP > limit + 2 h | 14 CFR 117.19(a)(1) |
| `crew_flight_time_limit` | Table A: 8 h (report 0000–0459 and 2000–2359), 9 h (0500–1959) | block > limit | 14 CFR 117.11(a)(1) and Table A |
| `crew_min_rest` | 600 min | rest < 10 h | 14 CFR 117.25(e) |
| `pax_dot_significant_delay` | 180 min arrival delay | ≥ 3 h | 14 CFR 260.2, "Significantly delayed or changed flight" (2) |

### DGCA profile (`dgca_fdtl`)

| Rule id | Threshold | Comparator | Source |
|---|---|---|---|
| `crew_fdp_limit` | 1–2 landings 13:00; 3 → 12:30; 4 → 12:00; 5 → 11:30; 6 → 11:00; >6 not permitted. Night duty (encroaching 00:00–06:00): 10:00 with at most 2 landings | FDP > limit, or landings > cap | CAR 7-J-III Rev 1, para 6.1 (6.1.1, 6.1.2, 6.1.4), Notes 1–2, para 3.11 |
| `crew_fdp_extension_limit` | limit + 120 min | > | para 16.1(b) |
| `crew_duty_period_limit` | FDP limit + 60 min (duty includes the post-flight allowance) | > | para 6.2 |
| `crew_flight_time_limit` | 9 h (≤2 landings), 8 h (3–6 landings or night) | block > limit | para 6.1.1, 6.1.2, 6.1.4 |
| `crew_min_rest` | max(12 h, preceding duty) | rest < | para 10.1(a), (b)(i) |
| `pax_meals_refreshments` | 2 h (block ≤ 2.5 h), 3 h (2.5–5 h), 4 h (> 5 h) departure delay | ≥ | CAR 3-M-IV Rev 4, para 3.4.1, 3.8.1(a) |
| `pax_alternate_or_refund` | 360 min | > 6 h | CAR 3-M-IV Rev 4, para 3.4.2 |
| `pax_hotel_accommodation` | 1440 min, or 360 min if the scheduled departure is 20:00–03:00 | > | CAR 3-M-IV Rev 4, para 3.4.3, 3.8.1(b) |

**Comparators follow the regulation's wording.**

- "will exceed" and "more than" are strict (`gt`). An FDP exactly at the Table B limit is
  legal, and a delay of exactly 6 h does not trigger 3.4.2.
- "X or more" is inclusive (`gte`): DOT's "three or more hours" and DGCA's "2 hours or more".

**Proxy parameters (assumptions, not rules).**

| Parameter | Value | What the regulation says |
|---|---|---|
| Report buffer | 60 min | **Verified that neither regime fixes it.** 14 CFR 117.3 defines report time as "the time that the certificate holder requires". DGCA para 3.14 and 4.1.1 leave it to the operator's approved Scheme. |
| Post-flight buffer | 15 min | DGCA para 4.1.2 requires an allowance but leaves its length to the operator. |
| Standby call-out lead time | 90 min | Not regulatory: a carrier reserve-scheme value. It is the **only `verified: false` item** in either profile, and the UI names it. |

## L5.2 Rules searched for but not found, or not encoded

| Item | Outcome |
|---|---|
| DGCA FDTL revisions after Rev 2 (the 2025 phased implementation dates, operator-specific exemptions) | **Not found in primary text.** Only news and blog sources describe them, and they disagree with each other on the night-landing change. Not encoded. Under Rev 2 para 2.2, operators may stay on Issue III (2019) until DGCA approves their new scheme, so which scheme a given airline flies under cannot be known from public data. |
| US federal requirement for meals or hotels during gate delays | Not found in the text reviewed (14 CFR 259.4, Part 260). Part 259 was not reviewed in full. Nothing encoded. |
| 14 CFR 259.4 tarmac-delay rules (3 h deplaning, food and water by 2 h) | Found and verified, but **not applicable**: the model predicts gate departure delay, not time on the tarmac. |
| Cumulative limits (117.23; DGCA para 8), weekly rest (117.25(b); DGCA 10.6), consecutive nights (DGCA 13), extension caps over 28 days (DGCA 16.1(d)) | Verified in text but **not encodable**: they need individual crew history. |
| DGCA WOCL reduction (Note 2 to para 7) | Not encoded. The note cites para 6.1.3 and 7.1 (night beyond the acclimatized zone, and augmented crews), and neither applies to domestic two-pilot days. |
| Split duty (117.15; DGCA 9), augmented crews (117.17 / Table C; DGCA 7), reserve (117.21) | Not observable from schedule data. |

## L5.3 The crew proxy as implemented

Airlines do not publish rosters, so `crew.py` projects a **hypothetical** crew. Every alert, API
response and UI surface states this, using the required wording. Assumptions:

1. One crew stays with one aircraft for its whole operating day (`TAIL_NUM` × `FL_DATE`).
2. Report time = first leg's scheduled departure − 60 min (configurable per profile).
3. The FDP ends at the last leg's **predicted block-in**.
   - Under 14 CFR 117.3 the FDP "ends when the aircraft is parked". The post-flight buffer
     (15 min) is therefore **not** added to the FDP compared with Table B.
   - The buffer is added to the duty end, which drives rest (117.25(e)) and the DGCA
     para 6.2 duty-period limit.
4. All times are converted to UTC through each airport's IANA time zone before any duration is
   taken. Scheduled block-in = departure + `CRS_ELAPSED_TIME`. This avoids the `CRS_ARR_TIME`
   rollover artifacts the audit found in 1.76% of rows. A test confirms that an ATL→DEN→LAX
   day is measured in elapsed time, not by subtracting local clock times.
5. Predicted delays come from Layer 4:
   - A hop's departure delay is `total_delay` (median) or `interval_high` (upper bound).
   - Its arrival delay is that value × the recovery rate (0.895), the same step
     `propagation.traverse` uses to seed the next hop.
6. The crew is acclimated to the first departure airport's zone, so the 117.13(b) −30 min does
   not apply.
7. The Table B row is chosen from the report time in that zone, and the column from the number
   of scheduled segments. DGCA night duty is tested on the **projected** duty window, so a delay
   that pushes duty past midnight changes the limit itself.
8. **`proxy_not_applicable` is a refusal, not an alert.** It applies when the *scheduled* day
   already breaks a single-crew limit (FDP, landings or flight time). In that case the operator
   must swap crews mid-day, the proxy cannot see where, and no alert is raised.
9. **`breached_at_seed`.** If a limit is already crossed on the seed leg (the leg whose delay
   was observed), that is history, not a prediction. No alert is raised.
10. Rest uses the same aircraft's first report on the next date, when that date is in the
    dataset. If even the **scheduled** overnight is below minimum rest, the next morning must
    be a different crew, so the rest rule is skipped.
11. **Action deadline (FDP and duty rules).** It is the predicted departure of the first leg
    whose projected block-in crosses the limit, minus the 90-min call-out. It is shown in local
    time at that leg's origin, where the standby crew reports.
12. **Action deadline (rest rule).** It is the next report time minus the call-out.
13. **Confidence boundary.** If the day's last leg is past depth 2, it has no number, so crew
    rules can only return MONITOR. They do so only when the deepest *quantified* upstream delay
    would cross the limit, and the MONITOR alert carries no predicted value.

Feed seeding (`GET /api/alerts`): each aircraft is seeded at its first leg with recorded arrival
delay ≥ 15 min (notebook 5's cascade-origin rule) and propagated from there. Aircraft with no
such leg are projected on schedule.

**Performance.** `propagation.traverse` costs about 200 ms per call because it filters the
1.7M-row frame, so a 2,350-chain day would take about 8 minutes. `feed.traverse_many` runs the
same per-hop computation for every seed of a day at once, reusing `predict_hop` and
`expected_primary` unchanged. A full day now takes **3.4 s (FAA) / 4.9 s (DGCA)**.

## L5.4 Tests: 24 of 24 pass

```
conda run -n fdpis python -m unittest api.layer5.test_rules -v
Ran 24 tests in 20.7s
OK
```

Coverage against the brief:

| Required case | How it is tested |
|---|---|
| Just below threshold → no alert | Every passenger rule in both profiles, at threshold − 0.01 min |
| Exactly at threshold → alert | Every passenger rule. `gte` rules alert **at** the threshold. `gt` rules ("more than", "will exceed") correctly do **not**, and alert at +0.01 min. Crew FDP tested both ways: FDP = limit is legal, limit + 0.01 alerts. |
| Median below, upper bound above → POSSIBLE | Every passenger rule, and crew FDP in both profiles |
| Depth 3+ → MONITOR only | Every passenger rule at depths 3, 4, 5. Nothing is raised with no upstream trigger, and only MONITOR (with no value) when one exists. Crew rules with an unquantified last leg. A sweep of 4 delay sizes × 2 profiles asserts that no LIKELY or POSSIBLE appears past depth 2. |
| Crew proxy, duty clearly fine | 8 h day, small delays → status `ok`, no alerts (both profiles) |
| 90-min delay on leg 2 pushes the last leg over the FDP limit | Schedule 60 min under the limit (FAA 13 h, DGCA 12 h). The 90-min delay gives LIKELY `crew_fdp_limit` at exactly limit + 30 min; breach leg 4; correct deadline; no extension alert. |

The extra tests cover:

- Table B coverage of every minute of the day, and spot values against the CFR.
- The DGCA by-landings and night-duty limits.
- A delay into night lowering the DGCA limit from 13 h to 10 h.
- FAA and DGCA rest thresholds.
- Skipping the rest rule when the overnight is already too short.
- `proxy_not_applicable` and `breached_at_seed`.
- Profile path traversal.
- **Batch parity:** `traverse_many` equals `propagation.traverse` exactly on every hop field
  (40 random seeds on 2025-07-25).

## L5.5 Verification

| # | Check | Result |
|---|---|---|
| 1 | `/api/rules` returns both profiles with sources | **PASS.** FAA has 5 rules, DGCA 8. Every rule has a URL and `verified: true`. `unverified.assumptions = [standby_callout_minutes]` for both. |
| 2 | `POST /api/recommendations` is consistent with the propagation numbers | **PASS.** 5 at-risk aircraft were taken from the feed and rerun as single chains. The feed value, the recommendation value, and an independent recomputation (scheduled FDP + last hop `total_delay` × 0.8952) agree to 0.1 min in every case (e.g. N8714Q: 729.0 / 729.0 / 729.0 against a 720 limit). |
| 3 | /alerts renders a real day's alerts | **PASS.** Production build served by `next start` and rendered in headless Chrome: 2025-07-31 shows 4,887 aircraft, 64 crews flagged, 39 LIKELY / 21 POSSIBLE / 12 MONITOR, disclosure banner present, MONITOR rows show "no number". The cascade page panel was also rendered with backend alerts (N8714Q). |
| 4 | Switching profile changes the alerts | **PASS.** 2025-07-25: FAA flags 104 crews (84 L / 16 P / 22 M), DGCA flags 64 (58 / 18 / 18). The DGCA profile adds the para 6.2 duty-period and 3-M-IV passenger rules. |
| 5 | Depth 3+ never produces LIKELY or POSSIBLE | **PASS.** 536 alerts checked: 3 days × 2 profiles of full feeds, plus 60 random high-delay chains × 2 profiles. 42 alerts sat on depth-3+ legs; all 42 were MONITOR with no number. **0 violations.** |
| 6 | The old client-side threshold logic is gone | **PASS.** `grep -E 'TRIGGERS\|thresholdMin:\|leadTimeMin\|buildRecommendations\|minusMinutes\|triggeredAtHop'` over `fdpis-web/{lib,components,app}` finds only `thresholdMin`, the field that carries the backend's `threshold_minutes` into the UI. No rule, trigger or lead time remains in the browser. |
| 7 | `api/test_parity.py` still passes | **PASS.** Layer 3 max diff 0.0, Layer 4 max diff 0.004968 min (tolerance 0.01), constants match. |

Additions verified:

- **Notification outbox.**
  - `POST /api/alerts/{id}/notify` writes a record with `status: "SIMULATED — not sent"`, a role
    as the recipient and the specified message format. Example: *"Standby crew SLC: report by
    11:01 local. Projected FDP exceedance on N8714Q leg 3 (SLC-HOU) under FAA Part 117. Ref
    alert #98."*
  - Rest alerts address *"Operating crew, tail …"* via crew app push.
  - An unknown id returns 404. A passenger alert returns 422, because only crew alerts notify
    crew.
  - The UI enables **Notify crew** only after **Acknowledge**, and the Outbox tab is headed
    "SIMULATED OUTBOX".
- **Weather limitation.**
  - `api/performance_data.py` now carries the new limitation text.
  - A `weather` block is read directly from `results/candidates/weather_b/comparison.csv`, not
    copied, so it cannot drift from the experiment.
  - /performance shows the three-row comparison, with Variant A labelled "upper bound — not
    deployable".
- **Frontend checks.** `tsc --noEmit` and `next build` are clean.

## L5.6 Sample day: 2025-07-25 (4,908 aircraft; 3,240 have a leg arriving 15+ min late)

| | FAA Part 117 | DGCA FDTL |
|---|---|---|
| **Crews flagged** | **104** | **64** |
| LIKELY / POSSIBLE / MONITOR | 84 / 16 / 22 | 58 / 18 / 18 |
| FDP limit (L / P / M) | 33 / 6 / 15 | 23 / 7 / 10 |
| FDP + max extension, i.e. crew change mandatory (L / P / M) | 5 / 4 / 1 | 5 / 1 / 1 |
| Duty-period limit (DGCA only) (L / P / M) | — | 8 / 8 / 5 |
| Minimum rest before next day (L / P / M) | 46 / 6 / 6 | 22 / 2 / 2 |
| Rotations `proxy_not_applicable` | 4,003 (82%) | 4,206 (86%) |
| Rotations `breached_at_seed` | 25 | 29 |
| Rotations within limits | 776 | 609 |

Median FDP exceedance for an FDP alert: 25 min.

**The headline finding is the 82–86%, not the 104.** On most US aircraft-days the *scheduled*
day (for example N700UW: 8 legs, 20 h from report to block-in, against a 9 h Table B limit)
already exceeds what one crew may legally fly. So the airline necessarily swaps crews mid-day,
and the one-crew-per-aircraft proxy says nothing about those days. The engine refuses rather
than guesses.

The alerts it does raise come from shorter rotations (2–5 legs), where one crew plausibly
operates the whole day. Even there, real crews often swap. **Real roster data is the single
change that would turn this from a risk indicator into an operational tool.**

## L5.7 What surprised me, and what I had to interpret

1. **The FAA FDP depends on report time, not just duty length.** Table B ranges from 9 h
   (report 00:00–03:59) to 14 h (07:00–11:59), and drops by up to 2.5 h with segment count. A
   single "crew duty limit" number would have been wrong for most of the day.
2. **The DGCA limit depends on landings and on night duty, and a delay can change the limit
   itself.** Any duty touching 00:00–06:00 is capped at 10 h and 2 landings. So a late evening
   delay can turn a legal 13 h, 2-landing day into a 10 h day that is already over.
3. **Neither regime fixes the report buffer.** It is carrier-defined in both (117.3; DGCA 3.14
   and 4.1.1), so the 60 min is an assumption and is labelled as one. DGCA does *require* a
   post-flight allowance (4.1.2) but leaves its length to the operator.
4. **"Exceed" vs "or more".** Part 117 and the DGCA delay paragraphs mostly say "exceed" or
   "more than" (strict), but DGCA meals and DOT 260 say "or more" (inclusive). The brief's
   "exactly at threshold → alert" test is implemented per rule: it alerts at the threshold only
   where the regulation is inclusive.
5. **DGCA para 6.1.3 is not a domestic rule.** The table row (10 h flight time, 13:00, 1
   landing) applies, per Note 1, only to night duty beyond the acclimatized zone. Domestic
   single-landing days use 6.1.2.
6. **DGCA para 16 Note 1 is ambiguous.** It reads "Provisions of only para 8.1 to 8.4 can be
   extended by the limits specified in 16.1(a) and 16.1(b)", and para 8 is the *cumulative*
   table. Read literally, that would restrict what 16.1 can extend. I followed 16.1's plain
   wording (the "FDP may be extended by maximum of 02 hours") and flagged the ambiguity in the
   rule notes.
7. **The DGCA meal threshold's "2 ½ hrs".** The ½ glyph does not survive PDF text extraction.
   2.5 h is read from the visible structure ("up to 2 [glyph] hrs ... more than 2 [glyph] hrs
   and up to 5 hours").
8. **The DGCA FDP table is scrambled by layout-mode text extraction.** It had to be read in PDF
   content-stream order. That was the only way to pair each FDP value with its landing count
   unambiguously.
9. **Passenger facilitation is a DGCA concept with no US federal equivalent for gate delays.**
   The closest US rule is DOT's refund entitlement for a ≥ 3 h arrival delay (14 CFR 260.2). It
   is DOT, not FAA, and is included and labelled as such.
10. **Not modelled.** Operators can delay crew report time when a delay is known in advance.
    The proxy reports at the scheduled time, so very large early delays look like FDP breaches
    the airline would avoid by rescheduling the report. The `breached_at_seed` status absorbs
    the most extreme of these.

## Files

New:

- `api/layer5/`: `__init__.py`, `engine.py`, `crew.py`, `feed.py`, `notify.py`, `tz.py`,
  `test_rules.py`, `rules/faa_part117.json`, `rules/dgca_fdtl.json`
- `fdpis-web/app/alerts/page.tsx`
- `fdpis-web/components/alerts/AlertsConsole.tsx`
- `fdpis-web/components/rules/RuleUi.tsx`

Modified:

- `api/main.py` (5 endpoints), `api/schemas.py` (Layer 5 models), `api/performance_data.py`
  (weather limitation and block), `api/requirements.txt` (+`airportsdata`), `api/README.md`
- `fdpis-web/lib/api/recommendations.ts` (rewritten as an API client),
  `lib/api/cascade.ts` / `index.ts` / `performance.ts`, `lib/types.ts`
- `components/cascade/RecommendationPanel.tsx` (rewritten), `CascadeExplorer.tsx`,
  `live/LiveConsole.tsx`, `Nav.tsx`, `app/performance/page.tsx`

Not modified: `api/propagation.py`, `models.py`, `features.py`, `config.py`, every notebook, and
every artifact in `results/`.

---

# LAYER 5 BACKTEST

Run 2026-10-16. Script: `api/layer5/backtest.py` (`conda run -n fdpis python -m api.layer5.backtest`,
279 s). All outputs are in `results/layer5/`.

**Dates: test split only, 2025-07-19 → 2025-07-31 (13 dates).** Layer 4 was trained on dates
≤ 2025-07-04, and its gate threshold was chosen on validation (2025-07-05 → 07-18).
Backtesting on training dates would be leakage. Nothing in this section was tuned on the test
dates.

**What "actual breach" means.** BTS records what the *aircraft* did, not what any crew did. An
"actual breach" therefore means the proxy crew's *actual* FDP (or duty, or rest) crossed the
limit. It does **not** mean a real crew went illegal: a real airline may well have swapped
crews. This backtest measures whether the engine predicts the quantity it claims to predict.
It cannot validate the crew proxy itself.

**How the backtest scores against the engine.**

- **Same code path.** It is built on `feed.evaluate_day`, the same function behind
  `GET /api/alerts`. It therefore scores exactly the alerts the API serves.
- **Mirror check.** An independent mirror of the engine's severity logic is checked against
  the engine on every rule-day. Result: **0 mismatches**.
  - The first run found 2 mismatches. Both were DGCA days where the engine tests the
    seed-leg crossing against the limit of whichever scenario fires. Night duty makes that
    limit differ between the median and the upper scenario.
  - The mirror was fixed to match the engine, and the full run repeated.

**Actual-outcome definitions.**

- Report time = first scheduled departure − 60 min, the same as the proxy.
- Actual block-in = the last leg's scheduled departure (UTC, via `api/layer5/tz.py`) +
  `CRS_ELAPSED_TIME` + `ARR_DELAY`. `ARR_TIME` clock values are not used.
- Limits are re-selected from the actual duty window: the Table B row, and DGCA night duty and
  landings.
- Rest = the next day's scheduled report time − (actual block-in + 15 min).

**Exclusions.** Three groups of rule-days are kept out of the scoring.

- **Seed-leg crossings.** These rule-days are excluded from *every* method's table, because
  the limit was already crossed on the observed seed leg (hindsight). Counts: FAA 266,
  DGCA 275.
- **Cancellations.** Joined from `data/cancelled.parquet` on tail + date. A crew with a leg
  cancelled after the seed goes to **CANCELLED_DOWNSTREAM**. That is 801 FAA / 570 DGCA
  applicable aircraft-days. 547 of the 4,905 test-split cancellations (11.2%) have no tail
  number and cannot be joined.
- **Unknown outcome.** The last leg diverted, so there is no `ARR_DELAY`.

**Hindsight already in the inputs.** Notebook 1 removes cancelled legs before it assigns
`LEG_NUM`, so every rotation the engine sees has already been told which legs flew. This
favours the engine slightly and cannot be undone without rebuilding notebook 1.

**Coverage, single-crew model, all test dates.**

| Profile | Aircraft-days | Applicable (`ok` + `at_risk`) | With a seed | `breached_at_seed` | `proxy_not_applicable` |
|---|---|---|---|---|---|
| FAA | 63,102 | 11,974 | 5,211 | 294 | 50,834 (81%) |
| DGCA | 63,102 | 9,628 | 3,916 | 232 | 53,242 (84%) |

## LB1. Part 1: alerts vs recorded outcomes

Single-crew model, all 13 test dates, per rule. Rows are engine severity; columns are the
actual outcome.

### FAA Part 117

| Rule | Severity | Actual breach | Actual no breach | Cancelled downstream | Unknown |
|---|---|---|---|---|---|
| **FDP limit** | LIKELY | 177 | 33 | 30 | 1 |
| | POSSIBLE | 45 | 73 | 13 | 1 |
| | MONITOR | 56 | 67 | 5 | 0 |
| | No alert | 195 | 10,247 | 723 | 141 |
| **FDP + max extension** | LIKELY | 22 | 2 | 8 | 0 |
| | POSSIBLE | 13 | 10 | 2 | 0 |
| | MONITOR | 4 | 4 | 0 | 0 |
| | No alert | 116 | 10,778 | 773 | 143 |
| **Minimum rest** | LIKELY | 358 | 18 | 41 | 0 |
| | POSSIBLE | 15 | 27 | 4 | 1 |
| | MONITOR | 20 | 19 | 1 | 0 |
| | No alert | 101 | 4,650 | 389 | 85 |

### DGCA FDTL

| Rule | Severity | Actual breach | Actual no breach | Cancelled downstream | Unknown |
|---|---|---|---|---|---|
| **FDP limit** | LIKELY | 173 | 29 | 11 | 3 |
| | POSSIBLE | 37 | 55 | 6 | 0 |
| | MONITOR | 39 | 31 | 2 | 0 |
| | No alert | 136 | 8,346 | 536 | 111 |
| **FDP + max extension** | LIKELY | 36 | 3 | 4 | 0 |
| | POSSIBLE | 8 | 12 | 1 | 0 |
| | MONITOR | 6 | 6 | 0 | 0 |
| | No alert | 77 | 8,737 | 555 | 114 |
| **Duty-period limit** | LIKELY | 80 | 8 | 7 | 0 |
| | POSSIBLE | 32 | 35 | 6 | 0 |
| | MONITOR | 18 | 11 | 1 | 0 |
| | No alert | 117 | 8,561 | 545 | 114 |
| **Minimum rest** | LIKELY | 202 | 12 | 27 | 1 |
| | POSSIBLE | 12 | 9 | 0 | 0 |
| | MONITOR | 8 | 6 | 0 | 0 |
| | No alert | 37 | 3,134 | 244 | 63 |

### Headline metrics

Precision excludes cancelled-downstream and unknown outcomes. Recall is the share of actual
breaches (among applicable rule-days) that received any alert.

| Profile | Rule | LIKELY precision | LIKELY + POSSIBLE precision | Recall (any alert) | Recall (LIKELY) | Base rate |
|---|---|---|---|---|---|---|
| FAA | FDP limit | **0.843** | 0.677 | 0.588 | 0.374 | 0.043 |
| FAA | FDP + extension | 0.917 | 0.745 | 0.252 | 0.142 | 0.014 |
| FAA | Minimum rest | **0.952** | 0.892 | 0.796 | 0.725 | 0.095 |
| DGCA | FDP limit | **0.856** | 0.714 | 0.647 | 0.449 | 0.044 |
| DGCA | FDP + extension | 0.923 | 0.746 | 0.394 | 0.283 | 0.014 |
| DGCA | Duty period | 0.909 | 0.723 | 0.526 | 0.324 | 0.028 |
| DGCA | Minimum rest | **0.944** | 0.911 | 0.857 | 0.780 | 0.076 |

### Base-rate comparison: the naive rule

The naive rule alerts whenever scheduled FDP + seed arrival delay > limit: the seed delay is
carried to the last leg with no absorption and no model. It was scored on the same rows. On
its own it reaches higher recall at lower precision. For example, FAA FDP limit: precision
0.562, recall 0.619; the engine's LIKELY + POSSIBLE reaches 0.677 at 0.588. That is not equal
recall, so `naive_comparison.csv` matches recall in both directions on identical rows. These
rows are applicable, seeded, outcome known, not cancelled, and have an engine number for the
last leg.

| Profile | Rule | Engine L+P precision @ its recall | Naive precision @ the same recall | Naive precision @ its own recall | Engine precision @ that recall | Average precision, engine / naive |
|---|---|---|---|---|---|---|
| FAA | FDP limit | **0.677** @ 0.590 | 0.610 | 0.580 @ 0.638 | 0.505 | **0.673** / 0.533 |
| FAA | FDP + ext. | **0.745** @ 0.273 | 0.432 | 0.449 @ 0.375 | 0.390 | **0.383** / 0.269 |
| FAA | Min. rest | **0.892** @ 0.840 | 0.865 | 0.858 @ 0.860 | 0.789 | **0.923** / 0.863 |
| DGCA | FDP limit | **0.714** @ 0.636 | 0.662 | 0.622 @ 0.694 | 0.492 | **0.643** / 0.594 |
| DGCA | FDP + ext. | **0.746** @ 0.396 | 0.449 | 0.438 @ 0.505 | 0.262 | **0.437** / 0.307 |
| DGCA | Duty period | **0.723** @ 0.523 | 0.605 | 0.558 @ 0.603 | 0.392 | **0.600** / 0.468 |
| DGCA | Min. rest | **0.911** @ 0.870 | 0.873 | 0.867 @ 0.898 | 0.792 | **0.939** / 0.886 |

Stated plainly:

- **At the engine's deployed operating point, the model-based alerts beat the naive rule on
  all 7 rules.** The naive rule tuned to the same recall is 3–31 points less precise, and the
  engine's average precision is higher for every rule.
- **But the curves cross.** If you need the naive rule's higher recall, the naive rule is the
  better instrument on **all 7 rules**. The engine's median projection under-predicts a tail
  of breaches where the delay did not get absorbed. To catch those, it would have to alert on
  many more rule-days than the naive rule needs.
- **Layers 3–4 therefore add precision at moderate recall. They do not add recall.** They do
  not "add nothing", but the gain is narrower than the headline precision suggests: 2.6–7
  points of precision at the deployed point for FDP and rest, and more for the extension and
  duty rules.

### Cancellation test

Downstream-cancellation rate on applicable seeded days, flagged (any crew alert) vs unflagged,
stratified by seed arrival delay.

| Profile | Seed delay | Flagged: days / cancelled / rate | Unflagged: days / cancelled / rate |
|---|---|---|---|
| FAA | 15–60 min | 319 / 31 / **9.7%** | 2,723 / 203 / 7.5% |
| FAA | 60–120 min | 190 / 10 / 5.3% | 905 / 52 / 5.7% |
| FAA | 120+ min | 428 / 48 / **11.2%** | 646 / 28 / 4.3% |
| DGCA | 15–60 min | 209 / 15 / 7.2% | 2,025 / 134 / 6.6% |
| DGCA | 60–120 min | 129 / 9 / 7.0% | 743 / 38 / 5.1% |
| DGCA | 120+ min | 315 / 23 / 7.3% | 495 / 24 / 4.8% |

- Flagged days are cancelled downstream more often in 5 of 6 strata. The clearest case is FAA
  120+: 11.2% vs 4.3%, 2.6×, among days with the same seed-delay band.
- The counts are small (tens of cancellations per cell) and no significance test was run. The
  60–120 min FAA band shows no difference.
- **Read this as weak, consistent support** for the claim that flagged crews are the ones
  airlines end up cancelling around, not as proof.

## LB2. Part 2: lead time

For each alert, `usable_lead_min` = action deadline − the seed leg's **actual** arrival (both
UTC). The actual arrival is the moment the ≥ 15 min delay that triggers the chain becomes
known. Single-crew model, all test dates.

| Profile | Rule | Alerts | Min | p10 | Median | p90 | Lead ≤ 0 |
|---|---|---|---|---|---|---|---|
| FAA | FDP limit | 501 | −287 | −43 | 97 | 310 | **204 (41%)** |
| FAA | FDP + extension | 65 | −337 | −72 | −27 | 155 | **45 (69%)** |
| FAA | Minimum rest | 504 | −773 | 266 | 508 | 923 | 28 (6%) |
| FAA | **All crew rules** | 1,070 | −773 | −42 | **270** | 724 | **277 (26%)** |
| DGCA | FDP limit | 386 | −82 | −44 | 60 | 270 | **167 (43%)** |
| DGCA | FDP + extension | 76 | −287 | −53 | −23 | 191 | **47 (62%)** |
| DGCA | Duty period | 198 | −82 | −45 | −2 | 259 | **100 (51%)** |
| DGCA | Minimum rest | 277 | −245 | 205 | 617 | 958 | 21 (8%) |
| DGCA | **All crew rules** | 937 | −287 | −44 | **131** | 675 | **335 (36%)** |

**Why FDP alerts are late.** Across 4 test dates (FAA), 63 of the 64 FDP-limit alerts whose
deadline had passed break on the **very next leg after the seed** (depth 1). By the time the
seed's arrival delay is known, that next leg is already within the 90-min standby call-out
window.

**Engine change: `deadline_passed` status.**

- Every alert now carries `usable_lead_minutes` and `status` (`actionable` or
  `deadline_passed`).
- `POST /api/alerts/{id}/notify` returns **422** for a `deadline_passed` alert, with the reason.
- `/alerts` still shows these rows. It replaces the buttons with "Deadline had passed when this
  fired (N min late)", and the recommendations panel says the same.
- Three unit tests were added (`DeadlinePassed`): lead-time arithmetic, the flag itself, and
  the notify refusal. Live check: notifying a passed alert returned 422 (lead −11.3 min); an
  actionable alert returned "SIMULATED — not sent".

### Actionable precision and recall

Counting only alerts whose deadline was still ahead when they fired:

| Profile | Rule | Actual breaches | LIKELY alerts → actionable | LIKELY precision (actionable) | Recall, actionable LIKELY+POSSIBLE | Recall, any actionable alert |
|---|---|---|---|---|---|---|
| FAA | FDP limit | 473 | 210 → **71** | 0.775 | **0.169** | 0.285 |
| FAA | FDP + extension | 155 | 24 → 2 | 1.000 | 0.039 | 0.058 |
| FAA | Minimum rest | 494 | 376 → 349 | 0.948 | **0.700** | 0.741 |
| DGCA | FDP limit | 385 | 202 → **77** | 0.714 | **0.192** | 0.291 |
| DGCA | FDP + extension | 127 | 39 → 5 | 0.800 | 0.063 | 0.110 |
| DGCA | Duty period | 247 | 88 → 19 | 0.737 | 0.130 | 0.202 |
| DGCA | Minimum rest | 259 | 214 → 194 | 0.938 | **0.749** | 0.780 |

## LB3. Part 3: is the severity label honest?

Observed breach rate inside each severity bucket (`severity_calibration.csv`):

| Profile | Rule | LIKELY | POSSIBLE | MONITOR | No alert |
|---|---|---|---|---|---|
| FAA | FDP limit | **0.843** | 0.381 | 0.455 | 0.019 |
| FAA | FDP + extension | **0.917** | 0.565 | 0.500 | 0.011 |
| FAA | Minimum rest | **0.952** | 0.357 | 0.513 | 0.021 |
| DGCA | FDP limit | **0.856** | 0.402 | 0.557 | 0.016 |
| DGCA | FDP + extension | **0.923** | 0.400 | 0.500 | 0.009 |
| DGCA | Duty period | **0.909** | 0.478 | 0.621 | 0.013 |
| DGCA | Minimum rest | **0.944** | 0.571 | 0.571 | 0.012 |

**LIKELY precision is ≥ 0.84 for every rule, above the 0.70 bar, so no recalibration is
required.** Two things are still wrong with the labels:

1. **MONITOR beats POSSIBLE in 5 of 7 rules.**
   - MONITOR fires only when a large *quantified* upstream delay is still in the chain past
     depth 2.
   - POSSIBLE fires when only the interval's upper bound crosses, and the upper bound
     (`hi + full primary`) is wide.
   - So "MONITOR" undersells real risk, and "POSSIBLE" oversells it.
2. **"LIKELY" is right, but the rule behind it is not what it claims.** The median crossing
   should breach about half the time. It breaches 84–95% of the time, because the
   interval/median is computed on departure delay while duty breaches come from the delay that
   persists.

**The proposed recalibration was computed anyway, for information, and was not applied.** It
has no tunable threshold, so nothing was chosen on test or validation dates. The proposal:

- LIKELY only if the interval **lower** bound crosses;
- median-only → POSSIBLE;
- upper-only → MONITOR.

| Profile | Rule | LIKELY: deployed → proposed precision (breaches) | POSSIBLE: deployed → proposed |
|---|---|---|---|
| FAA | FDP limit | 0.843 (177) → **0.982 (111)** | 0.381 → 0.680 |
| FAA | Minimum rest | 0.952 (358) → 0.985 (332) | 0.357 → 0.667 |
| DGCA | FDP limit | 0.856 (173) → **0.945 (104)** | 0.402 → 0.750 |
| DGCA | Duty period | 0.909 (80) → 0.962 (50) | 0.478 → 0.833 |

The proposal makes every label more honest: LIKELY ~95–98%, POSSIBLE ~67–83%, MONITOR
~42–55%. The cost is that LIKELY recall falls by about a third (FAA FDP 0.374 → 0.235). That is
a product choice about what "LIKELY" should promise. Because the deployed LIKELY already
clears 0.70, it is left as is.

## LB4. Part 4: inferred duty blocks (experimental, off by default)

Implemented as `crew_model = "single" | "inferred_blocks"` (default `single`).

- **Where it's exposed.** It is a query parameter on `GET /api/alerts`, and a "Crew model"
  selector on /alerts labelled experimental.
- **How days are split.**
  - `crew.infer_blocks` splits each aircraft-day into the minimum number of blocks that are
    legal on schedule under the active profile.
  - Splits are only allowed at ground stops of ≥ 30 min, at airports in the carrier's top-10
    origins by departures on the **training** dates.
  - Tie-break: the smallest spread (max − min) of block scheduled FDPs, then the earliest
    splits.
  - Each block gets its own report time and is evaluated as a crew.
- **Not evaluated for blocks.** The rest rule: there is no basis for pairing a block with
  tomorrow.
- **Labelling.** Every alert carries
  `duty_block.label = "inferred duty block — hypothetical, not a roster"`. The feed has
  `crew_model_label`, and the UI shows a banner plus "block i/n · inferred" on each row.
- **Tests.** Two unit tests: a legal split exists at a base, and no split exists without one.

### Coverage

| Profile | Date | Coverage: single | Coverage: inferred | Crews evaluated: single / inferred | Alerts (L / P / M): single | Alerts (L / P / M): inferred |
|---|---|---|---|---|---|---|
| FAA | 07-21 | 15.9% | **84.7%** | 778 / 8,065 | 37 / 8 / 15 | 52 / 45 / 50 |
| FAA | 07-25 | 18.4% | **84.4%** | 905 / 7,903 | 84 / 16 / 22 | 114 / 57 / 46 |
| FAA | 07-30 | 20.4% | **86.0%** | 979 / 7,708 | 43 / 12 / 8 | 42 / 32 / 26 |
| DGCA | 07-21 | 12.4% | **79.9%** | 605 / 8,852 | 49 / 8 / 5 | 121 / 64 / 104 |
| DGCA | 07-25 | 14.3% | **79.9%** | 702 / 8,690 | 58 / 18 / 18 | 248 / 115 / 106 |
| DGCA | 07-30 | 16.5% | **81.9%** | 790 / 8,459 | 41 / 20 / 10 | 109 / 71 / 69 |

### Backtest on the same 3 dates

| Profile | Rule | Model | LIKELY precision | L+P precision | Recall (any) | Actual breaches | Naive precision / recall |
|---|---|---|---|---|---|---|---|
| FAA | FDP limit | single | 0.804 | 0.699 | 0.619 | 105 | — |
| FAA | FDP limit | inferred | 0.798 | 0.617 | 0.519 | 455 | 0.491 / 0.565 |
| DGCA | FDP limit | single | 0.792 | 0.667 | 0.648 | 88 | — |
| DGCA | FDP limit | inferred | 0.814 | 0.650 | 0.507 | 720 | 0.544 / 0.629 |
| DGCA | Duty period | inferred | 0.942 | 0.742 | 0.472 | 400 | 0.534 / 0.512 |
| DGCA | FDP + extension | inferred | 0.958 | 0.826 | 0.368 | 193 | 0.477 / 0.435 |

**What this shows.**

- Inferred blocks raise coverage from 12–20% to 80–86% of aircraft-days.
- They keep LIKELY precision at the single-crew level (~0.80).
- They see 4–8× more actual breaches. Recall is somewhat lower, because there are more blocks
  whose breach leg is past the confidence boundary.

**What it does not show.** **The split points are invented.** Nothing in public data says
where any airline changed crews, so the blocks cannot be validated against rosters. The
backtest only shows that, *if* crews changed at those points, the engine would predict their
duty outcomes about as well as it does for single-crew days. That is the only real evidence
here.

## LB5. Part 5: rest-rule credibility

| Profile | Rest: LIKELY precision | Base rate | Naive precision @ its recall | Engine L+P @ same recall vs naive | Actionable recall | Median lead |
|---|---|---|---|---|---|---|
| FAA | **0.952** | 0.095 | 0.858 @ 0.860 | 0.892 vs 0.865 @ 0.840 | 0.700 | 508 min |
| DGCA | **0.944** | 0.076 | 0.867 @ 0.898 | 0.911 vs 0.873 @ 0.870 | 0.749 | 617 min |

Measured against the base rate, the rest rule is the strongest rule in the engine: 10–12× the
base rate, and better than naive at its operating point. It is also the **only rule with
usable lead time**. By the decision rule given, it is **not downgraded**.

The `max_severity` field that would downgrade a rule is implemented in the engine
(`crew.project_duty` caps the severity and says so in the alert detail) but is **not set on any
rule**.

**Why its numbers are so good, and why that should not be over-read.**

- It pairs today's last leg with the **same tail's** first report tomorrow, and the "actual
  outcome" uses that same pairing.
- So its precision measures how well the engine predicts *the aircraft's* evening finish
  against *the aircraft's* morning start. That is mostly arithmetic on an already-tight
  scheduled overnight.
- **It says nothing about whether one crew actually flies both.** In US operations that is
  uncommon, and nothing in public data can test it.
- The high precision is real for the quantity measured. The relevance of that quantity to any
  actual crew is the weakest assumption in Layer 5.

## LB6. Files

**Created.**

- `api/layer5/backtest.py`
- `results/layer5/` (new folder; nothing else in `results/` touched):
  - Requested: `backtest_faa.csv`, `backtest_dgca.csv`, `lead_time.csv`,
    `severity_calibration.csv`, `inferred_blocks_coverage.csv`
  - Supporting: `backtest_summary.csv`, `naive_comparison.csv`, `actionable_metrics.csv`,
    `lead_time_summary.csv`, `cancellation_test.csv`, `backtest_meta.csv`,
    `backtest_records.parquet`

**Changed (Python).**

- `api/layer5/crew.py`:
  - `usable_lead_min` and `deadline_passed` on alerts;
  - an interval-lower scenario;
  - `rest_evaluated`;
  - the optional `max_severity` cap;
  - `schedule_violations()`, factored out of `project_duty`;
  - `infer_blocks()`.
- `api/layer5/engine.py`:
  - lower bound carried from hops;
  - alert `status`, `usable_lead_minutes`, `crew_model`, `duty_block`;
  - `carrier_bases()` and `evaluate_crews()`.
- `api/layer5/feed.py`: `evaluate_day()` shared by the feed and the backtest; `crew_model`;
  coverage and deadline-passed counts.
- `api/layer5/notify.py`: refuses `deadline_passed`.
- `api/layer5/test_rules.py`: 29 tests, up from 24 (adds `DeadlinePassed` ×3 and
  `InferredBlocks` ×2).
- `api/main.py`: `crew_model` query parameter, validated with a 422.
- `api/schemas.py`: `DutyBlock`, plus the new `Alert` and `AlertFeed` fields.
- `api/performance_data.py`: a `layer5` block read from the CSVs.

**Changed (frontend).**

- `fdpis-web/lib/types.ts`, `lib/api/recommendations.ts`, `lib/api/performance.ts`
- `components/alerts/AlertsConsole.tsx`: crew-model selector, block labels, deadline-passed
  rows, coverage tile.
- `components/cascade/RecommendationPanel.tsx`: deadline-passed note.
- `app/performance/page.tsx`: Layer 5 backtest card.

**Not modified.** `api/propagation.py`, `models.py`, `features.py`, `config.py`, every
notebook, and every file in `results/` outside `results/layer5/`.

**Checks.**

- `api/layer5/test_rules.py`: 29/29 pass.
- `api/test_parity.py`: all three checks pass (Layer 3 diff 0.0, Layer 4 max diff 0.004968 min).
- `tsc --noEmit` and `next build` are clean.
- /alerts and /performance were rendered against the live API in headless Chrome.

## LB7. Verdict

**No, these alerts are not yet good enough to put in front of a crew scheduler. The single
number that decides it is actionable recall on flight-duty breaches: 17% (FAA) and 19% (DGCA).**

- When the engine says LIKELY, it is right 84–95% of the time, and it out-ranks a no-model
  rule at its own operating point. Precision is not the problem.
- The problem is timing. The alert only exists once the delayed seed leg has landed, and the
  leg that breaks the duty limit is usually the very next one. 41% of FDP alerts (FAA) arrive
  after the moment a standby crew would have needed calling.
- So of every six actual FDP breaches, the engine gives a scheduler a usable warning for about
  one.
- The minimum-rest alerts are the exception: 95% precise, 70–75% actionable recall, around
  8–10 hours of lead. But they rest on the least testable assumption in the system, that the
  same crew flies the same aircraft tomorrow.
- What would change the verdict is earlier information, not a better model: seeding on a known
  *departure* delay or an upstream estimated time instead of a recorded arrival. That, plus
  real roster data, would make this a scheduling tool rather than a risk indicator.

---

# LAYER 5 EARLY SEEDING

Run 2026-10-16. Follows **LAYER 5 BACKTEST**, which found that 41–43% of FDP-limit alerts
fired after their action deadline. The cause: the chain is seeded at the delayed leg's recorded
*arrival*, and the leg that breaks the limit is usually the next one.

**Outcome.**

- **Departure seeding is now the default** (`feed.DEFAULT_SEED_ON = "departure"`). It doubles
  actionable FDP recall with LIKELY precision ≥ 0.84 on every crew rule.
- **The proposed severity reordering was not applied.** It was chosen on validation dates and
  failed to hold on test.

## ES1. Departure seeding

**How it works.** `GET /api/alerts` gains `seed_on = "arrival" | "departure"` (422 on anything
else). `feed.select_seeds` implements both modes:

| | Arrival (previous default) | Departure (new default) |
|---|---|---|
| Seed leg | first leg with `ARR_DELAY` ≥ 15 | first leg with `DEP_DELAY` ≥ 15 |
| Seed arrival delay fed to Layer 4 | recorded `ARR_DELAY` | **`DEP_DELAY` × 0.8952** (the recovery rate `propagation.traverse` applies between hops) |
| Information time (lead measured from) | scheduled block-in + `ARR_DELAY` | **scheduled departure (UTC) + `DEP_DELAY`** |

- **The seed leg's recorded `ARR_DELAY` is never read in departure mode.** A unit test
  (`DepartureSeeding`) plants `ARR_DELAY = 999` and asserts:
  - the seed is the first `DEP_DELAY` ≥ 15 leg;
  - its inbound delay is 40 × 0.895;
  - its information time is 11:00 EDT + 40 min = 15:40 UTC.
- **Lead time.** `crew.project_duty` takes an explicit `info_time_utc`, and lead time is
  measured from it. A test covers this.
- **The naive rule is recomputed with the same departure seed**: scheduled FDP +
  `DEP_DELAY` × 0.8952 > limit. Both methods see the same information.

**Re-run.**

- Test dates 2025-07-19 → 07-31, both profiles, both seed modes, run in 439 s.
- Validation dates (07-05 → 07-18) were also run, in 312 s. Their records are used **only**
  to choose ES2's threshold.
- The engine/mirror check shows **0 mismatches** in all four runs.

**Different seeds, different breach counts.** The breach counts differ between modes because
seeding changes which aircraft-days are applicable. Departure seeding picks a different (often
earlier) seed leg on some aircraft, so the seed-leg-crossing exclusions also change.

### Test split: arrival vs departure seeding

| Profile | Rule | Seed | Actual breaches | LIKELY precision | Recall (any alert) | **Actionable recall (L+P)** | **Deadline passed** | Lead p10 / median / p90 (min) |
|---|---|---|---|---|---|---|---|---|
| FAA | FDP limit | arrival | 473 | 0.843 | 0.588 | 0.169 | 41% | −43 / 97 / 310 |
| FAA | FDP limit | **departure** | 540 | **0.849** | 0.467 | **0.376** | **0.7%** | 47 / 218 / 436 |
| FAA | FDP + extension | arrival | 155 | 0.917 | 0.252 | 0.039 | 69% | −72 / −27 / 155 |
| FAA | FDP + extension | **departure** | 162 | **0.882** | 0.142 | **0.130** | **6.7%** | 9 / 71 / 338 |
| FAA | Minimum rest | arrival | 494 | 0.952 | 0.796 | 0.700 | 5.6% | 266 / 508 / 923 |
| FAA | Minimum rest | **departure** | 484 | **0.906** | 0.707 | 0.647 | 3.1% | 367 / 644 / 1023 |
| FAA | **All crew rules** | arrival | 1,122 | 0.913 | 0.633 | 0.385 | 26% | −42 / 270 / 724 |
| FAA | **All crew rules** | **departure** | 1,186 | **0.885** | 0.520 | **0.453** | **2.1%** | 59 / 394 / 860 |
| DGCA | FDP limit | arrival | 385 | 0.856 | 0.647 | 0.192 | 43% | −44 / 60 / 270 |
| DGCA | FDP limit | **departure** | 427 | **0.840** | 0.492 | **0.412** | **0.9%** | 60 / 185 / 390 |
| DGCA | FDP + extension | arrival | 127 | 0.923 | 0.394 | 0.063 | 62% | −53 / −23 / 191 |
| DGCA | FDP + extension | **departure** | 136 | **0.857** | 0.279 | **0.235** | **3.4%** | 37 / 113 / 331 |
| DGCA | Duty period | arrival | 247 | 0.909 | 0.526 | 0.130 | 51% | −45 / −2 / 259 |
| DGCA | Duty period | **departure** | 262 | **0.885** | 0.397 | **0.336** | **3.7%** | 43 / 153 / 385 |
| DGCA | Minimum rest | arrival | 259 | 0.944 | 0.857 | 0.749 | 7.6% | 205 / 617 / 958 |
| DGCA | Minimum rest | **departure** | 254 | **0.929** | 0.744 | 0.681 | 4.1% | 242 / 755 / 1114 |
| DGCA | **All crew rules** | arrival | 1,018 | 0.904 | 0.639 | 0.303 | 36% | −44 / 131 / 675 |
| DGCA | **All crew rules** | **departure** | 1,079 | **0.884** | 0.501 | **0.435** | **2.6%** | 57 / 266 / 877 |

**What departure seeding does.**

- **The deadline-passed problem is essentially gone.** Late FDP alerts fall from 41–43% to
  under 1%.
- **Actionable recall for the duty-limit rules rises 2–3.5×:**
  - FAA FDP limit 0.169 → 0.376.
  - DGCA FDP limit 0.192 → 0.412.
  - DGCA duty period 0.130 → 0.336.
  - FDP + extension 0.039 → 0.130 (FAA) and 0.063 → 0.235 (DGCA).
- **The cost is total recall and some rest-rule performance.**
  - Recall counting *any* alert falls (FAA FDP 0.588 → 0.467). Many arrival-seeded alerts that
    were "caught" were caught too late to use.
  - The rest rule, which never had a timing problem, loses a little: actionable recall
    0.700 → 0.647 (FAA). It now relies on an estimated rather than recorded seed arrival.
- **LIKELY precision stays between 0.840 and 0.929 on every rule.**

### Naive-rule comparison: departure seeding, both methods on the same seed

| Profile | Rule | Engine L+P precision @ its recall | Naive @ same recall | Naive @ its own recall | Engine @ that recall | Avg. precision, engine / naive |
|---|---|---|---|---|---|---|
| FAA | FDP limit | **0.680** @ 0.49 | 0.636 | 0.596 @ 0.537 | **0.691** | **0.669** / 0.538 |
| FAA | FDP + ext. | **0.733** @ 0.13 | 0.361 | 0.429 @ 0.259 | **0.837** | **0.418** / 0.282 |
| FAA | Min. rest | **0.862** @ 0.78 | 0.836 | 0.819 @ 0.795 | **0.846** | **0.900** / 0.846 |
| DGCA | FDP limit | **0.688** @ 0.50 | 0.656 | 0.620 @ 0.572 | **0.652** | **0.618** / 0.556 |
| DGCA | FDP + ext. | **0.805** @ 0.28 | 0.434 | 0.447 @ 0.390 | **0.676** | **0.441** / 0.326 |
| DGCA | Duty period | **0.734** @ 0.35 | 0.599 | 0.571 @ 0.498 | 0.528 | **0.538** / 0.442 |
| DGCA | Min. rest | **0.897** @ 0.77 | 0.850 | 0.853 @ 0.784 | **0.889** | **0.915** / 0.869 |

**With departure seeding, the engine beats the naive rule in both directions on 6 of 7 rules.**

- It wins at its own operating point, and also at the naive rule's recall. Under arrival
  seeding it had lost at the naive rule's recall on all 7.
- The one exception is DGCA duty period at the naive rule's recall (0.528 vs 0.571).
- Average precision favours the engine on all 7.

The likely mechanism: with an earlier and smaller seed (DEP_DELAY × 0.895 rather than the full
recorded arrival delay), carrying the seed unchanged is a worse guess, while Layer 4's
absorption model is doing real work. Under departure seeding, Layers 3–4 add value over the
naive rule at every operating point except one.

## ES2. Severity ordering

### Why MONITOR breached more often than POSSIBLE

Validation dates, departure seeding:

| Profile | Severity | n | Breach rate | Median trigger margin over limit | Median seed delay | Median last-leg depth |
|---|---|---|---|---|---|---|
| FAA | LIKELY | 720 | 0.94 | +48 min (median) | 145 | 1 |
| FAA | POSSIBLE | 232 | 0.57 | **+8 min** (upper bound) | 70 | 1 |
| FAA | MONITOR | 143 | **0.60** | **+31 min** (carried) | 48 | 3 |
| DGCA | LIKELY | 687 | 0.92 | +75 min | 155 | 1 |
| DGCA | POSSIBLE | 327 | 0.57 | **+20 min** | 81 | 1 |
| DGCA | MONITOR | 123 | 0.55 | **+40 min** | 44 | 3 |

**The hypothesis was wrong.** MONITOR rows do **not** carry larger accumulated delays: their
seed delays are *smaller* (median 44–48 vs 70–81 min). What differs is the trigger.

- **MONITOR** fires only when the deepest *quantified* upstream delay — its interval upper
  bound, carried to the last leg with no further absorption — clears the limit. When it fires,
  it clears it by a median 31–40 min.
- **POSSIBLE** fires when only the upper bound crosses. The median sits 10–26 min *below* the
  limit, and half of these cases clear it by under 8–20 min.

So POSSIBLE is dominated by borderline cases, and MONITOR by clearer ones.

### Proposed fix, chosen on validation only

Two one-parameter families were scanned on validation (`severity_ordering_validation.csv`):

- **U:** demote a POSSIBLE alert to MONITOR when its upper bound crosses by less than U min.
  Grid 0–60.
- **T:** demote it when the median sits more than T min below the limit. Grid 0–120.

Selection rule, fixed before looking at test: **maximise the smaller of the two profiles'
(POSSIBLE − MONITOR) breach-rate gap.**

| Family | Threshold | DGCA P / M | FAA P / M | Min gap |
|---|---|---|---|---|
| U | 0 (deployed) | 0.569 / 0.553 | 0.569 / 0.601 | −0.032 |
| U | 5 | 0.613 / 0.492 | 0.580 / 0.583 | −0.003 |
| **U** | **10 (chosen)** | **0.613 / 0.514** | **0.644 / 0.557** | **+0.087** |
| U | 15 | 0.594 / 0.542 | 0.632 / 0.570 | +0.052 |
| U | 20 | 0.576 / 0.558 | 0.615 / 0.576 | +0.018 |
| T | best (20) | 0.650 / 0.524 | 0.585 / 0.578 | +0.007 |

The T family cannot fix FAA at any threshold.

### Test check: not applied

The condition for applying it was LIKELY ≥ 0.80 **and** strictly LIKELY > POSSIBLE > MONITOR,
both profiles, on test (`severity_ordering_test.csv`, departure seeding):

| Profile | Labels | LIKELY (n) | POSSIBLE (n) | MONITOR (n) | No alert | Monotone? |
|---|---|---|---|---|---|---|
| FAA | deployed | 0.885 (549) | 0.415 (159) | 0.455 (143) | 0.022 | no |
| FAA | U = 10 | 0.885 (549) | 0.408 (76) | 0.442 (226) | 0.022 | **no** |
| DGCA | deployed | 0.884 (458) | 0.471 (170) | 0.519 (108) | 0.018 | no |
| DGCA | U = 10 | 0.884 (458) | 0.436 (110) | 0.524 (168) | 0.018 | **no** |

**Not applied.**

- The ordering that held on validation does not survive test. POSSIBLE's own breach rate falls
  from about 0.57 on validation to 0.41–0.47 on test (a period shift).
- With 76–226 alerts per bucket, POSSIBLE and MONITOR are not statistically distinguishable at
  all.
- What *is* robust on both splits is the separation of three bands:
  - LIKELY (~0.88–0.94);
  - "watch" (POSSIBLE and MONITOR, ~0.41–0.60);
  - no alert (~0.02).

**Proposal, not applied.** Merge POSSIBLE and MONITOR into a single **WATCH** tier.

- It is monotone on both splits by construction, and needs no threshold.
- It is honest about what the data supports: the engine can tell "very likely" from "worth
  watching", but not two shades of "worth watching".
- It changes the alert vocabulary and the depth-3+ rule's wording ("MONITOR only"), so it is
  your decision, not mine.

## ES3. Default changed

Departure seeding gives higher actionable recall on every duty-limit rule, in both profiles,
with LIKELY precision ≥ 0.80 (lowest 0.840, DGCA FDP limit). By the stated condition,
**`seed_on = "departure"` is now the default** for `GET /api/alerts`.

- The feed's `summary.seed_rule` says so, and /alerts shows it.
- `seed_on=arrival` remains available.
- `POST /api/recommendations` is unchanged: its input is an operator-entered *arrival* delay.

Live check, 2025-07-25 FAA:

- 86 crews flagged (64 LIKELY / 14 POSSIBLE / 20 MONITOR), against 104 under arrival seeding.
- **2 deadline-passed alerts, down from 35.**

**What the earlier LAYER 5 BACKTEST verdict becomes.** Its deciding number — actionable recall
on FDP breaches — rises from 17% / 19% to **38% / 41%**. That is a real improvement, but
**still a minority of breaches**. The verdict softens from "a usable warning for one breach in
six" to "two in five". It is still not enough to rely on alone, and every crew alert still rests
on the one-crew-per-aircraft proxy.

## ES4. Files

**Changed (Python).**

- `api/layer5/feed.py`: `SEED_MODES`, `DEFAULT_SEED_ON = "departure"`, `select_seeds()`,
  `seed_rule_text()`; `seed_on` threaded through `evaluate_day` / `day_feed`.
- `api/layer5/crew.py`: `info_time_utc` on the projection; lead time measured from it.
- `api/layer5/engine.py`: `info_time_utc` passed through `evaluate_crews`.
- `api/layer5/backtest.py`:
  - both seed modes and the `seed_on` column;
  - the `validation` split mode;
  - `--severity-ordering`;
  - carried-trigger margin and last-leg depth in the records;
  - `build_tables()`.
- `api/layer5/test_rules.py`: 32 tests, up from 29 (adds `DepartureSeeding` ×3).
- `api/main.py`: the `seed_on` query parameter.
- `api/schemas.py`: `AlertFeed.seed_on`.
- `api/performance_data.py`: Layer 5 rows for both seed modes, plus the default.

**Changed (frontend).** `fdpis-web/lib/types.ts`, `lib/api/performance.ts`,
`app/performance/page.tsx`. The card shows default-mode rows and the arrival → departure
comparison, read from the CSVs.

**`results/layer5/`.**

- Regenerated: every CSV now carries `seed_on`.
- New:
  - `backtest_records_validation.parquet`
  - `lead_time_validation.csv`
  - `severity_ordering_validation.csv`
  - `severity_ordering_test.csv`

**Not modified.** `api/propagation.py`, `models.py`, `features.py`, `config.py`, notebooks, and
`results/` outside `results/layer5/`.

**Checks.**

- `api/layer5/test_rules.py`: 32/32 pass.
- `api/test_parity.py`: passes.
- `tsc --noEmit` and `next build` are clean.
- /performance was rendered against the live API.

---

# LAYER 5 WATCH TIER

Run 2026-10-16. Follows **LAYER 5 EARLY SEEDING** §ES2.

## WT1. POSSIBLE and MONITOR merged into WATCH

**How this was decided.** The merge was decided **after** the ES2 test check failed. ES2 had
chosen a threshold (U = 10 min) on validation dates to separate POSSIBLE from MONITOR, and the
ordering did not hold on test.

- With 76–226 alerts per bucket, the two tiers' breach rates (about 0.41–0.60) could not be
  told apart.
- The merge introduces **no threshold and no tunable parameter**. It relabels two existing
  buckets as one, so nothing was fitted to the test dates.
- U = 10 is **not** used anywhere in the engine.

**The new tiers.**

| Tier | When | Predicted value |
|---|---|---|
| **LIKELY** | the median prediction crosses the limit (unchanged) | yes |
| **WATCH**, `watch_reason = "upper_bound_only"` | only the interval upper bound crosses (was POSSIBLE) | yes, the upper bound |
| **WATCH**, `watch_reason = "beyond_depth_2"` | the last / affected leg is past the depth-2 confidence boundary, and a quantified upstream delay would cross the limit (was MONITOR) | **none**: the depth-2 rule is unchanged |

- `watch_reason` is set if and only if the severity is WATCH.
- Nothing past depth 2 can be LIKELY, and a `beyond_depth_2` WATCH never carries a number.
  `test_rules.py` asserts both, and they were re-verified on real feeds (see WT5).

**What changed.**

- **Engine.**
  - `crew.py`: `LIKELY` / `WATCH`, `UPPER_BOUND_ONLY` / `BEYOND_DEPTH_2`, and
    `CrewAlertDraft.watch_reason`.
  - `engine.py`: passenger rules and `make_alert` (`watch_reason` field).
  - `feed.py`: `alerts_by_severity` now has the keys LIKELY / WATCH, plus a new
    `watch_by_reason`.
  - `notify.py`: WATCH messages say "(watch - upper bound only)" or
    "(watch - not quantified)".
- **Removed.** The unused `max_severity` cap. No rule ever set it, and it had no meaning under
  two tiers.
- **Schemas.** `Alert.severity` is `Literal["LIKELY","WATCH"]`; there is a new
  `Alert.watch_reason`; and `FeedSummary.watch_by_reason`. A test asserts that `"POSSIBLE"`
  is now rejected.
- **Frontend.**
  - `SeverityChip` shows WATCH with its reason ("upper bound" / "no number"), and a tooltip
    explains each.
  - The /alerts summary tiles are Likely / Watch.
  - The `RecommendationPanel` footer is rewritten.
  - The /performance card has a three-band table.
- **Backtest.** It records `engine_watch_reason`, and the mirror check covers the two tiers.
  - For the ES2 `--severity-ordering` scan, the pre-merge labels are reconstructed from
    `watch_reason`, so that analysis stays reproducible.
  - Re-running it gives the identical result: U = 10 chosen, fails on test.

## WT2. Three bands: validation and test, both profiles

`results/layer5/three_band.csv`. Both splits were re-run from scratch with the merged engine:
validation 307 s, test 387 s, **0 engine/mirror mismatches** in each. Observed breach rate
(n):

| Split | Seed | Profile | LIKELY | WATCH | No alert | Ordered? |
|---|---|---|---|---|---|---|
| validation | **departure** | FAA | **0.936** (720) | **0.581** (375) | **0.030** (28,891) | ✓ |
| validation | **departure** | DGCA | **0.921** (687) | **0.564** (450) | **0.028** (32,007) | ✓ |
| test | **departure** | FAA | **0.885** (549) | **0.434** (302) | **0.022** (26,331) | ✓ |
| test | **departure** | DGCA | **0.884** (458) | **0.489** (278) | **0.018** (29,356) | ✓ |
| validation | arrival | FAA | 0.952 (858) | 0.553 (414) | 0.022 (28,592) | ✓ |
| validation | arrival | DGCA | 0.922 (883) | 0.459 (447) | 0.020 (31,645) | ✓ |
| test | arrival | FAA | 0.913 (610) | 0.433 (353) | 0.016 (26,087) | ✓ |
| test | arrival | DGCA | 0.904 (543) | 0.492 (325) | 0.013 (29,145) | ✓ |

**The three-band ordering LIKELY > WATCH > no alert holds on both splits, both profiles and
both seed modes.**

- Each band is separated by a wide margin: about 0.4 between LIKELY and WATCH, and about 0.4
  between WATCH and no alert.
- The two sub-reasons inside WATCH remain indistinguishable from each other, which is the
  point of the merge. On test / departure seeding:
  - `upper_bound_only` breaches at 0.415 (FAA) and 0.471 (DGCA);
  - `beyond_depth_2` breaches at 0.455 and 0.519.

**One definition changed.** "Actionable recall" now counts **any** actionable alert (LIKELY or
WATCH). It previously counted LIKELY + POSSIBLE and left out MONITOR. Under the default
(departure) seeding, on test:

| Profile | Rule | LIKELY precision | Actionable recall: any alert (new) | Actionable recall: LIKELY only |
|---|---|---|---|---|
| FAA | FDP limit | 0.849 | **0.465** | 0.300 |
| FAA | Minimum rest | 0.906 | 0.680 | 0.610 |
| FAA | All crew rules | 0.885 | 0.508 | 0.397 |
| DGCA | FDP limit | 0.840 | **0.485** | 0.326 |
| DGCA | Minimum rest | 0.929 | 0.709 | 0.634 |
| DGCA | All crew rules | 0.884 | 0.487 | 0.361 |

The ES1 figures (0.376 / 0.412 for FDP) were the old LIKELY + POSSIBLE definition. They are not
comparable with the 0.465 / 0.485 here, which also count beyond-depth-2 WATCH.

## WT3. `POST /api/recommendations`: arrival or departure delay

The body now takes `tail`, `date`, `leg_num`, an optional `profile`, and **exactly one** of
`arrival_delay` / `departure_delay`. A Pydantic `model_validator` enforces this: neither or
both returns **422**.

- **`departure_delay`** is converted to an arrival delay as `departure_delay × recovery_rate`
  (0.8952, `bundle.recovery_rate`). This is the same conversion the departure-seeded feed uses.
  Lead times are measured from the leg's actual departure, as in the feed.
- **`arrival_delay`** is used as is, with lead times measured from the actual arrival, as
  before.
- The response gains a `seed` block: `kind`, `input_minutes`, `arrival_delay_used`,
  `recovery_rate`, `information_time_utc`.
- The cascade panel sends `arrival_delay`, since its operator-entered delay is an arrival
  delay.
- `observed_delay_minutes` is no longer accepted on this endpoint. `POST /api/propagate` is
  unchanged.

**Tests.**

- `RecommendationRequestValidation`: exactly-one validation at schema level.
- `EndpointMatchesFeed` (FastAPI `TestClient`, real models):
  - **Endpoint and feed give identical crew alerts for the same seed.** For 12 aircraft per
    profile on 2025-07-25 (24 seeds), the departure-seeded `/api/alerts` feed was compared
    with `POST /api/recommendations` for the same tail, seed leg and `DEP_DELAY`. On every
    seed the crew alerts are equal on rule, severity, `watch_reason`, predicted value,
    threshold, deadline (UTC and station), usable lead, status and flight.
  - `departure_delay = 100` → `arrival_delay_used` = 100 × 0.8952 in both the `seed` block and
    the chain.
  - Both or neither delay → 422; one → 200.
- Live check: `departure_delay = 40` on N8714Q leg 1 → arrival 35.81, information time
  11:00Z, which is 06:20 EDT + 40 min.

## WT4. Tests and checks

- **`api/layer5/test_rules.py`: 38/38 pass**, up from 32. Added:
  - `WatchTier` ×2: only two severities exist; reason iff WATCH; `beyond_depth_2` has no
    value; schema rejects `POSSIBLE`.
  - `RecommendationRequestValidation` ×1.
  - `EndpointMatchesFeed` ×3.
- The existing depth-2 tests now assert WATCH + `beyond_depth_2` + no value, where they
  previously asserted MONITOR.
- **`api/test_parity.py`: passes** (Layer 4 max diff 0.004968 min).
- **Frontend:** `tsc --noEmit` and `next build` are clean.
- **Live render** of /alerts (2025-07-31):
  - 36 LIKELY and 29 WATCH alerts.
  - Every WATCH chip shows its reason.
  - **No "POSSIBLE" or "MONITOR" text remains.**
- **Live render** of /performance: the three-band table appears, read from `three_band.csv`.

## WT5. Files

**Changed (Python).**

- `api/layer5/crew.py`, `engine.py`, `feed.py`, `notify.py`, `backtest.py`, `test_rules.py`
- `api/schemas.py`: severity literal, `watch_reason`, `watch_by_reason`; the
  `RecommendationRequest` rewrite and `RecommendationSeed`.
- `api/main.py`: the recommendations endpoint.
- `api/performance_data.py`: `three_band` and the actionable-recall columns.
- `api/README.md`

**Changed (frontend).**

- `fdpis-web/lib/types.ts`, `lib/api/recommendations.ts`, `lib/api/performance.ts`
- `components/rules/RuleUi.tsx`, `components/alerts/AlertsConsole.tsx`,
  `components/cascade/RecommendationPanel.tsx`
- `app/performance/page.tsx`

**`results/layer5/`.** All tables regenerated with two-tier labels. New: `three_band.csv`.
`backtest_records.parquet` and `backtest_records_validation.parquet` now carry
`engine_watch_reason`.

**Not modified.** `api/propagation.py`, `models.py`, `features.py`, `config.py`, notebooks, and
`results/` outside `results/layer5/`. Nothing committed.

## WT6. Actionable FDP recall vs precision: three alert sets

`results/layer5/recall_precision_sets.csv` (`python -m api.layer5.backtest --recall-sets`).

**Scope.** FDP-limit rule, departure seeding, single-crew model, validation and test. Every set
is scored on the **same** rows: applicable, rule evaluated, outcome known, not cancelled
downstream. So each precision is matched to its recall.

**The three sets are nested:**

- **(a)** LIKELY only.
- **(b)** LIKELY + WATCH `upper_bound_only`.
- **(c)** All alerts, including WATCH `beyond_depth_2`.

**Columns.**

- *Actionable recall*: breaches that got an alert in the set *before its action deadline*,
  divided by all breaches.
- *Precision*: breaches divided by all alerts in the set.
- *Actionable precision*: the same, over actionable alerts only. It is within 0.004 of
  precision everywhere, because under departure seeding almost no alert is late.

| Split | Profile | Breaches | Set | Alerts | Actionable recall | Precision | Actionable precision |
|---|---|---|---|---|---|---|---|
| validation | FAA | 788 | **(a) LIKELY only** | 235 | **0.263** | **0.898** | 0.896 |
| validation | FAA | | (b) + WATCH upper | 380 | 0.363 | 0.763 | 0.761 |
| validation | FAA | | (c) all alerts | 488 | 0.443 | 0.725 | 0.723 |
| validation | DGCA | 693 | **(a) LIKELY only** | 250 | **0.310** | **0.880** | 0.878 |
| validation | DGCA | | (b) + WATCH upper | 401 | 0.429 | 0.756 | 0.752 |
| validation | DGCA | | (c) all alerts | 472 | 0.482 | 0.720 | 0.717 |
| test | FAA | 540 | **(a) LIKELY only** | 192 | **0.300** | **0.849** | 0.853 |
| test | FAA | | (b) + WATCH upper | 300 | 0.376 | 0.680 | 0.681 |
| test | FAA | | (c) all alerts | 408 | 0.465 | 0.618 | 0.620 |
| test | DGCA | 427 | **(a) LIKELY only** | 169 | **0.326** | **0.840** | 0.837 |
| test | DGCA | | (b) + WATCH upper | 260 | 0.412 | 0.688 | 0.685 |
| test | DGCA | | (c) all alerts | 319 | 0.485 | 0.658 | 0.655 |

**Reading it.**

- Each step down the list buys about 8–10 points of actionable recall for about 15–20 points
  of precision first, then about 4–6 points more. The pattern is the same on both splits.
- **(a) is the headline.** It is the only set whose precision stays above 0.84 on test. It
  warns about **30% (FAA) / 33% (DGCA)** of FDP breaches in time, at 85% / 84% precision.
- (b) and (c) are shown as the trade-off: up to 47–49% recall, at 62–66% precision.
- Two figures from earlier sections are the same quantities under the new names, now on
  matched rows:
  - ES1's 0.376 / 0.412 is set (b).
  - WT2's "any alert" 0.465 / 0.485 is set (c).

**On the /performance card,** each profile shows (a) as the headline number ("30% of 540
breaches, at 85% precision"), with (b) and (c) underneath as a one-line trade-off. Everything
is read from the CSV.

**Remaining `observed_delay_minutes` uses.** A grep over `api/` and `fdpis-web/` finds it only
on `POST /api/propagate`: the request field, the response field and its one caller,
`simulateCascade`. That endpoint is unchanged by design. **No caller still sends it to
`/api/recommendations`**, so nothing needed fixing. `api/README.md` gains a
`/api/recommendations` example using `departure_delay`.
