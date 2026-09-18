from flask import Flask, render_template, jsonify, request, Response
import pandas as pd
import os
import io
import csv

app = Flask(__name__)

CURRENT_TEAMS = (
    "CSK", "DC", "GT", "KKR", "LSG",
    "MI", "PBKS", "RCB", "RR", "SRH",
)

TEAM_ALIASES = {
    "Chennai Super Kings": "CSK",
    "Delhi Capitals": "DC",
    "Delhi Daredevils": "DC",
    "Gujarat Titans": "GT",
    "Kolkata Knight Riders": "KKR",
    "Lucknow Super Giants": "LSG",
    "Mumbai Indians": "MI",
    "Kings XI Punjab": "PBKS",
    "Punjab Kings": "PBKS",
    "Rajasthan Royals": "RR",
    "Royal Challengers Bangalore": "RCB",
    "Royal Challengers Bengaluru": "RCB",
    "Sunrisers Hyderabad": "SRH",
}

FULL_TEAM_NAMES = {
    "CSK": "Chennai Super Kings",
    "DC": "Delhi Capitals",
    "GT": "Gujarat Titans",
    "KKR": "Kolkata Knight Riders",
    "LSG": "Lucknow Super Giants",
    "MI": "Mumbai Indians",
    "PBKS": "Punjab Kings",
    "RCB": "Royal Challengers Bengaluru",
    "RR": "Rajasthan Royals",
    "SRH": "Sunrisers Hyderabad",
}

TEAM_TITLES = {
    "MI": 5, "CSK": 5, "KKR": 3, "SRH": 2, "RR": 1, "GT": 1,
    "DC": 0, "PBKS": 0, "RCB": 0, "LSG": 0
}

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

MATCHES_FILE = os.path.join(
    BASE_DIR, "data", "processed", "matches_all.csv"
)

DELIVERIES_FILE = os.path.join(
    BASE_DIR, "data", "processed", "deliveries_all.csv"
)

POINTS_TABLE_2026_FILE = os.path.join(
    BASE_DIR, "data", "2026", "points_table.csv"
)

# --------------------------------------------------
# Load & Clean Data
# --------------------------------------------------

matches = pd.read_csv(MATCHES_FILE, low_memory=False)
deliveries = pd.read_csv(DELIVERIES_FILE, low_memory=False)

matches.columns = matches.columns.str.strip()
deliveries.columns = deliveries.columns.str.strip()

matches["season_clean"] = pd.to_datetime(matches["date"], errors="coerce").dt.year.fillna(
    pd.to_numeric(matches["season"].astype(str).str[:4], errors="coerce")
)
deliveries["season_clean"] = pd.to_numeric(deliveries["season"].astype(str).str[:4], errors="coerce")

matches = matches.dropna(subset=["season_clean"]).copy()
deliveries = deliveries.dropna(subset=["season_clean"]).copy()

matches["season"] = matches["season_clean"].astype(int)
deliveries["season"] = deliveries["season_clean"].astype(int)

deliveries["batting_team"] = deliveries["batting_team"].replace(TEAM_ALIASES)
deliveries = deliveries[deliveries["batting_team"].isin(CURRENT_TEAMS)].copy()

# Pre-calculate player career stats for fast lookup
deliveries["runs_of_bat"] = pd.to_numeric(deliveries["runs_of_bat"], errors="coerce").fillna(0)
if "wide" in deliveries.columns:
    deliveries["wide_clean"] = pd.to_numeric(deliveries["wide"], errors="coerce").fillna(0)
else:
    deliveries["wide_clean"] = 0


# --------------------------------------------------
# Helper functions
# --------------------------------------------------

def get_filtered_data():
    season = request.args.get("season")
    team = request.args.get("team")
    player = request.args.get("player")

    df = deliveries.copy()

    if season and season != "all":
        try:
            df = df[df["season"] == int(season)]
        except ValueError:
            pass

    if team and team != "all":
        df = df[df["batting_team"] == team]

    if player and player != "all":
        df = df[df["striker"] == player]

    return df


