// ==================================================
// IPL DASHBOARD INTERACTIVE CONTROLLER
// ==================================================

document.addEventListener("DOMContentLoaded", function () {

    // DOM Elements
    const seasonFilter = document.getElementById("season-filter");
    const teamFilter = document.getElementById("team-filter");
    const playerFilter = document.getElementById("player-filter");
    const topLimitFilter = document.getElementById("top-limit-filter");

    const applyBtn = document.getElementById("apply-filters");
    const clearBtn = document.getElementById("clear-filters");
    const statusMsg = document.getElementById("status-message");

    const globalSearch = document.getElementById("global-search");
    const searchResults = document.getElementById("search-results");
    const mobileNavToggle = document.getElementById("mobile-nav-toggle");
    const sidebar = document.getElementById("sidebar");

    const compTeam1 = document.getElementById("comp-team1");
    const compTeam2 = document.getElementById("comp-team2");
    const tableSearchInput = document.getElementById("table-search-input");

    let rawData = null;
    let standingsData = [];

    // Colors Theme
    const COLORS = {
        blue: "#2563EB",
        indigo: "#4F46E5",
        cyan: "#06B6D4",
        purple: "#8B5CF6",
        emerald: "#10B981",
        amber: "#F59E0B",
        rose: "#EF4444",
        navy: "#0F172A",
        gray: "#94A3B8"
    };

    // Plotly Config
    const plotlyConfig = {
        responsive: true,
        displayModeBar: false
    };

    const plotlyLayoutBase = {
        font: { family: "Inter, sans-serif", color: "#0F172A" },
        paper_bgcolor: "rgba(0,0,0,0)",
        plot_bgcolor: "rgba(0,0,0,0)",
        margin: { t: 30, r: 20, l: 50, b: 50 },
        hoverlabel: {
            bgcolor: "#0F172A",
            bordercolor: "#1E293B",
            font: { color: "#FFFFFF", family: "Inter" }
        }
    };

    // --------------------------------------------------
    // Mobile Drawer Toggle
    // --------------------------------------------------
    if (mobileNavToggle && sidebar) {
        mobileNavToggle.addEventListener("click", function () {
            sidebar.classList.toggle("sidebar-open");
        });
    }

    // --------------------------------------------------
    // Load Dashboard Data
    // --------------------------------------------------
    async function loadDashboard() {
        if (statusMsg) statusMsg.textContent = "Loading IPL data...";

        try {
            const params = new URLSearchParams();
            if (seasonFilter && seasonFilter.value !== "all") params.set("season", seasonFilter.value);
            if (teamFilter && teamFilter.value !== "all") params.set("team", teamFilter.value);
            if (playerFilter && playerFilter.value !== "all") params.set("player", playerFilter.value);

            const res = await fetch(`/api/dashboard?${params.toString()}`);
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || "Failed to load dashboard data");

            rawData = data;

            // Populate Filter Options
            updateFilterOptions(data.filters);

            // Update UI & Visualizations
            updateKPIs(data.metrics);
            updateQuickInsights(data.quick_insights);
            updateTopPerformers(data.top_performers);

            const limit = parseInt(topLimitFilter ? topLimitFilter.value : 10, 10);

            drawRunsChart(data.runs_by_player, limit);
            drawStrikeChart(data.scatter, data.metrics.strike_rate, limit);
            drawMilestonesChart(data.milestones, limit);
            drawBoundariesChart(data.boundaries, limit);
            drawTeamsChart(data.team_runs, data.metrics.total_runs);

            if (data.season_performance) {
                drawSeasonTrendChart(data.season_performance);
            }

            updatePlayerProfile(data.player_profile);

            // Fetch Standings
            loadStandings();
            loadTeamComparison();

            if (statusMsg) statusMsg.textContent = "Dashboard loaded successfully.";
        } catch (err) {
            console.error("Dashboard error:", err);
            if (statusMsg) statusMsg.textContent = "Error: " + err.message;
        }
    }

    // --------------------------------------------------
    // Load Standings Data
    // --------------------------------------------------
    async function loadStandings() {
        try {
            const season = seasonFilter ? seasonFilter.value : "all";
            const res = await fetch(`/api/teams?season=${season}`);
            const standings = await res.json();
            if (!res.ok) return;

            standingsData = standings;
            renderStandingsTable(standingsData);
        } catch (e) {
            console.error("Standings load error:", e);
        }
    }

    // --------------------------------------------------
    // Load Team Comparison
    // --------------------------------------------------
    async function loadTeamComparison() {
        try {
            const t1 = compTeam1 ? compTeam1.value : "CSK";
            const t2 = compTeam2 ? compTeam2.value : "MI";
            const season = seasonFilter ? seasonFilter.value : "all";

            const res = await fetch(`/api/team-comparison?team1=${t1}&team2=${t2}&season=${season}`);
            const data = await res.json();
            if (!res.ok) return;

            drawTeamComparisonChart(data.team1, data.team2);
        } catch (e) {
            console.error("Team comparison error:", e);
        }
    }

    // --------------------------------------------------
    // Update Filter Options
    // --------------------------------------------------
    function updateFilterOptions(filters) {
        if (!filters) return;

        if (seasonFilter && seasonFilter.options.length <= 1) {
            filters.seasons.forEach(s => {
                const opt = document.createElement("option");
                opt.value = s;
                opt.textContent = s;
                seasonFilter.appendChild(opt);
            });
        }

        if (teamFilter && teamFilter.options.length <= 1) {
            filters.teams.forEach(t => {
                const opt = document.createElement("option");
                opt.value = t;
                opt.textContent = t;
                teamFilter.appendChild(opt);
            });
        }

        if (playerFilter && playerFilter.options.length <= 1) {
            filters.players.forEach(p => {
                const opt = document.createElement("option");
                opt.value = p;
                opt.textContent = p;
                playerFilter.appendChild(opt);
            });
        }
    }

    // --------------------------------------------------
    // Update KPI Cards
    // --------------------------------------------------
    function updateKPIs(metrics) {
        if (!metrics) return;
        document.getElementById("total-runs").textContent = (metrics.total_runs || 0).toLocaleString();
        document.getElementById("total-fours").textContent = (metrics.total_fours || 0).toLocaleString();
        document.getElementById("total-sixes").textContent = (metrics.total_sixes || 0).toLocaleString();
        document.getElementById("strike-rate").textContent = (metrics.strike_rate || 0).toFixed(2);
    }

    // --------------------------------------------------
    // Update Quick Insights
    // --------------------------------------------------
    function updateQuickInsights(insights) {
        if (!insights) return;

        if (insights.top_scorer) {
            document.getElementById("insight-top-scorer").textContent = insights.top_scorer.player || "N/A";
            document.getElementById("insight-top-scorer-val").textContent = `${(insights.top_scorer.runs || 0).toLocaleString()} Runs`;
        }

        if (insights.most_sixes) {
            document.getElementById("insight-sixes-player").textContent = insights.most_sixes.player || "N/A";
            document.getElementById("insight-sixes-val").textContent = `${(insights.most_sixes.sixes || 0).toLocaleString()} Sixes`;
        }

        if (insights.best_strike_rate) {
            document.getElementById("insight-sr-player").textContent = insights.best_strike_rate.player || "N/A";
            document.getElementById("insight-sr-val").textContent = `${insights.best_strike_rate.strike_rate || 0} SR`;
        }

        if (insights.top_team) {
            document.getElementById("insight-team-name").textContent = insights.top_team.full_name || insights.top_team.team_code || "N/A";
            document.getElementById("insight-team-val").textContent = `${(insights.top_team.runs || 0).toLocaleString()} Team Runs`;
        }
    }

    // --------------------------------------------------
    // Update Top Performers Showcase Cards
    // --------------------------------------------------
    function updateTopPerformers(performers) {
        if (!performers || performers.length < 4) return;

        for (let i = 0; i < 4; i++) {
            const item = performers[i];
            const nameEl = document.getElementById(`perf-${i + 1}-name`);
            const valEl = document.getElementById(`perf-${i + 1}-val`);

            if (nameEl) nameEl.textContent = item.player;
            if (valEl) valEl.textContent = item.value;
        }
    }

    // --------------------------------------------------
    // Render Runs by Player (Horizontal Bar Chart)
    // --------------------------------------------------
    function drawRunsChart(list, limit) {
        if (!list || list.length === 0) return;
        const topList = list.slice(0, limit).reverse();

        const trace = {
            type: "bar",
            orientation: "h",
            x: topList.map(item => item.runs),
            y: topList.map(item => item.player),
            marker: {
                color: topList.map((_, i) => `rgba(37, 99, 235, ${0.4 + (i / topList.length) * 0.6})`),
                line: { color: COLORS.blue, width: 1.5 }
            },
            text: topList.map(item => item.runs.toLocaleString()),
            textposition: "inside",
            insidetextanchor: "end",
            hovertemplate: "<b>%{y}</b><br>Runs: %{x:,}<extra></extra>"
        };

        const layout = {
            ...plotlyLayoutBase,
            xaxis: { title: "Total Runs", gridcolor: "#E2E8F0" },
            yaxis: { title: "", automargin: true },
            margin: { t: 10, r: 20, l: 120, b: 40 }
        };

        Plotly.react("runs-chart", [trace], layout, plotlyConfig);
    }

    // --------------------------------------------------
    // Render Runs vs Strike Rate (Scatter Plot)
    // --------------------------------------------------
    function drawStrikeChart(scatter, avgSR, limit) {
        if (!scatter || scatter.length === 0) return;
        const topScatter = scatter.slice(0, Math.max(limit * 3, 30));

        const trace = {
            type: "scatter",
            mode: "markers+text",
            x: topScatter.map(item => item.runs),
            y: topScatter.map(item => item.strike_rate),
            text: topScatter.slice(0, limit).map(item => item.player),
            textposition: "top center",
            marker: {
                size: topScatter.map(item => Math.max(8, Math.min(item.runs / 250, 24))),
                color: topScatter.map(item => item.strike_rate >= 140 ? COLORS.emerald : COLORS.blue),
                opacity: 0.85,
                line: { color: "#FFFFFF", width: 1.5 }
            },
            hovertemplate: "<b>%{text}</b><br>Runs: %{x:,}<br>Strike Rate: %{y:.2f}<extra></extra>"
        };

        const layout = {
            ...plotlyLayoutBase,
            xaxis: { title: "Total Runs", gridcolor: "#E2E8F0" },
            yaxis: { title: "Strike Rate (Runs / 100 balls)", gridcolor: "#E2E8F0" },
            shapes: [
                {
                    type: "line",
                    x0: 0,
                    x1: Math.max(...topScatter.map(i => i.runs)),
                    y0: avgSR || 130,
                    y1: avgSR || 130,
                    line: { color: COLORS.amber, width: 2, dash: "dash" }
                }
            ],
            annotations: [
                {
                    x: Math.max(...topScatter.map(i => i.runs)) * 0.8,
                    y: (avgSR || 130) + 3,
                    text: `Avg SR: ${(avgSR || 0).toFixed(1)}`,
                    showarrow: false,
                    font: { color: COLORS.amber, size: 12, weight: 700 }
                }
            ],
            margin: { t: 20, r: 20, l: 50, b: 50 }
        };

        Plotly.react("strike-chart", [trace], layout, plotlyConfig);
    }

    // --------------------------------------------------
    // Render 50s and 100s by Player
    // --------------------------------------------------
    function drawMilestonesChart(milestones, limit) {
        if (!milestones || milestones.length === 0) return;
        const top = milestones.slice(0, limit);

        const trace50 = {
            name: "50s",
            type: "bar",
            x: top.map(i => i.player),
            y: top.map(i => i.fifties),
            marker: { color: COLORS.amber, cornerradius: 4 },
            hovertemplate: "<b>%{x}</b><br>50s: %{y}<extra></extra>"
        };

        const trace100 = {
            name: "100s",
            type: "bar",
            x: top.map(i => i.player),
            y: top.map(i => i.hundreds),
            marker: { color: COLORS.purple, cornerradius: 4 },
            hovertemplate: "<b>%{x}</b><br>100s: %{y}<extra></extra>"
        };

        const layout = {
            ...plotlyLayoutBase,
            barmode: "group",
            xaxis: { title: "", tickangle: -30, automargin: true },
            yaxis: { title: "Milestones Count", gridcolor: "#E2E8F0" },
            legend: { orientation: "h", y: 1.15, x: 0.5, xanchor: "center" },
            margin: { t: 30, r: 20, l: 50, b: 70 }
        };

        Plotly.react("milestones-chart", [trace50, trace100], layout, plotlyConfig);
    }

    // --------------------------------------------------
    // Render Fours and Sixes by Player
    // --------------------------------------------------
    function drawBoundariesChart(boundaries, limit) {
        if (!boundaries || boundaries.length === 0) return;
        const top = boundaries.slice(0, limit);

        const traceFours = {
            name: "Fours (4s)",
            type: "bar",
            x: top.map(i => i.player),
            y: top.map(i => i.fours),
            marker: { color: COLORS.cyan, cornerradius: 4 },
            hovertemplate: "<b>%{x}</b><br>Fours: %{y}<extra></extra>"
        };

        const traceSixes = {
            name: "Sixes (6s)",
            type: "bar",
            x: top.map(i => i.player),
            y: top.map(i => i.sixes),
            marker: { color: COLORS.indigo, cornerradius: 4 },
            hovertemplate: "<b>%{x}</b><br>Sixes: %{y}<extra></extra>"
        };

        const layout = {
            ...plotlyLayoutBase,
            barmode: "group",
            xaxis: { title: "", tickangle: -30, automargin: true },
            yaxis: { title: "Boundary Count", gridcolor: "#E2E8F0" },
            legend: { orientation: "h", y: 1.15, x: 0.5, xanchor: "center" },
            margin: { t: 30, r: 20, l: 50, b: 70 }
        };

        Plotly.react("boundaries-chart", [traceFours, traceSixes], layout, plotlyConfig);
    }

    // --------------------------------------------------
    // Render Runs by Team (Donut Chart)
    // --------------------------------------------------
    function drawTeamsChart(teamRuns, totalRuns) {
        if (!teamRuns || teamRuns.length === 0) return;

        const trace = {
            type: "pie",
            labels: teamRuns.map(i => i.team_name),
            values: teamRuns.map(i => i.runs),
            hole: 0.6,
            marker: {
                colors: [
                    COLORS.blue, COLORS.indigo, COLORS.cyan, COLORS.purple,
                    COLORS.emerald, COLORS.amber, COLORS.rose, "#3B82F6",
                    "#6366F1", "#14B8A6"
                ]
            },
            textinfo: "label+percent",
            textposition: "outside",
            hovertemplate: "<b>%{label}</b><br>Runs: %{value:,}<br>Share: %{percent}<extra></extra>"
        };

        const layout = {
            ...plotlyLayoutBase,
            showlegend: false,
            annotations: [
                {
                    font: { size: 18, weight: 800, color: COLORS.navy, family: "Barlow Condensed" },
                    showarrow: false,
                    text: `Total Runs<br><b>${(totalRuns || 0).toLocaleString()}</b>`,
                    x: 0.5,
                    y: 0.5
                }
            ],
            margin: { t: 20, r: 20, l: 20, b: 20 }
        };

        Plotly.react("teams-chart", [trace], layout, plotlyConfig);
    }

    // --------------------------------------------------
    // Render IPL Performance by Season
    // --------------------------------------------------
    function drawSeasonTrendChart(seasonPerf) {
        if (!seasonPerf || seasonPerf.length === 0) return;

        const traceRuns = {
            name: "Total Runs",
            type: "bar",
            x: seasonPerf.map(i => i.season),
            y: seasonPerf.map(i => i.runs),
            marker: { color: COLORS.blue, opacity: 0.8 },
            hovertemplate: "Season %{x}<br>Total Runs: %{y:,}<extra></extra>"
        };

        const traceSR = {
            name: "Avg Strike Rate",
            type: "scatter",
            mode: "lines+markers",
            yaxis: "y2",
            x: seasonPerf.map(i => i.season),
            y: seasonPerf.map(i => i.strike_rate),
            line: { color: COLORS.amber, width: 3 },
            marker: { size: 8, color: COLORS.amber },
            hovertemplate: "Season %{x}<br>Avg Strike Rate: %{y:.2f}<extra></extra>"
        };

        const layout = {
            ...plotlyLayoutBase,
            xaxis: { title: "Season", dtick: 1 },
            yaxis: { title: "Total Runs Scored", gridcolor: "#E2E8F0" },
            yaxis2: {
                title: "Avg Strike Rate",
                overlaying: "y",
                side: "right",
                showgrid: false
            },
            legend: { orientation: "h", y: 1.12, x: 0.5, xanchor: "center" },
            margin: { t: 30, r: 50, l: 50, b: 40 }
        };

        Plotly.react("season-trend-chart", [traceRuns, traceSR], layout, plotlyConfig);
    }

    // --------------------------------------------------
    // Update Player Profile View
    // --------------------------------------------------
    function updatePlayerProfile(profile) {
        const view = document.getElementById("player-profile-view");
        const placeholder = document.getElementById("player-profile-placeholder");

        if (!profile) {
            if (view) view.style.display = "none";
            if (placeholder) placeholder.style.display = "block";
            return;
        }

        if (view) view.style.display = "block";
        if (placeholder) placeholder.style.display = "none";

        document.getElementById("p-avatar").textContent = profile.player.charAt(0);
        document.getElementById("p-name").textContent = profile.player;
        document.getElementById("p-summary").textContent = `IPL Career Stats • ${profile.seasons.length} Active Seasons`;

        document.getElementById("p-matches").textContent = profile.matches.toLocaleString();
        document.getElementById("p-runs").textContent = profile.runs.toLocaleString();
        document.getElementById("p-sr").textContent = profile.strike_rate.toFixed(2);
        document.getElementById("p-milestones").textContent = `${profile.fifties} / ${profile.hundreds}`;

        // Draw Player Season Charts
        const traceRuns = {
            type: "bar",
            x: profile.seasons.map(s => s.season),
            y: profile.seasons.map(s => s.runs),
            marker: { color: COLORS.blue },
            name: "Runs"
        };
        const layoutRuns = {
            ...plotlyLayoutBase,
            title: { text: "Runs by Season", font: { size: 14, weight: 700 } },
            margin: { t: 40, r: 20, l: 40, b: 30 }
        };
        Plotly.react("player-season-runs-chart", [traceRuns], layoutRuns, plotlyConfig);

        const traceSR = {
            type: "scatter",
            mode: "lines+markers",
            x: profile.seasons.map(s => s.season),
            y: profile.seasons.map(s => s.strike_rate),
            line: { color: COLORS.purple, width: 3 },
            name: "Strike Rate"
        };
        const layoutSR = {
            ...plotlyLayoutBase,
            title: { text: "Strike Rate by Season", font: { size: 14, weight: 700 } },
            margin: { t: 40, r: 20, l: 40, b: 30 }
        };
        Plotly.react("player-season-sr-chart", [traceSR], layoutSR, plotlyConfig);
    }

    // --------------------------------------------------
    // Draw Team Comparison Radar / Bar Chart
    // --------------------------------------------------
    function drawTeamComparisonChart(t1, t2) {
        if (!t1 || !t2) return;

        const metrics = ["Matches", "Wins", "Win %", "Total Runs (/100)", "Boundaries (4s+6s)"];
        const values1 = [
            t1.matches,
            t1.wins,
            t1.win_pct,
            Math.round(t1.total_runs / 100),
            t1.fours + t1.sixes
        ];
        const values2 = [
            t2.matches,
            t2.wins,
            t2.win_pct,
            Math.round(t2.total_runs / 100),
            t2.fours + t2.sixes
        ];

        const trace1 = {
            name: t1.team_name,
            type: "bar",
            x: metrics,
            y: values1,
            marker: { color: COLORS.blue }
        };

        const trace2 = {
            name: t2.team_name,
            type: "bar",
            x: metrics,
            y: values2,
            marker: { color: COLORS.amber }
        };

        const layout = {
            ...plotlyLayoutBase,
            barmode: "group",
            xaxis: { title: "" },
            yaxis: { title: "Metric Value", gridcolor: "#E2E8F0" },
            legend: { orientation: "h", y: 1.12, x: 0.5, xanchor: "center" }
        };

        Plotly.react("team-comparison-chart", [trace1, trace2], layout, plotlyConfig);
    }

    // --------------------------------------------------
    // Render Standings Table
    // --------------------------------------------------
    function renderStandingsTable(data) {
        const tbody = document.getElementById("standings-table-body");
        if (!tbody) return;

        if (!data || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 20px;">No standings data available.</td></tr>`;
            return;
        }

        const query = tableSearchInput ? tableSearchInput.value.toLowerCase().trim() : "";

        const filtered = data.filter(row => {
            if (!query) return true;
            return (row.team || "").toLowerCase().includes(query) || (row.team_code || "").toLowerCase().includes(query);
        });

        tbody.innerHTML = filtered.map(row => {
            const posClass = row.position <= 3 ? `rank-${row.position}` : "";
            const winPct = row.matches > 0 ? ((row.wins / row.matches) * 100).toFixed(1) : "0.0";
            return `
                <tr>
                    <td><span class="rank-badge ${posClass}">${row.position}</span></td>
                    <td class="team-badge-cell"><b>${row.team}</b> (${row.team_code || row.team})</td>
                    <td>${row.matches}</td>
                    <td><b style="color: ${COLORS.emerald}">${row.wins}</b></td>
                    <td><span style="color: ${COLORS.rose}">${row.defeats}</span></td>
                    <td>${row.ties || 0}</td>
                    <td><b>${row.points}</b></td>
                    <td>${winPct}%</td>
                    <td>${(row.nrr || 0).toFixed(3)}</td>
                </tr>
            `;
        }).join("");
    }

    // --------------------------------------------------
    // Global Search Autocomplete
    // --------------------------------------------------
    if (globalSearch && searchResults) {
        globalSearch.addEventListener("input", function () {
            const val = this.value.toLowerCase().trim();
            if (!val || !rawData) {
                searchResults.classList.remove("active");
                return;
            }

            const matches = [];

            // Search Players
            rawData.filters.players.forEach(p => {
                if (p.toLowerCase().includes(val)) {
                    matches.push({ type: "Player", name: p });
                }
            });

            // Search Teams
            rawData.filters.teams.forEach(t => {
                if (t.toLowerCase().includes(val)) {
                    matches.push({ type: "Team", name: t });
                }
            });

            if (matches.length === 0) {
                searchResults.classList.remove("active");
                return;
            }

            searchResults.innerHTML = matches.slice(0, 8).map(m => `
                <div class="search-result-item" data-type="${m.type}" data-name="${m.name}">
                    <span><b>${m.name}</b></span>
                    <span style="font-size: 11px; color: var(--blue-accent); font-weight: 700;">${m.type}</span>
                </div>
            `).join("");

            searchResults.classList.add("active");
        });

        searchResults.addEventListener("click", function (e) {
            const item = e.target.closest(".search-result-item");
            if (!item) return;

            const type = item.dataset.type;
            const name = item.dataset.name;

            if (type === "Player" && playerFilter) {
                playerFilter.value = name;
                loadDashboard();
            } else if (type === "Team" && teamFilter) {
                teamFilter.value = name;
                loadDashboard();
            }

            globalSearch.value = "";
            searchResults.classList.remove("active");
        });

        document.addEventListener("click", function (e) {
            if (!globalSearch.contains(e.target) && !searchResults.contains(e.target)) {
                searchResults.classList.remove("active");
            }
        });
    }

    // --------------------------------------------------
    // Event Listeners
    // --------------------------------------------------
    if (applyBtn) applyBtn.addEventListener("click", loadDashboard);

    if (clearBtn) {
        clearBtn.addEventListener("click", function () {
            if (seasonFilter) seasonFilter.value = "all";
            if (teamFilter) teamFilter.value = "all";
            if (playerFilter) playerFilter.value = "all";
            loadDashboard();
        });
    }

    if (seasonFilter) seasonFilter.addEventListener("change", loadDashboard);
    if (teamFilter) teamFilter.addEventListener("change", loadDashboard);
    if (playerFilter) playerFilter.addEventListener("change", loadDashboard);

    if (topLimitFilter) {
        topLimitFilter.addEventListener("change", function () {
            if (rawData) {
                const limit = parseInt(this.value, 10);
                drawRunsChart(rawData.runs_by_player, limit);
                drawStrikeChart(rawData.scatter, rawData.metrics.strike_rate, limit);
                drawMilestonesChart(rawData.milestones, limit);
                drawBoundariesChart(rawData.boundaries, limit);
            }
        });
    }

    if (tableSearchInput) {
        tableSearchInput.addEventListener("input", () => renderStandingsTable(standingsData));
    }

    if (compTeam1 && compTeam2) {
        compTeam1.addEventListener("change", loadTeamComparison);
        compTeam2.addEventListener("change", loadTeamComparison);
    }

    // Initialize Dashboard
    loadDashboard();
});