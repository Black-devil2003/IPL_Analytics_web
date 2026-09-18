from pathlib import Path

import os
import pandas as pd


BASE_DIR = Path(__file__).resolve().parent

HISTORICAL_DIR = BASE_DIR / "data" / "2008-25"
CURRENT_DIR = BASE_DIR / "data" / "2026"
OUTPUT_DIR = BASE_DIR / "data" / "processed"

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def add_missing_columns(dataframe, columns):
    """Create empty columns when an older dataset does not contain them."""
    for column in columns:
        if column not in dataframe.columns:
            dataframe[column] = ""

    return dataframe


def prepare_matches():
    print("\nLoading 2008-2025 match data...")

    old_path = HISTORICAL_DIR / "matches_updated_ipl_upto_2025.csv"
    old_matches = pd.read_csv(old_path)

    old_matches["date"] = pd.to_datetime(
        old_matches["date"],
        errors="coerce"
    )

    old_matches["season"] = old_matches["season"].astype(str)

    # Rename original columns
    rename_dict = {
        "matchId": "match_id",
        "winner": "match_winner",
        "player_of_match": "player_of_the_match",
    }
    if "winner_runs" in old_matches.columns:
        rename_dict["winner_runs"] = "wb_runs"
    if "winner_wickets" in old_matches.columns:
        rename_dict["winner_wickets"] = "wb_wickets"

    old_matches = old_matches.rename(columns=rename_dict)

    # Calculate historical match scores from old deliveries
    deliv_path = HISTORICAL_DIR / "deliveries_updated_ipl_upto_2025.csv"
    if deliv_path.exists():
        deliv = pd.read_csv(deliv_path, low_memory=False)
        runs_of_bat = pd.to_numeric(deliv.get("batsman_runs", 0), errors="coerce").fillna(0)
        extras = (
            pd.to_numeric(deliv.get("isWide", 0), errors="coerce").fillna(0) +
            pd.to_numeric(deliv.get("isNoBall", 0), errors="coerce").fillna(0) +
            pd.to_numeric(deliv.get("Byes", 0), errors="coerce").fillna(0) +
            pd.to_numeric(deliv.get("LegByes", 0), errors="coerce").fillna(0)
        )
        deliv["runs_total"] = runs_of_bat + extras
        deliv["is_wkt"] = deliv.get("dismissal_kind", pd.Series([None]*len(deliv))).notna().astype(int)

        inn1 = deliv[deliv["inning"] == 1].groupby("matchId").agg(
            first_ings_score=("runs_total", "sum"),
            first_ings_wkts=("is_wkt", "sum")
        ).reset_index()

        inn2 = deliv[deliv["inning"] == 2].groupby("matchId").agg(
            second_ings_score=("runs_total", "sum"),
            second_ings_wkts=("is_wkt", "sum")
        ).reset_index()

        old_matches = old_matches.merge(inn1, left_on="match_id", right_on="matchId", how="left", suffixes=("", "_inn1"))
        old_matches = old_matches.merge(inn2, left_on="match_id", right_on="matchId", how="left", suffixes=("", "_inn2"))

    def compute_result_text(row):
        wb_r = row.get("wb_runs")
        wb_w = row.get("wb_wickets")
        try:
            if pd.notna(wb_r) and float(wb_r) > 0:
                return f"Won by {int(float(wb_r))} runs"
        except (ValueError, TypeError):
            pass
        try:
            if pd.notna(wb_w) and float(wb_w) > 0:
                return f"Won by {int(float(wb_w))} wkts"
        except (ValueError, TypeError):
            pass
        if str(row.get("eliminator", "")).lower() == "super over" or str(row.get("super_over_match", "")).lower() in ["yes", "1", "true"]:
            return "Tie (Won via Super Over)"
        res = str(row.get("match_result", ""))
        if res and res.lower() not in ["", "nan", "completed"]:
            return res
        return "Completed"

    old_matches["match_result"] = old_matches.apply(compute_result_text, axis=1)

    match_columns = [
        "match_id",
        "season",
        "date",
        "venue",
        "city",
        "team1",
        "team2",
        "stage",
        "toss_winner",
        "toss_decision",
        "first_ings_score",
        "first_ings_wkts",
        "second_ings_score",
        "second_ings_wkts",
        "match_result",
        "match_winner",
        "wb_runs",
        "wb_wickets",
        "balls_left",
        "player_of_the_match",
        "top_scorer",
        "highscore",
        "best_bowling",
        "best_bowling_figure",
        "super_over_match",
    ]

    old_matches = add_missing_columns(
        old_matches,
        match_columns
    )[match_columns]

    print("2008-2025 matches:", len(old_matches))

    print("\nLoading 2026 match data...")

    new_path = CURRENT_DIR / "matches.csv"
    new_matches = pd.read_csv(new_path)

    new_matches["date"] = pd.to_datetime(
        new_matches["date"],
        errors="coerce"
    )

    new_matches["season"] = "2026"

    if "city" not in new_matches.columns:
        new_matches["city"] = ""

    new_matches = new_matches.rename(
        columns={
            "matchId": "match_id",
            "winner": "match_winner",
            "player_of_match": "player_of_the_match",
        }
    )

    new_matches["match_result"] = new_matches.apply(compute_result_text, axis=1)

    new_matches = add_missing_columns(
        new_matches,
        match_columns
    )[match_columns]

    print("2026 matches:", len(new_matches))

    all_matches = pd.concat(
        [old_matches, new_matches],
        ignore_index=True
    )

    all_matches = all_matches.drop_duplicates(
        subset=["match_id"],
        keep="last"
    )

    output = OUTPUT_DIR / "matches_all.csv"
    all_matches.to_csv(output, index=False)

    print("Total matches:", len(all_matches))
    print("Created:", output)

    return all_matches