def compute_team_standings(season="all"):
    if str(season) == "2026" and os.path.exists(POINTS_TABLE_2026_FILE):
        try:
            pt_df = pd.read_csv(POINTS_TABLE_2026_FILE)
            pt_df.columns = pt_df.columns.str.strip()
            result = []
            for _, row in pt_df.iterrows():
                result.append({
                    "position": int(row.get("position", 0)),
                    "team": str(row.get("team", "")),
                    "team_code": str(row.get("team", "")),
                    "matches": int(row.get("matches", 0)),
                    "wins": int(row.get("wins", 0)),
                    "defeats": int(row.get("defeats", 0)),
                    "ties": int(row.get("ties", 0)),
                    "abandoned": int(row.get("abandoned", 0)),
                    "points": int(row.get("points", 0)),
                    "nrr": float(row.get("nrr", 0.0))
                })
            return result
        except Exception as e:
            print("Error reading 2026 points table:", e)

    df_matches = matches.copy()
    if season and season != "all":
        try:
            df_matches = df_matches[df_matches["season"] == int(season)]
        except ValueError:
            pass

    df_matches["t1"] = df_matches["team1"].map(lambda x: TEAM_ALIASES.get(str(x), str(x)))
    df_matches["t2"] = df_matches["team2"].map(lambda x: TEAM_ALIASES.get(str(x), str(x)))
    df_matches["winner"] = df_matches["match_winner"].map(lambda x: TEAM_ALIASES.get(str(x), str(x)))

    stats = {}
    for team_code in CURRENT_TEAMS:
        stats[team_code] = {
            "team_code": team_code,
            "team": FULL_TEAM_NAMES.get(team_code, team_code),
            "matches": 0,
            "wins": 0,
            "defeats": 0,
            "ties": 0,
            "abandoned": 0,
            "points": 0,
            "nrr": 0.0
        }

    for _, row in df_matches.iterrows():
        t1, t2, winner = row["t1"], row["t2"], row["winner"]
        result = str(row.get("match_result", "")).lower()

        for t in [t1, t2]:
            if t in stats:
                stats[t]["matches"] += 1

        if pd.notna(winner) and winner in stats:
            stats[winner]["wins"] += 1
            stats[winner]["points"] += 2
            loser = t2 if winner == t1 else t1
            if loser in stats:
                stats[loser]["defeats"] += 1
        elif "tie" in result or row.get("super_over_match") == 1:
            for t in [t1, t2]:
                if t in stats:
                    stats[t]["ties"] += 1
                    stats[t]["points"] += 1
        else:
            for t in [t1, t2]:
                if t in stats:
                    stats[t]["abandoned"] += 1
                    stats[t]["points"] += 1

    res = list(stats.values())
    res.sort(key=lambda x: (x["points"], x["wins"]), reverse=True)
    for idx, item in enumerate(res, 1):
        item["position"] = idx

    return res


# --------------------------------------------------
# Page Routes (Client-Side SPA HTML Server)
# --------------------------------------------------

@app.route("/")
@app.route("/dashboard")
@app.route("/teams")
@app.route("/teams/<team_code>")
@app.route("/players")
@app.route("/players/<path:player_name>")
@app.route("/matches")
@app.route("/matches/<int:match_id>")
@app.route("/analysis")
@app.route("/reports")
@app.route("/settings")
def render_app_page(team_code=None, player_name=None, match_id=None):
    return render_template("index.html")


# --------------------------------------------------
# API: Dashboard
# --------------------------------------------------

