"""Feature assembly for Layer 3 and Layer 4.

Design decision: features are read from data/processed.parquet, not recomputed.
Notebook 1 engineered them once; recomputing here would risk training/serving
skew. Only two sets of features are built at request time, and both are
unavoidable:

  1. The six cyclical transforms, which notebook 2 computes rather than
     notebook 1. They are deterministic sin/cos of columns already present.
  2. The four Layer 4 features derived from an *observed inbound delay*
     (SLACK_DEFICIT, DELAY_TO_SLACK_RATIO, PROJECTED_HOUR_ARRIVALS,
     ARRIVAL_CONGESTION_DELTA). These cannot be precomputed because the delay
     is user input. Formulas are ported verbatim from notebook 5.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from . import config


def add_cyclical(d: pd.DataFrame) -> pd.DataFrame:
    """Identical to notebook 2's add_cyclical()."""
    d = d.copy()
    d["DEP_HOUR_SIN"] = np.sin(2 * np.pi * d["DEP_HOUR"] / 24)
    d["DEP_HOUR_COS"] = np.cos(2 * np.pi * d["DEP_HOUR"] / 24)
    d["ARR_HOUR_SIN"] = np.sin(2 * np.pi * d["ARR_HOUR"] / 24)
    d["ARR_HOUR_COS"] = np.cos(2 * np.pi * d["ARR_HOUR"] / 24)
    d["DOW_SIN"] = np.sin(2 * np.pi * d["DAY_OF_WEEK"] / 7)
    d["DOW_COS"] = np.cos(2 * np.pi * d["DAY_OF_WEEK"] / 7)
    return d


def build_layer3_matrix(rows: pd.DataFrame, cat_types: dict) -> pd.DataFrame:
    """Assemble the 32-column Layer 3 design matrix.

    Mirrors notebook 2's prep(): select the feature columns in training order and
    cast the categoricals to the dtypes built from the training split.
    """
    d = add_cyclical(rows)
    X = d[config.LAYER3_FEATURES].copy()
    for c in config.LAYER3_CAT_COLS:
        X[c] = X[c].astype(cat_types[c])
    return X


def build_layer4_matrix(
    rows: pd.DataFrame,
    inbound_delay,
    prop_features: list[str],
    cat_cols: list[str],
    cat_types: dict,
    arr_counts: pd.Series,
) -> pd.DataFrame:
    """Port of notebook 5's build_features(), line for line.

    `inbound_delay` is the arrival delay handed to this leg by the previous one.
    """
    f = rows.copy()
    f["PREV_ARR_DELAY"] = np.asarray(inbound_delay, dtype=float)

    f["SLACK_DEFICIT"] = f["PREV_ARR_DELAY"] - f["AVAILABLE_SLACK"]
    f["DELAY_TO_SLACK_RATIO"] = (
        f["PREV_ARR_DELAY"] / f["AVAILABLE_SLACK"].clip(lower=1)
    ).clip(upper=50)

    est = (f["PREV_ARR_DELAY"] - f["AVAILABLE_SLACK"]).clip(lower=0)
    f["PROJECTED_ARR_HOUR"] = (((f["CRS_ARR_MIN"] + est) // 60) % 24).astype(int)
    f["PROJECTED_HOUR_ARRIVALS"] = (
        pd.MultiIndex.from_arrays([f["DEST"], f["FL_DATE"], f["PROJECTED_ARR_HOUR"]])
        .map(arr_counts)
        .astype(float)
        .fillna(0)
    )
    f["ARRIVAL_CONGESTION_DELTA"] = (
        f["PROJECTED_HOUR_ARRIVALS"] - f["DEST_HOUR_ARRIVALS"]
    )

    X = f[prop_features].copy()
    for c in cat_cols:
        X[c] = X[c].astype(cat_types[c])
    return X


def primary_delay_series(d: pd.DataFrame) -> pd.Series:
    """Notebook 5's unconditional PRIMARY_DELAY definition."""
    return pd.Series(
        np.where(
            d["LATE_AIRCRAFT_DELAY"].fillna(0) == 0,
            d["DEP_DELAY_NEW"].fillna(0),
            (d["DEP_DELAY_NEW"].fillna(0) - d["LATE_AIRCRAFT_DELAY"].fillna(0)).clip(lower=0),
        ),
        index=d.index,
    )
