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