@app.route("/api/dashboard")
def dashboard_api():
    try:
        df = get_filtered_data()

        seasons = sorted(deliveries["season"].dropna().unique().tolist())
        teams = [t for t in CURRENT_TEAMS if t in deliveries["batting_team"].unique()]
        players = sorted(deliveries["striker"].dropna().astype(str).unique().tolist())

        total_runs = int(df["runs_of_bat"].sum())
        total_fours = int((df["runs_of_bat"] == 4).sum())
        total_sixes = int((df["runs_of_bat"] == 6).sum())
        legal_balls = int((df["wide_clean"] == 0).sum())
        strike_rate = (total_runs / legal_balls * 100) if legal_balls > 0 else 0

        # Runs by player
        runs_player = (
            df.groupby("striker", as_index=False)["runs_of_bat"]
            .sum()
            .sort_values("runs_of_bat", ascending=False)
        )
        runs_by_player = [
            {"player": str(row["striker"]), "runs": int(row["runs_of_bat"])}
            for _, row in runs_player.iterrows()
        ]

        # Player strike rates
        player_runs = df.groupby("striker")["runs_of_bat"].sum()
        legal_df = df[df["wide_clean"] == 0]
        player_balls = legal_df.groupby("striker").size()

        scatter = []
        for p_name in player_runs.index:
            r = float(player_runs.get(p_name, 0))
            b = int(player_balls.get(p_name, 0))
            sr_val = (r / b * 100) if b > 0 else 0
            scatter.append({"player": str(p_name), "runs": int(r), "strike_rate": round(sr_val, 2)})

        scatter.sort(key=lambda x: x["runs"], reverse=True)

        # Milestones
        player_score_match = df.groupby(["match_id", "striker"], as_index=False)["runs_of_bat"].sum()
        milestones = []
        for p_name, group in player_score_match.groupby("striker"):
            fifties = int(((group["runs_of_bat"] >= 50) & (group["runs_of_bat"] < 100)).sum())
            hundreds = int((group["runs_of_bat"] >= 100).sum())
            milestones.append({"player": str(p_name), "fifties": fifties, "hundreds": hundreds})
        milestones.sort(key=lambda x: (x["hundreds"], x["fifties"]), reverse=True)

        # Boundaries
        boundaries = (
            df.groupby("striker")
            .agg(
                fours=("runs_of_bat", lambda x: int((x == 4).sum())),
                sixes=("runs_of_bat", lambda x: int((x == 6).sum()))
            )
            .reset_index()
        )
        boundaries_list = [
            {"player": str(r["striker"]), "fours": int(r["fours"]), "sixes": int(r["sixes"])}
            for _, r in boundaries.iterrows()
        ]
        boundaries_list.sort(key=lambda x: (x["fours"] + x["sixes"]), reverse=True)

        # Team Runs
        team_runs = df.groupby("batting_team", as_index=False)["runs_of_bat"].sum().sort_values("runs_of_bat", ascending=False)
        team_runs_list = [{"team_name": str(r["batting_team"]), "runs": int(r["runs_of_bat"])} for _, r in team_runs.iterrows()]

        # Season Performance Trends
        season_perf = []
        for s, sdf in df.groupby("season"):
            s_r = int(sdf["runs_of_bat"].sum())
            s_f = int((sdf["runs_of_bat"] == 4).sum())
            s_x = int((sdf["runs_of_bat"] == 6).sum())
            s_l = int((sdf["wide_clean"] == 0).sum())
            s_sr = round((s_r / s_l * 100), 2) if s_l > 0 else 0
            season_perf.append({"season": int(s), "runs": s_r, "fours": s_f, "sixes": s_x, "strike_rate": s_sr})
        season_perf.sort(key=lambda x: x["season"])

        top_scorer = runs_by_player[0] if runs_by_player else {"player": "N/A", "runs": 0}
        top_sixes = max(boundaries_list, key=lambda x: x["sixes"]) if boundaries_list else {"player": "N/A", "sixes": 0}
        top_fours = max(boundaries_list, key=lambda x: x["fours"]) if boundaries_list else {"player": "N/A", "fours": 0}
        sr_cand = [p for p in scatter if p["runs"] >= 150] or scatter
        best_sr = max(sr_cand, key=lambda x: x["strike_rate"]) if sr_cand else {"player": "N/A", "strike_rate": 0, "runs": 0}
        top_team = team_runs_list[0] if team_runs_list else {"team_name": "N/A", "runs": 0}

        return jsonify({
            "filters": {"seasons": seasons, "teams": teams, "players": players},
            "metrics": {
                "total_runs": total_runs,
                "total_fours": total_fours,
                "total_sixes": total_sixes,
                "strike_rate": round(strike_rate, 2)
            },
            "runs_by_player": runs_by_player,
            "scatter": scatter,
            "milestones": milestones,
            "boundaries": boundaries_list,
            "team_runs": team_runs_list,
            "season_performance": season_perf,
            "quick_insights": {
                "top_scorer": top_scorer,
                "most_sixes": top_sixes,
                "most_fours": top_fours,
                "best_strike_rate": best_sr,
                "top_team": {"team_code": top_team.get("team_name"), "full_name": FULL_TEAM_NAMES.get(top_team.get("team_name"), top_team.get("team_name")), "runs": top_team.get("runs")}
            },
            "top_performers": [
                {"category": "Top Run Scorer", "player": top_scorer["player"], "value": f"{top_scorer['runs']:,}"},
                {"category": "Sixes King", "player": top_sixes["player"], "value": f"{top_sixes['sixes']:,} Sixes"},
                {"category": "Boundary Machine", "player": top_fours["player"], "value": f"{top_fours['fours']:,} Fours"},
                {"category": "Best Strike Rate", "player": best_sr["player"], "value": f"{best_sr['strike_rate']}"}
            ]
        })
    except Exception as e:
        print("Dashboard API Error:", repr(e))
        return jsonify({"error": str(e)}), 500


# --------------------------------------------------
# API: Teams Directory & Teams Detail
# --------------------------------------------------

@app.route("/api/teams")
def teams_list_api():
    try:
        season = request.args.get("season", "all")
        standings = compute_team_standings(season)
        
        # Calculate overall runs and boundaries per team
        df = deliveries.copy()
        if season != "all":
            try:
                df = df[df["season"] == int(season)]
            except ValueError:
                pass
        
        team_runs = df.groupby("batting_team")["runs_of_bat"].sum().to_dict()
        team_fours = df[df["runs_of_bat"] == 4].groupby("batting_team").size().to_dict()
        team_sixes = df[df["runs_of_bat"] == 6].groupby("batting_team").size().to_dict()

        for t in standings:
            code = t["team_code"]
            t["total_runs"] = int(team_runs.get(code, 0))
            t["fours"] = int(team_fours.get(code, 0))
            t["sixes"] = int(team_sixes.get(code, 0))
            t["titles"] = TEAM_TITLES.get(code, 0)
            t["win_pct"] = round((t["wins"] / t["matches"] * 100), 1) if t["matches"] > 0 else 0.0

        return jsonify(standings)
    except Exception as e:
        print("Teams API Error:", repr(e))
        return jsonify({"error": str(e)}), 500