def prepare_deliveries():
    print("\nLoading 2008-2025 deliveries...")

    old_path = (
        HISTORICAL_DIR /
        "deliveries_updated_ipl_upto_2025.csv"
    )

    old_deliveries = pd.read_csv(old_path)

    old_deliveries = old_deliveries.rename(
        columns={
            "matchId": "match_id",
            "inning": "innings",
            "batsman": "striker",
            "batsman_runs": "runs_of_bat",
            "isWide": "wide",
            "isNoBall": "noballs",
            "Byes": "byes",
            "LegByes": "legbyes",
            "dismissal_kind": "wicket_type",
        }
    )

    old_deliveries["season"] = (
        old_deliveries.get("date", "")
        .astype(str)
        .str[:4]
    )

    print(
        "2008-2025 deliveries:",
        len(old_deliveries)
    )

    print("\nLoading 2026 deliveries...")

    new_path = CURRENT_DIR / "deliveries.csv"
    new_deliveries = pd.read_csv(new_path)
    new_deliveries["season"] = "2026"

    print(
        "2026 deliveries:",
        len(new_deliveries)
    )

    delivery_columns = [
        "match_id",
        "season",
        "date",
        "stage",
        "batting_team",
        "bowling_team",
        "innings",
        "over",
        "striker",
        "bowler",
        "runs_of_bat",
        "extras",
        "wide",
        "legbyes",
        "byes",
        "noballs",
        "wicket_type",
        "player_dismissed",
        "fielder",
    ]

    old_deliveries = add_missing_columns(
        old_deliveries,
        delivery_columns
    )[delivery_columns]

    new_deliveries = add_missing_columns(
        new_deliveries,
        delivery_columns
    )[delivery_columns]

    all_deliveries = pd.concat(
        [old_deliveries, new_deliveries],
        ignore_index=True
    )

    output = OUTPUT_DIR / "deliveries_all.csv"
    all_deliveries.to_csv(output, index=False)

    print(
        "Total deliveries:",
        len(all_deliveries)
    )
    print("Created:", output)

    return all_deliveries


def main():
    print("\n==========================================")
    print("       IPL DATA PREPARATION")
    print("==========================================")

    matches = prepare_matches()
    deliveries = prepare_deliveries()

    print("\n==========================================")
    print("       DATA PREPARATION COMPLETE")
    print("==========================================")

    print("Total Matches:", len(matches))
    print("Total Deliveries:", len(deliveries))

    seasons = sorted(
        matches["season"]
        .dropna()
        .astype(str)
        .unique()
    )

    print("Seasons:", seasons)

    print("\nCreated files:")
    print("data/processed/matches_all.csv")
    print("data/processed/deliveries_all.csv")

    print("==========================================")


if __name__ == "__main__":
    main()