@app.route("/api/teams/<team_code>")
def team_detail_api(team_code):
    try:
        code = team_code.upper()
        if code not in CURRENT_TEAMS:
            return jsonify({"error": f"Team {code} not found"}), 404

        standings = compute_team_standings("all")
        team_info = next((t for t in standings if t["team_code"] == code), {
            "team_code": code, "team": FULL_TEAM_NAMES.get(code, code),
            "matches": 0, "wins": 0, "defeats": 0, "points": 0, "nrr": 0.0
        })

        t_deliveries = deliveries[deliveries["batting_team"] == code].copy()
        total_runs = int(t_deliveries["runs_of_bat"].sum())
        fours = int((t_deliveries["runs_of_bat"] == 4).sum())
        sixes = int((t_deliveries["runs_of_bat"] == 6).sum())
        win_pct = round((team_info["wins"] / team_info["matches"] * 100), 1) if team_info["matches"] > 0 else 0.0

        # Season history
        season_history = []
        for s, sdf in t_deliveries.groupby("season"):
            s_runs = int(sdf["runs_of_bat"].sum())
            s_fours = int((sdf["runs_of_bat"] == 4).sum())
            s_sixes = int((sdf["runs_of_bat"] == 6).sum())
            season_history.append({"season": int(s), "runs": s_runs, "fours": s_fours, "sixes": s_sixes})
        season_history.sort(key=lambda x: x["season"])

        # Top 10 batters for this team
        top_batters_df = t_deliveries.groupby("striker")["runs_of_bat"].sum().reset_index()
        top_batters_df = top_batters_df.sort_values("runs_of_bat", ascending=False).head(10)
        
        top_batters = []
        for _, row in top_batters_df.iterrows():
            p_name = str(row["striker"])
            p_df = t_deliveries[t_deliveries["striker"] == p_name]
            p_runs = int(row["runs_of_bat"])
            p_fours = int((p_df["runs_of_bat"] == 4).sum())
            p_sixes = int((p_df["runs_of_bat"] == 6).sum())
            p_matches = int(p_df["match_id"].nunique())
            p_legal = int((p_df["wide_clean"] == 0).sum())
            p_sr = round((p_runs / p_legal * 100), 2) if p_legal > 0 else 0.0
            top_batters.append({
                "player": p_name, "matches": p_matches, "runs": p_runs,
                "strike_rate": p_sr, "fours": p_fours, "sixes": p_sixes
            })

        return jsonify({
            "team_code": code,
            "team_name": FULL_TEAM_NAMES.get(code, code),
            "titles": TEAM_TITLES.get(code, 0),
            "matches": team_info["matches"],
            "wins": team_info["wins"],
            "defeats": team_info["defeats"],
            "win_pct": win_pct,
            "total_runs": total_runs,
            "fours": fours,
            "sixes": sixes,
            "season_history": season_history,
            "top_players": top_batters
        })
    except Exception as e:
        print("Team Detail Error:", repr(e))
        return jsonify({"error": str(e)}), 500


# --------------------------------------------------
# API: Players Directory & Player Details
# --------------------------------------------------

@app.route("/api/players")
def players_directory_api():
    try:
        search_query = request.args.get("search", "").strip().lower()
        season = request.args.get("season", "all")
        team = request.args.get("team", "all")
        min_runs = int(request.args.get("min_runs", 0))
        page = int(request.args.get("page", 1))
        limit = int(request.args.get("limit", 20))

        df = deliveries.copy()

        if season != "all":
            try:
                df = df[df["season"] == int(season)]
            except ValueError:
                pass

        if team != "all":
            df = df[df["batting_team"] == team]

        # Aggregate player statistics
        p_runs = df.groupby("striker")["runs_of_bat"].sum()
        p_fours = df[df["runs_of_bat"] == 4].groupby("striker").size()
        p_sixes = df[df["runs_of_bat"] == 6].groupby("striker").size()
        p_matches = df.groupby("striker")["match_id"].nunique()
        p_balls = df[df["wide_clean"] == 0].groupby("striker").size()
        p_teams = df.groupby("striker")["batting_team"].unique()

        # Milestones
        p_match_scores = df.groupby(["match_id", "striker"])["runs_of_bat"].sum().reset_index()
        p_50s = p_match_scores[(p_match_scores["runs_of_bat"] >= 50) & (p_match_scores["runs_of_bat"] < 100)].groupby("striker").size()
        p_100s = p_match_scores[p_match_scores["runs_of_bat"] >= 100].groupby("striker").size()

        players_list = []
        for p_name in p_runs.index:
            runs = int(p_runs.get(p_name, 0))
            if runs < min_runs:
                continue
            if search_query and search_query not in p_name.lower():
                continue

            matches_cnt = int(p_matches.get(p_name, 0))
            balls_cnt = int(p_balls.get(p_name, 0))
            sr = round((runs / balls_cnt * 100), 2) if balls_cnt > 0 else 0.0
            avg = round((runs / matches_cnt), 2) if matches_cnt > 0 else 0.0
            teams_str = ", ".join(list(p_teams.get(p_name, [])))

            players_list.append({
                "player": str(p_name),
                "team": teams_str,
                "matches": matches_cnt,
                "runs": runs,
                "average": avg,
                "strike_rate": sr,
                "fours": int(p_fours.get(p_name, 0)),
                "sixes": int(p_sixes.get(p_name, 0)),
                "fifties": int(p_50s.get(p_name, 0)),
                "hundreds": int(p_100s.get(p_name, 0))
            })

        players_list.sort(key=lambda x: x["runs"], reverse=True)

        for idx, item in enumerate(players_list, 1):
            item["rank"] = idx

        total_players = len(players_list)
        total_pages = max(1, (total_players + limit - 1) // limit)
        start_idx = (page - 1) * limit
        paginated_players = players_list[start_idx : start_idx + limit]

        return jsonify({
            "players": paginated_players,
            "total": total_players,
            "page": page,
            "pages": total_pages,
            "filter_options": {
                "seasons": sorted(matches["season"].dropna().unique().tolist(), reverse=True),
                "teams": [
                    {"code": t, "name": FULL_TEAM_NAMES.get(t, t)}
                    for t in CURRENT_TEAMS
                ]
            }
        })
    except Exception as e:
        print("Players Directory API Error:", repr(e))
        return jsonify({"error": str(e)}), 500


@app.route("/api/players/<path:player_name>")
def player_detail_api(player_name):
    try:
        p_df = deliveries[deliveries["striker"] == player_name].copy()

        if len(p_df) == 0:
            return jsonify({"error": f"Player '{player_name}' not found"}), 404

        runs = int(p_df["runs_of_bat"].sum())
        fours = int((p_df["runs_of_bat"] == 4).sum())
        sixes = int((p_df["runs_of_bat"] == 6).sum())
        matches_cnt = int(p_df["match_id"].nunique())
        legal_balls = int((p_df["wide_clean"] == 0).sum())
        sr = round((runs / legal_balls * 100), 2) if legal_balls > 0 else 0.0
        avg = round((runs / matches_cnt), 2) if matches_cnt > 0 else 0.0
        teams_played = list(p_df["batting_team"].unique())

        match_scores = p_df.groupby("match_id")["runs_of_bat"].sum()
        fifties = int(((match_scores >= 50) & (match_scores < 100)).sum())
        hundreds = int((match_scores >= 100).sum())
        highest_score = int(match_scores.max()) if len(match_scores) > 0 else 0

        # Season history table
        seasons_list = []
        for s, sdf in p_df.groupby("season"):
            s_runs = int(sdf["runs_of_bat"].sum())
            s_fours = int((sdf["runs_of_bat"] == 4).sum())
            s_sixes = int((sdf["runs_of_bat"] == 6).sum())
            s_matches = int(sdf["match_id"].nunique())
            s_legal = int((sdf["wide_clean"] == 0).sum())
            s_sr = round((s_runs / s_legal * 100), 2) if s_legal > 0 else 0.0
            s_avg = round((s_runs / s_matches), 2) if s_matches > 0 else 0.0
            s_scores = sdf.groupby("match_id")["runs_of_bat"].sum()
            s_50s = int(((s_scores >= 50) & (s_scores < 100)).sum())
            s_100s = int((s_scores >= 100).sum())
            seasons_list.append({
                "season": int(s), "matches": s_matches, "runs": s_runs,
                "average": s_avg, "strike_rate": s_sr, "fours": s_fours,
                "sixes": s_sixes, "fifties": s_50s, "hundreds": s_100s
            })
        seasons_list.sort(key=lambda x: x["season"])

        return jsonify({
            "player": player_name,
            "teams": ", ".join(teams_played),
            "matches": matches_cnt,
            "runs": runs,
            "average": avg,
            "strike_rate": sr,
            "highest_score": highest_score,
            "fours": fours,
            "sixes": sixes,
            "fifties": fifties,
            "hundreds": hundreds,
            "seasons": seasons_list
        })
    except Exception as e:
        print("Player Detail Error:", repr(e))
        return jsonify({"error": str(e)}), 500


# --------------------------------------------------
# API: Matches Directory & Match Details
# --------------------------------------------------

@app.route("/api/matches")
def matches_directory_api():
    try:
        season = request.args.get("season", "all")
        team = request.args.get("team", "all")
        venue = request.args.get("venue", "all")
        winner = request.args.get("winner", "all")
        search_query = request.args.get("search", "").strip().lower()
        page = int(request.args.get("page", 1))
        limit = int(request.args.get("limit", 15))

        df_m = matches.copy()

        if season != "all":
            try:
                df_m = df_m[df_m["season"] == int(season)]
            except ValueError:
                pass

        if team != "all":
            df_m = df_m[(df_m["team1"] == team) | (df_m["team2"] == team) | 
                        (df_m["team1"].map(TEAM_ALIASES) == team) | (df_m["team2"].map(TEAM_ALIASES) == team)]

        if venue != "all":
            df_m = df_m[df_m["venue"] == venue]

        if winner != "all":
            df_m = df_m[(df_m["match_winner"] == winner) | (df_m["match_winner"].map(TEAM_ALIASES) == winner)]

        if search_query:
            df_m = df_m[
                df_m["team1"].astype(str).str.lower().str.contains(search_query) |
                df_m["team2"].astype(str).str.lower().str.contains(search_query) |
                df_m["venue"].astype(str).str.lower().str.contains(search_query) |
                df_m["match_winner"].astype(str).str.lower().str.contains(search_query)
            ]

        venues_list = sorted(matches["venue"].dropna().unique().tolist())
        seasons_list = sorted(matches["season"].dropna().unique().tolist(), reverse=True)

        df_m = df_m.sort_values(["season", "match_id"], ascending=[False, False])
        total_matches = len(df_m)
        total_pages = max(1, (total_matches + limit - 1) // limit)
        start_idx = (page - 1) * limit
        paginated_matches = df_m.iloc[start_idx : start_idx + limit]

        results = []
        for _, row in paginated_matches.iterrows():
            t1 = TEAM_ALIASES.get(str(row.get("team1")), str(row.get("team1")))
            t2 = TEAM_ALIASES.get(str(row.get("team2")), str(row.get("team2")))
            w = TEAM_ALIASES.get(str(row.get("match_winner")), str(row.get("match_winner")))
            
            try:
                first_s = int(float(row.get("first_ings_score", 0)))
                first_w = int(float(row.get("first_ings_wkts", 0)))
                first_score = f"{first_s}/{first_w}"
            except (ValueError, TypeError):
                first_score = "N/A"

            try:
                second_s = int(float(row.get("second_ings_score", 0)))
                second_w = int(float(row.get("second_ings_wkts", 0)))
                second_score = f"{second_s}/{second_w}"
            except (ValueError, TypeError):
                second_score = "N/A"

            date_val = str(row.get("date", "")).split()[0] if pd.notna(row.get("date")) else ""
            city_val = str(row.get("city", "")).strip() if pd.notna(row.get("city")) else ""
            if city_val.lower() in ["nan", "none"]:
                city_val = ""

            margin = str(row.get("match_result", "Completed"))
            if margin.lower() in ["nan", ""]:
                margin = "Completed"

            potm = str(row.get("player_of_the_match", "N/A"))
            if potm.lower() in ["nan", ""]:
                potm = "N/A"

            results.append({
                "match_id": int(row["match_id"]),
                "season": int(row["season"]),
                "date": date_val,
                "team1": t1,
                "team2": t2,
                "team1_full": FULL_TEAM_NAMES.get(t1, t1),
                "team2_full": FULL_TEAM_NAMES.get(t2, t2),
                "venue": str(row.get("venue", "N/A")),
                "city": city_val,
                "winner": w,
                "winner_full": FULL_TEAM_NAMES.get(w, w),
                "result_margin": margin,
                "first_score": first_score,
                "second_score": second_score,
                "player_of_match": potm
            })

        return jsonify({
            "matches": results,
            "total": total_matches,
            "page": page,
            "pages": total_pages,
            "filter_options": {
                "venues": venues_list,
                "seasons": seasons_list,
                "teams": [
                    {"code": t, "name": FULL_TEAM_NAMES.get(t, t)}
                    for t in CURRENT_TEAMS
                ]
            }
        })
    except Exception as e:
        print("Matches API Error:", repr(e))
        return jsonify({"error": str(e)}), 500


@app.route("/api/matches/<int:match_id>")
def match_detail_api(match_id):
    try:
        m_row = matches[matches["match_id"] == match_id]
        if len(m_row) == 0:
            return jsonify({"error": f"Match ID #{match_id} not found"}), 404

        row = m_row.iloc[0]
        t1 = TEAM_ALIASES.get(str(row.get("team1")), str(row.get("team1")))
        t2 = TEAM_ALIASES.get(str(row.get("team2")), str(row.get("team2")))
        w = TEAM_ALIASES.get(str(row.get("match_winner")), str(row.get("match_winner")))

        # Get scores from row or deliveries fallback
        m_deliveries = deliveries[deliveries["match_id"] == match_id]
        try:
            inn1_runs = int(float(row.get("first_ings_score", 0)))
            inn1_wkts = int(float(row.get("first_ings_wkts", 0)))
        except (ValueError, TypeError):
            inn1_runs = int(m_deliveries[m_deliveries["innings"] == 1]["runs_of_bat"].sum()) if len(m_deliveries) > 0 else 0
            inn1_wkts = 0

        try:
            inn2_runs = int(float(row.get("second_ings_score", 0)))
            inn2_wkts = int(float(row.get("second_ings_wkts", 0)))
        except (ValueError, TypeError):
            inn2_runs = int(m_deliveries[m_deliveries["innings"] == 2]["runs_of_bat"].sum()) if len(m_deliveries) > 0 else 0
            inn2_wkts = 0

        # Top scorers in match
        match_batters = []
        if len(m_deliveries) > 0:
            top_bats = m_deliveries.groupby(["striker", "batting_team"])["runs_of_bat"].sum().reset_index()
            top_bats = top_bats.sort_values("runs_of_bat", ascending=False).head(6)
            for _, b in top_bats.iterrows():
                match_batters.append({"player": str(b["striker"]), "team": str(b["batting_team"]), "runs": int(b["runs_of_bat"])})

        date_val = str(row.get("date", "")).split()[0] if pd.notna(row.get("date")) else ""
        city_val = str(row.get("city", "")).strip() if pd.notna(row.get("city")) else ""
        if city_val.lower() in ["nan", "none"]:
            city_val = ""

        margin = str(row.get("match_result", "Completed"))
        if margin.lower() in ["nan", ""]:
            margin = "Completed"

        potm = str(row.get("player_of_the_match", "N/A"))
        if potm.lower() in ["nan", ""]:
            potm = "N/A"

        return jsonify({
            "match_id": match_id,
            "season": int(row["season"]),
            "date": date_val,
            "venue": str(row.get("venue", "N/A")),
            "city": city_val,
            "team1": t1,
            "team2": t2,
            "team1_full": FULL_TEAM_NAMES.get(t1, t1),
            "team2_full": FULL_TEAM_NAMES.get(t2, t2),
            "winner": w,
            "winner_full": FULL_TEAM_NAMES.get(w, w),
            "toss_winner": str(row.get("toss_winner", "N/A")),
            "toss_decision": str(row.get("toss_decision", "N/A")),
            "first_score": inn1_runs,
            "first_wickets": inn1_wkts,
            "second_score": inn2_runs,
            "second_wickets": inn2_wkts,
            "player_of_match": potm,
            "match_result": margin,
            "top_scorers": match_batters
        })
    except Exception as e:
        print("Match Detail Error:", repr(e))
        return jsonify({"error": str(e)}), 500


# --------------------------------------------------
# API: Advanced Analysis
# --------------------------------------------------

@app.route("/api/analysis")
def analysis_api():
    try:
        # Season Trends
        season_trends = []
        for s, sdf in deliveries.groupby("season"):
            s_runs = int(sdf["runs_of_bat"].sum())
            s_fours = int((sdf["runs_of_bat"] == 4).sum())
            s_sixes = int((sdf["runs_of_bat"] == 6).sum())
            s_legal = int((sdf["wide_clean"] == 0).sum())
            s_sr = round((s_runs / s_legal * 100), 2) if s_legal > 0 else 0
            season_trends.append({"season": int(s), "runs": s_runs, "fours": s_fours, "sixes": s_sixes, "strike_rate": s_sr})
        season_trends.sort(key=lambda x: x["season"])

        # Scatter correlations: Runs vs SR & Runs vs Matches
        p_runs = deliveries.groupby("striker")["runs_of_bat"].sum()
        p_balls = deliveries[deliveries["wide_clean"] == 0].groupby("striker").size()
        p_matches = deliveries.groupby("striker")["match_id"].nunique()
        p_sixes = deliveries[deliveries["runs_of_bat"] == 6].groupby("striker").size()
        p_fours = deliveries[deliveries["runs_of_bat"] == 4].groupby("striker").size()

        correlations = []
        for p_name in p_runs.index:
            r = int(p_runs.get(p_name, 0))
            if r < 100: continue
            b = int(p_balls.get(p_name, 0))
            m = int(p_matches.get(p_name, 0))
            x_cnt = int(p_sixes.get(p_name, 0))
            f_cnt = int(p_fours.get(p_name, 0))
            sr = round((r / b * 100), 2) if b > 0 else 0
            b_pct = round(((f_cnt * 4 + x_cnt * 6) / r * 100), 1) if r > 0 else 0
            correlations.append({
                "player": str(p_name), "runs": r, "matches": m,
                "strike_rate": sr, "sixes": x_cnt, "boundary_pct": b_pct
            })
        correlations.sort(key=lambda x: x["runs"], reverse=True)

        # Team Win %
        standings = compute_team_standings("all")
        team_analysis = []
        for t in standings:
            w_pct = round((t["wins"] / t["matches"] * 100), 1) if t["matches"] > 0 else 0
            team_analysis.append({"team": t["team_code"], "full_name": t["team"], "matches": t["matches"], "wins": t["wins"], "win_pct": w_pct})

        return jsonify({
            "season_trends": season_trends,
            "correlations": correlations[:40],
            "team_analysis": team_analysis
        })
    except Exception as e:
        print("Analysis API Error:", repr(e))
        return jsonify({"error": str(e)}), 500


# --------------------------------------------------
# API: Reports & CSV Export Generator
# --------------------------------------------------

@app.route("/api/reports")
def reports_api():
    try:
        report_type = request.args.get("type", "summary")
        season = request.args.get("season", "all")

        df = deliveries.copy()
        if season != "all":
            try:
                df = df[df["season"] == int(season)]
            except ValueError:
                pass

        total_runs = int(df["runs_of_bat"].sum())
        total_fours = int((df["runs_of_bat"] == 4).sum())
        total_sixes = int((df["runs_of_bat"] == 6).sum())
        total_matches = int(df["match_id"].nunique())

        top_scorer = df.groupby("striker")["runs_of_bat"].sum().reset_index().sort_values("runs_of_bat", ascending=False).iloc[0]
        top_team = df.groupby("batting_team")["runs_of_bat"].sum().reset_index().sort_values("runs_of_bat", ascending=False).iloc[0]

        summary_report = {
            "title": "Complete IPL Performance Summary Report",
            "season": season,
            "total_matches": total_matches,
            "total_runs": total_runs,
            "total_fours": total_fours,
            "total_sixes": total_sixes,
            "top_scorer": {"player": str(top_scorer["striker"]), "runs": int(top_scorer["runs_of_bat"])},
            "top_team": {"team": str(top_team["batting_team"]), "runs": int(top_team["runs_of_bat"])}
        }

        return jsonify(summary_report)
    except Exception as e:
        print("Reports API Error:", repr(e))
        return jsonify({"error": str(e)}), 500


@app.route("/api/reports/export")
def export_report_csv():
    try:
        report_type = request.args.get("type", "players")
        
        output = io.StringIO()
        writer = csv.writer(output)

        if report_type == "teams":
            writer.writerow(["Position", "Team Code", "Team Name", "Matches", "Wins", "Defeats", "Points", "NRR"])
            standings = compute_team_standings("all")
            for t in standings:
                writer.writerow([t["position"], t["team_code"], t["team"], t["matches"], t["wins"], t["defeats"], t["points"], t["nrr"]])
            filename = "ipl_team_performance_report.csv"
        else:
            writer.writerow(["Rank", "Player", "Matches", "Runs", "Strike Rate", "Fours", "Sixes"])
            p_runs = deliveries.groupby("striker")["runs_of_bat"].sum().reset_index().sort_values("runs_of_bat", ascending=False).head(50)
            for idx, r in enumerate(p_runs.iterrows(), 1):
                p_name = str(r[1]["striker"])
                runs = int(r[1]["runs_of_bat"])
                p_df = deliveries[deliveries["striker"] == p_name]
                matches_cnt = int(p_df["match_id"].nunique())
                fours = int((p_df["runs_of_bat"] == 4).sum())
                sixes = int((p_df["runs_of_bat"] == 6).sum())
                legal = int((p_df["wide_clean"] == 0).sum())
                sr = round((runs / legal * 100), 2) if legal > 0 else 0
                writer.writerow([idx, p_name, matches_cnt, runs, sr, fours, sixes])
            filename = "ipl_top_players_report.csv"

        return Response(
            output.getvalue(),
            mimetype="text/csv",
            headers={"Content-disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        print("Export CSV Error:", repr(e))
        return jsonify({"error": str(e)}), 500


# --------------------------------------------------
# Start Application Server
# --------------------------------------------------

if __name__ == "__main__":
    print("=" * 60)
    print("IPL CRICKET PERFORMANCE ANALYTICS PLATFORM")
    print("Seasons: 2008–2026")
    print("Matches Loaded:", len(matches))
    print("Deliveries Loaded:", len(deliveries))
    print("Server: http://127.0.0.1:5000")
    print("=" * 60)

    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
