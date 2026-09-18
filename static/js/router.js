// ==================================================
// IPL CRICKET ANALYTICS - SPA ROUTER & APP CONTROLLER
// ==================================================

document.addEventListener("DOMContentLoaded", () => {
    // Router Initialization
    const router = new AppRouter();
    router.init();
});

class AppRouter {
    constructor() {
        this.currentRoute = "/dashboard";
        this.routes = {
            "/": this.renderDashboard.bind(this),
            "/dashboard": this.renderDashboard.bind(this),
            "/teams": this.renderTeams.bind(this),
            "/players": this.renderPlayers.bind(this),
            "/matches": this.renderMatches.bind(this),
            "/analysis": this.renderAnalysis.bind(this),
            "/reports": this.renderReports.bind(this),
            "/settings": this.renderSettings.bind(this)
        };

        this.plotlyConfig = { responsive: true, displayModeBar: false };
        this.plotlyLayoutBase = {
            font: { family: "Inter, sans-serif", color: "#0F172A" },
            paper_bgcolor: "rgba(0,0,0,0)",
            plot_bgcolor: "rgba(0,0,0,0)",
            margin: { t: 30, r: 20, l: 50, b: 50 },
            hoverlabel: { bgcolor: "#0F172A", font: { color: "#FFFFFF" } }
        };

        this.teamLogos = {
            "CSK": "/static/images/CSK.jpg",
            "DC": "/static/images/DC.jpg",
            "GT": "/static/images/GT.png",
            "KKR": "/static/images/KKR.jpg",
            "LSG": "/static/images/LSG.png",
            "MI": "/static/images/MI.png",
            "PBKS": "/static/images/PBSK.jpg",
            "PBSK": "/static/images/PBSK.jpg",
            "RCB": "/static/images/RCB.png",
            "RR": "/static/images/RR.jpg",
            "SRH": "/static/images/SRH.jpg"
        };
    }

    init() {
        // Intercept Link Clicks
        document.addEventListener("click", (e) => {
            const link = e.target.closest("[data-link]");
            if (link) {
                e.preventDefault();
                const href = link.getAttribute("href");
                this.navigate(href);
            }
        });

        // Listen for Browser Back/Forward
        window.addEventListener("popstate", () => {
            this.handleRoute(window.location.pathname);
        });

        // Mobile Nav Toggle
        const mobileToggle = document.getElementById("mobile-nav-toggle");
        const sidebar = document.getElementById("sidebar");
        if (mobileToggle && sidebar) {
            mobileToggle.addEventListener("click", () => sidebar.classList.toggle("sidebar-open"));
        }

        // Setup Global Search
        this.setupGlobalSearch();

        // Initial Route
        this.handleRoute(window.location.pathname);
    }

    navigate(path) {
        window.history.pushState({}, "", path);
        this.handleRoute(path);
    }

    handleRoute(path) {
        // Close Mobile Sidebar
        const sidebar = document.getElementById("sidebar");
        if (sidebar) sidebar.classList.remove("sidebar-open");

        // Match Dynamic Routes
        if (path.startsWith("/teams/") && path.length > 7) {
            const teamId = path.split("/teams/")[1];
            this.renderTeamDetail(teamId);
            return;
        }

        if (path.startsWith("/players/") && path.length > 9) {
            const playerId = decodeURIComponent(path.split("/players/")[1]);
            this.renderPlayerDetail(playerId);
            return;
        }

        if (path.startsWith("/matches/") && path.length > 9) {
            const matchId = path.split("/matches/")[1];
            this.renderMatchDetail(matchId);
            return;
        }

        const handler = this.routes[path] || this.routes["/dashboard"];
        handler();
    }

    switchView(viewId, activeNavId, crumbText) {
        // Hide all views
        document.querySelectorAll(".page-view").forEach(v => v.classList.remove("active"));
        const targetView = document.getElementById(viewId);
        if (targetView) targetView.classList.add("active");

        // Update Active Sidebar Pill
        document.querySelectorAll(".side-nav a").forEach(a => a.classList.remove("active"));
        const activeNav = document.getElementById(activeNavId);
        if (activeNav) activeNav.classList.add("active");

        // Update Breadcrumbs
        const crumb = document.getElementById("current-crumb");
        if (crumb) crumb.textContent = crumbText;

        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    // --------------------------------------------------
    // ROUTE 1: DASHBOARD (/dashboard)
    // --------------------------------------------------
    async renderDashboard() {
        this.switchView("view-dashboard", "nav-dashboard", "Dashboard Overview");
        try {
            const res = await fetch("/api/dashboard");
            const data = await res.json();
            if (!res.ok) return;

            document.getElementById("dash-total-runs").textContent = (data.metrics.total_runs || 0).toLocaleString();
            document.getElementById("dash-total-fours").textContent = (data.metrics.total_fours || 0).toLocaleString();
            document.getElementById("dash-total-sixes").textContent = (data.metrics.total_sixes || 0).toLocaleString();
            document.getElementById("dash-strike-rate").textContent = (data.metrics.strike_rate || 0).toFixed(2);

            if (data.quick_insights.top_scorer) {
                document.getElementById("dash-insight-top-scorer").textContent = data.quick_insights.top_scorer.player;
                document.getElementById("dash-insight-top-scorer-val").textContent = `${data.quick_insights.top_scorer.runs.toLocaleString()} Runs`;
            }

            if (data.quick_insights.most_sixes) {
                document.getElementById("dash-insight-sixes-player").textContent = data.quick_insights.most_sixes.player;
                document.getElementById("dash-insight-sixes-val").textContent = `${data.quick_insights.most_sixes.sixes} Sixes`;
            }

            if (data.quick_insights.best_strike_rate) {
                document.getElementById("dash-insight-sr-player").textContent = data.quick_insights.best_strike_rate.player;
                document.getElementById("dash-insight-sr-val").textContent = `${data.quick_insights.best_strike_rate.strike_rate} SR`;
            }

            if (data.quick_insights.top_team) {
                document.getElementById("dash-insight-team-name").textContent = data.quick_insights.top_team.full_name;
                document.getElementById("dash-insight-team-val").textContent = `${data.quick_insights.top_team.runs.toLocaleString()} Runs`;
            }

            // Overview Charts
            const topRuns = data.runs_by_player.slice(0, 10).reverse();
            Plotly.react("dash-runs-chart", [{
                type: "bar", orientation: "h",
                x: topRuns.map(i => i.runs), y: topRuns.map(i => i.player),
                marker: { color: "#2563EB" }
            }], { ...this.plotlyLayoutBase, margin: { t: 10, r: 20, l: 120, b: 30 } }, this.plotlyConfig);

            const topScatter = data.scatter.slice(0, 25);
            Plotly.react("dash-strike-chart", [{
                type: "scatter", mode: "markers+text",
                x: topScatter.map(i => i.runs), y: topScatter.map(i => i.strike_rate),
                text: topScatter.slice(0, 10).map(i => i.player), textposition: "top center",
                marker: { size: 12, color: "#4F46E5" }
            }], { ...this.plotlyLayoutBase, xaxis: { title: "Runs" }, yaxis: { title: "Strike Rate" } }, this.plotlyConfig);

            Plotly.react("dash-teams-chart", [{
                type: "pie", labels: data.team_runs.map(i => i.team_name), values: data.team_runs.map(i => i.runs), hole: 0.5
            }], { ...this.plotlyLayoutBase, showlegend: false }, this.plotlyConfig);

            const topMS = data.milestones.slice(0, 8);
            Plotly.react("dash-milestones-chart", [
                { name: "50s", type: "bar", x: topMS.map(i => i.player), y: topMS.map(i => i.fifties), marker: { color: "#F59E0B" } },
                { name: "100s", type: "bar", x: topMS.map(i => i.player), y: topMS.map(i => i.hundreds), marker: { color: "#8B5CF6" } }
            ], { ...this.plotlyLayoutBase, barmode: "group" }, this.plotlyConfig);

            const topBound = data.boundaries.slice(0, 8);
            Plotly.react("dash-boundaries-chart", [
                { name: "Fours", type: "bar", x: topBound.map(i => i.player), y: topBound.map(i => i.fours), marker: { color: "#06B6D4" } },
                { name: "Sixes", type: "bar", x: topBound.map(i => i.player), y: topBound.map(i => i.sixes), marker: { color: "#2563EB" } }
            ], { ...this.plotlyLayoutBase, barmode: "group" }, this.plotlyConfig);

            // Initialize 3D Dashboard Hero
            if (window.ipl3DManager) {
                window.ipl3DManager.initDashboardHero3D("dashboard-hero-3d");
            }

        } catch (err) { console.error("Dashboard render error:", err); }
    }

    // --------------------------------------------------
    // ROUTE 2: TEAMS DIRECTORY (/teams)
    // --------------------------------------------------
    async renderTeams() {
        this.switchView("view-teams", "nav-teams", "Teams Directory");
        try {
            const res = await fetch("/api/teams");
            const teams = await res.json();
            if (!res.ok) return;

            const container = document.getElementById("teams-cards-container");
            container.innerHTML = teams.map(t => {
                const logoUrl = this.teamLogos[t.team_code] || `/static/images/${t.team_code}.png`;
                return `
                <div class="team-card-item">
                    <div class="team-card-header">
                        <div class="team-card-avatar">
                            <img src="${logoUrl}" alt="${t.team}" class="team-logo-img" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline';">
                            <span class="team-avatar-fallback" style="display:none;">${t.team_code}</span>
                        </div>
                        <div>
                            <h3 style="font-size: 18px; font-weight: 800;">${t.team}</h3>
                            <span style="font-size: 12px; color: var(--text-muted);">${t.titles > 0 ? '🏆 ' + t.titles + ' IPL Titles' : 'IPL Franchise'}</span>
                        </div>
                    </div>`;
            }).map((header, idx) => {
                const t = teams[idx];
                return header + `
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; background: var(--bg-input); padding: 12px; border-radius: var(--radius-md); text-align: center;">
                        <div><label style="font-size: 10px; color: var(--text-subtle);">MATCHES</label><strong style="display: block; font-size: 16px;">${t.matches}</strong></div>
                        <div><label style="font-size: 10px; color: var(--text-subtle);">WINS</label><strong style="display: block; font-size: 16px; color: var(--emerald-accent);">${t.wins}</strong></div>
                        <div><label style="font-size: 10px; color: var(--text-subtle);">WIN %</label><strong style="display: block; font-size: 16px; color: var(--blue-accent);">${t.win_pct}%</strong></div>
                    </div>
                    <a href="/teams/${t.team_code}" class="btn-primary" style="text-align: center;" data-link>View Franchise Details →</a>
                </div>`;
            }).join("");

            // Initialize 3D Team Card Tilt Hover Effects
            if (window.ipl3DManager) {
                window.ipl3DManager.initTeamCard3DEffects(document.querySelectorAll(".team-card-item"));
            }
        } catch (err) { console.error("Teams render error:", err); }
    }

    // --------------------------------------------------
    // ROUTE 3: TEAM DETAIL (/teams/:teamId)
    // --------------------------------------------------
    async renderTeamDetail(teamCode) {
        this.switchView("view-team-detail", "nav-teams", `Teams / ${teamCode}`);
        try {
            const res = await fetch(`/api/teams/${teamCode}`);
            const data = await res.json();
            if (!res.ok) return;

            const teamAvatarEl = document.getElementById("team-detail-avatar");
            if (teamAvatarEl) {
                const logoUrl = this.teamLogos[data.team_code] || `/static/images/${data.team_code}.png`;
                teamAvatarEl.innerHTML = `
                    <img src="${logoUrl}" alt="${data.team_name}" class="team-detail-logo-img" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline';">
                    <span class="team-avatar-fallback" style="display:none;">${data.team_code}</span>
                `;
            }
            document.getElementById("team-detail-title").textContent = data.team_name;
            document.getElementById("team-detail-subtitle").textContent = `${data.titles} IPL Titles • Franchise Career Analytics`;

            document.getElementById("td-matches").textContent = data.matches;
            document.getElementById("td-wins").textContent = `${data.wins} / ${data.defeats}`;
            document.getElementById("td-winpct").textContent = `${data.win_pct}%`;
            document.getElementById("td-titles").textContent = data.titles;

            // Season Charts
            Plotly.react("team-season-runs-chart", [{
                type: "bar", x: data.season_history.map(s => s.season), y: data.season_history.map(s => s.runs), marker: { color: "#2563EB" }
            }], { ...this.plotlyLayoutBase, margin: { t: 20, r: 20, l: 40, b: 30 } }, this.plotlyConfig);

            Plotly.react("team-season-boundaries-chart", [
                { name: "Fours", type: "bar", x: data.season_history.map(s => s.season), y: data.season_history.map(s => s.fours), marker: { color: "#06B6D4" } },
                { name: "Sixes", type: "bar", x: data.season_history.map(s => s.season), y: data.season_history.map(s => s.sixes), marker: { color: "#8B5CF6" } }
            ], { ...this.plotlyLayoutBase, barmode: "group", margin: { t: 20, r: 20, l: 40, b: 30 } }, this.plotlyConfig);

            // Roster Table
            const tbody = document.getElementById("team-top-players-body");
            tbody.innerHTML = data.top_players.map(p => `
                <tr>
                    <td><a href="/players/${encodeURIComponent(p.player)}" style="font-weight: 700; color: var(--blue-accent); text-decoration: none;" data-link>${p.player}</a></td>
                    <td>${p.matches}</td>
                    <td><b>${p.runs.toLocaleString()}</b></td>
                    <td>${p.strike_rate}</td>
                    <td>${p.fours}</td>
                    <td>${p.sixes}</td>
                </tr>
            `).join("");
        } catch (err) { console.error("Team Detail render error:", err); }
    }

    // --------------------------------------------------
    // ROUTE 4: PLAYERS DIRECTORY (/players)
    // --------------------------------------------------
    async renderPlayers(page = 1) {
        this.switchView("view-players", "nav-players", "Players Analytics");
        try {
            const search = document.getElementById("players-search-input")?.value || "";
            const season = document.getElementById("players-season-filter")?.value || "all";
            const team = document.getElementById("players-team-filter")?.value || "all";
            const minRuns = document.getElementById("players-min-runs")?.value || "0";

            const res = await fetch(`/api/players?search=${encodeURIComponent(search)}&season=${season}&team=${team}&min_runs=${minRuns}&page=${page}&limit=15`);
            const data = await res.json();
            if (!res.ok) return;

            // Populate filter options dynamically
            if (!this.playersFiltersPopulated && data.filter_options) {
                const seasonSel = document.getElementById("players-season-filter");
                if (seasonSel && data.filter_options.seasons) {
                    const currentSeason = seasonSel.value;
                    seasonSel.innerHTML = '<option value="all">All Seasons</option>' +
                        data.filter_options.seasons.map(s => `<option value="${s}" ${String(s) === String(currentSeason) ? 'selected' : ''}>Season ${s}</option>`).join("");
                }

                const teamSel = document.getElementById("players-team-filter");
                if (teamSel && data.filter_options.teams) {
                    const currentTeam = teamSel.value;
                    teamSel.innerHTML = '<option value="all">All Teams</option>' +
                        data.filter_options.teams.map(t => `<option value="${t.code}" ${t.code === currentTeam ? 'selected' : ''}>${t.name} (${t.code})</option>`).join("");
                }
                this.playersFiltersPopulated = true;
            }

            const tbody = document.getElementById("players-table-body");
            if (!data.players || data.players.length === 0) {
                tbody.innerHTML = `<tr><td colspan="11" style="text-align: center; padding: 24px; color: var(--text-muted);">No players found matching current filters.</td></tr>`;
            } else {
                tbody.innerHTML = data.players.map(p => `
                    <tr>
                        <td><span class="rank-badge ${p.rank <= 3 ? 'rank-' + p.rank : ''}">${p.rank}</span></td>
                        <td><b>${p.player}</b></td>
                        <td>${p.team}</td>
                        <td>${p.matches}</td>
                        <td><b>${p.runs.toLocaleString()}</b></td>
                        <td>${p.average}</td>
                        <td>${p.strike_rate}</td>
                        <td>${p.fours}</td>
                        <td>${p.sixes}</td>
                        <td>${p.fifties} / ${p.hundreds}</td>
                        <td><a href="/players/${encodeURIComponent(p.player)}" class="btn-primary" style="padding: 4px 10px; font-size: 11px;" data-link>View Profile</a></td>
                    </tr>
                `).join("");
            }

            // Sliding Window Pagination
            const pag = document.getElementById("players-pagination");
            let pagesHtml = "";
            if (data.pages > 1) {
                if (data.page > 1) {
                    pagesHtml += `<button class="page-btn" onclick="window.appRouter.renderPlayers(1)" title="First Page">«</button>`;
                    pagesHtml += `<button class="page-btn" onclick="window.appRouter.renderPlayers(${data.page - 1})" title="Previous Page">‹</button>`;
                }

                let startP = Math.max(1, data.page - 2);
                let endP = Math.min(data.pages, data.page + 2);

                if (startP > 1) {
                    pagesHtml += `<button class="page-btn" onclick="window.appRouter.renderPlayers(1)">1</button>`;
                    if (startP > 2) pagesHtml += `<span style="padding: 0 4px; color: var(--text-muted);">...</span>`;
                }

                for (let i = startP; i <= endP; i++) {
                    pagesHtml += `<button class="page-btn ${i === data.page ? 'active' : ''}" onclick="window.appRouter.renderPlayers(${i})">${i}</button>`;
                }

                if (endP < data.pages) {
                    if (endP < data.pages - 1) pagesHtml += `<span style="padding: 0 4px; color: var(--text-muted);">...</span>`;
                    pagesHtml += `<button class="page-btn" onclick="window.appRouter.renderPlayers(${data.pages})">${data.pages}</button>`;
                }

                if (data.page < data.pages) {
                    pagesHtml += `<button class="page-btn" onclick="window.appRouter.renderPlayers(${data.page + 1})" title="Next Page">›</button>`;
                    pagesHtml += `<button class="page-btn" onclick="window.appRouter.renderPlayers(${data.pages})" title="Last Page">»</button>`;
                }
            }
            pag.innerHTML = pagesHtml;

            // Wire filter handlers once
            if (!this.playersWired) {
                ["players-season-filter", "players-team-filter", "players-min-runs"].forEach(id => {
                    document.getElementById(id)?.addEventListener("change", () => this.renderPlayers(1));
                });
                let searchTimer;
                document.getElementById("players-search-input")?.addEventListener("input", () => {
                    clearTimeout(searchTimer);
                    searchTimer = setTimeout(() => this.renderPlayers(1), 300);
                });
                document.getElementById("players-reset-btn")?.addEventListener("click", () => this.resetPlayersFilters());
                this.playersWired = true;
            }
        } catch (err) { console.error("Players Directory render error:", err); }
    }

    resetPlayersFilters() {
        const s = document.getElementById("players-search-input");
        const season = document.getElementById("players-season-filter");
        const team = document.getElementById("players-team-filter");
        const minRuns = document.getElementById("players-min-runs");
        if (s) s.value = "";
        if (season) season.value = "all";
        if (team) team.value = "all";
        if (minRuns) minRuns.value = "0";
        this.renderPlayers(1);
    }

    // --------------------------------------------------
    // ROUTE 5: PLAYER DETAIL (/players/:playerId)
    // --------------------------------------------------
    async renderPlayerDetail(playerName) {
        this.switchView("view-player-detail", "nav-players", `Players / ${playerName}`);
        try {
            const res = await fetch(`/api/players/${encodeURIComponent(playerName)}`);
            const p = await res.json();
            if (!res.ok) return;

            document.getElementById("player-profile-avatar").textContent = p.player.charAt(0);
            document.getElementById("player-profile-name").textContent = p.player;
            document.getElementById("player-profile-teams").textContent = `Teams: ${p.teams} • Career Stats`;

            document.getElementById("pp-matches").textContent = p.matches;
            document.getElementById("pp-runs").textContent = p.runs.toLocaleString();
            document.getElementById("pp-avg").textContent = p.average;
            document.getElementById("pp-sr").textContent = p.strike_rate;
            document.getElementById("pp-hs").textContent = p.highest_score;
            document.getElementById("pp-boundaries").textContent = `${p.fours} / ${p.sixes}`;
            document.getElementById("pp-milestones").textContent = `${p.fifties} / ${p.hundreds}`;

            // Season Charts
            Plotly.react("pp-season-runs-chart", [{
                type: "bar", x: p.seasons.map(s => s.season), y: p.seasons.map(s => s.runs), marker: { color: "#2563EB" }
            }], { ...this.plotlyLayoutBase, margin: { t: 20, r: 20, l: 40, b: 30 } }, this.plotlyConfig);

            Plotly.react("pp-season-sr-chart", [{
                type: "scatter", mode: "lines+markers", x: p.seasons.map(s => s.season), y: p.seasons.map(s => s.strike_rate), line: { color: "#8B5CF6", width: 3 }
            }], { ...this.plotlyLayoutBase, margin: { t: 20, r: 20, l: 40, b: 30 } }, this.plotlyConfig);

            // Table
            const tbody = document.getElementById("pp-seasons-table-body");
            tbody.innerHTML = p.seasons.map(s => `
                <tr>
                    <td><b>Season ${s.season}</b></td>
                    <td>${s.matches}</td>
                    <td><b>${s.runs.toLocaleString()}</b></td>
                    <td>${s.average}</td>
                    <td>${s.strike_rate}</td>
                    <td>${s.fours}</td>
                    <td>${s.sixes}</td>
                    <td>${s.fifties}</td>
                    <td>${s.hundreds}</td>
                </tr>
            `).join("");

            // Initialize 3D Player Hologram Stage
            if (window.ipl3DManager) {
                window.ipl3DManager.initPlayer3DStage("player-3d-stage", {
                    runs: p.runs,
                    sr: p.strike_rate,
                    sixes: p.sixes,
                    fours: p.fours
                });
            }
        } catch (err) { console.error("Player Detail render error:", err); }
    }

    // --------------------------------------------------
    // ROUTE 6: MATCHES LOG (/matches)
    // --------------------------------------------------
    async renderMatches(page = 1) {
        this.switchView("view-matches", "nav-matches", "Match History");
        try {
            const search = document.getElementById("matches-search")?.value || "";
            const season = document.getElementById("matches-season")?.value || "all";
            const team = document.getElementById("matches-team")?.value || "all";
            const venue = document.getElementById("matches-venue")?.value || "all";

            const res = await fetch(`/api/matches?search=${encodeURIComponent(search)}&season=${season}&team=${team}&venue=${encodeURIComponent(venue)}&page=${page}&limit=12`);
            const data = await res.json();
            if (!res.ok) return;

            // Populate Filter Dropdowns dynamically
            if (!this.matchesFiltersPopulated && data.filter_options) {
                const seasonSel = document.getElementById("matches-season");
                if (seasonSel && data.filter_options.seasons) {
                    const currentSeason = seasonSel.value;
                    seasonSel.innerHTML = '<option value="all">All Seasons</option>' +
                        data.filter_options.seasons.map(s => `<option value="${s}" ${String(s) === String(currentSeason) ? 'selected' : ''}>Season ${s}</option>`).join("");
                }

                const teamSel = document.getElementById("matches-team");
                if (teamSel && data.filter_options.teams) {
                    const currentTeam = teamSel.value;
                    teamSel.innerHTML = '<option value="all">All Teams</option>' +
                        data.filter_options.teams.map(t => `<option value="${t.code}" ${t.code === currentTeam ? 'selected' : ''}>${t.name} (${t.code})</option>`).join("");
                }

                const venueSel = document.getElementById("matches-venue");
                if (venueSel && data.filter_options.venues) {
                    const currentVenue = venueSel.value;
                    venueSel.innerHTML = '<option value="all">All Venues</option>' +
                        data.filter_options.venues.map(v => `<option value="${v}" ${v === currentVenue ? 'selected' : ''}>${v}</option>`).join("");
                }

                this.matchesFiltersPopulated = true;
            }

            // Wire event listeners once
            if (!this.matchesWired) {
                ["matches-season", "matches-team", "matches-venue"].forEach(id => {
                    document.getElementById(id)?.addEventListener("change", () => this.renderMatches(1));
                });

                let searchTimer;
                document.getElementById("matches-search")?.addEventListener("input", () => {
                    clearTimeout(searchTimer);
                    searchTimer = setTimeout(() => this.renderMatches(1), 300);
                });

                document.getElementById("matches-reset-btn")?.addEventListener("click", () => this.resetMatchesFilters());

                this.matchesWired = true;
            }

            const container = document.getElementById("matches-list-container");
            const pag = document.getElementById("matches-pagination");

            if (!data.matches || data.matches.length === 0) {
                container.innerHTML = `
                    <div style="grid-column: 1 / -1; text-align: center; padding: 48px 24px; background: var(--bg-card); border-radius: var(--radius-lg); border: 1px solid var(--border-subtle);">
                        <div style="font-size: 40px; margin-bottom: 12px;">🏏</div>
                        <h3 style="font-size: 18px; font-weight: 800; margin-bottom: 6px;">No Matches Found</h3>
                        <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 16px;">Try adjusting your search or clearing your active filters.</p>
                        <button class="btn-primary" onclick="window.appRouter.resetMatchesFilters()">Reset All Filters</button>
                    </div>
                `;
                pag.innerHTML = "";
                return;
            }

            container.innerHTML = data.matches.map(m => {
                const t1Logo = this.teamLogos[m.team1] || `/static/images/${m.team1}.png`;
                const t2Logo = this.teamLogos[m.team2] || `/static/images/${m.team2}.png`;
                const isT1Winner = m.winner === m.team1 || m.winner_full === m.team1_full;
                const isT2Winner = m.winner === m.team2 || m.winner_full === m.team2_full;
                const locationStr = m.venue + (m.city ? ', ' + m.city : '');

                return `
                <div class="match-card-item">
                    <div class="match-card-top">
                        <span class="match-badge">SEASON ${m.season} • MATCH #${m.match_id}</span>
                        <span class="match-date">${m.date ? '📅 ' + m.date : ''}</span>
                    </div>

                    <div class="match-teams-box">
                        <div class="match-team-row ${isT1Winner ? 'winner-highlight' : ''}">
                            <div class="match-team-info">
                                <img src="${t1Logo}" alt="${m.team1}" class="match-team-logo" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-flex';">
                                <span class="match-team-fallback" style="display:none;">${m.team1}</span>
                                <div>
                                    <strong class="match-team-code">${m.team1}</strong>
                                    <span class="match-team-fullname" title="${m.team1_full}">${m.team1_full || m.team1}</span>
                                </div>
                            </div>
                            <div class="match-team-score ${isT1Winner ? 'winner-score' : ''}">
                                ${m.first_score !== 'N/A' ? m.first_score : '<span class="score-na">-</span>'}
                                ${isT1Winner ? '<span class="winner-trophy">🏆</span>' : ''}
                            </div>
                        </div>

                        <div class="match-vs-divider"><span>VS</span></div>

                        <div class="match-team-row ${isT2Winner ? 'winner-highlight' : ''}">
                            <div class="match-team-info">
                                <img src="${t2Logo}" alt="${m.team2}" class="match-team-logo" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-flex';">
                                <span class="match-team-fallback" style="display:none;">${m.team2}</span>
                                <div>
                                    <strong class="match-team-code">${m.team2}</strong>
                                    <span class="match-team-fullname" title="${m.team2_full}">${m.team2_full || m.team2}</span>
                                </div>
                            </div>
                            <div class="match-team-score ${isT2Winner ? 'winner-score' : ''}">
                                ${m.second_score !== 'N/A' ? m.second_score : '<span class="score-na">-</span>'}
                                ${isT2Winner ? '<span class="winner-trophy">🏆</span>' : ''}
                            </div>
                        </div>
                    </div>

                    <div class="match-venue-row" title="${locationStr}">
                        <span>📍 ${locationStr}</span>
                    </div>

                    <div class="match-result-banner">
                        <div class="match-result-text">
                            <strong>🏆 Winner:</strong> ${m.winner_full || m.winner} (${m.result_margin || 'Completed'})
                        </div>
                        ${m.player_of_match && m.player_of_match !== 'N/A' && m.player_of_match !== 'nan' ? `
                            <div class="match-potm-text">
                                <span>🎖️ Player of the Match:</span> <b>${m.player_of_match}</b>
                            </div>
                        ` : ''}
                    </div>

                    <a href="/matches/${m.match_id}" class="btn-primary" style="text-align: center; margin-top: auto;" data-link>View Match Scorecard →</a>
                </div>
            `}).join("");

            // Sliding Window Pagination
            let pagesHtml = "";
            if (data.pages > 1) {
                if (data.page > 1) {
                    pagesHtml += `<button class="page-btn" onclick="window.appRouter.renderMatches(1)" title="First Page">«</button>`;
                    pagesHtml += `<button class="page-btn" onclick="window.appRouter.renderMatches(${data.page - 1})" title="Previous Page">‹</button>`;
                }

                let startPage = Math.max(1, data.page - 2);
                let endPage = Math.min(data.pages, data.page + 2);

                if (startPage > 1) {
                    pagesHtml += `<button class="page-btn" onclick="window.appRouter.renderMatches(1)">1</button>`;
                    if (startPage > 2) pagesHtml += `<span style="padding: 0 4px; color: var(--text-muted);">...</span>`;
                }

                for (let i = startPage; i <= endPage; i++) {
                    pagesHtml += `<button class="page-btn ${i === data.page ? 'active' : ''}" onclick="window.appRouter.renderMatches(${i})">${i}</button>`;
                }

                if (endPage < data.pages) {
                    if (endPage < data.pages - 1) pagesHtml += `<span style="padding: 0 4px; color: var(--text-muted);">...</span>`;
                    pagesHtml += `<button class="page-btn" onclick="window.appRouter.renderMatches(${data.pages})">${data.pages}</button>`;
                }

                if (data.page < data.pages) {
                    pagesHtml += `<button class="page-btn" onclick="window.appRouter.renderMatches(${data.page + 1})" title="Next Page">›</button>`;
                    pagesHtml += `<button class="page-btn" onclick="window.appRouter.renderMatches(${data.pages})" title="Last Page">»</button>`;
                }
            }
            pag.innerHTML = pagesHtml;
        } catch (err) { console.error("Matches Log render error:", err); }
    }

    resetMatchesFilters() {
        const search = document.getElementById("matches-search");
        const season = document.getElementById("matches-season");
        const team = document.getElementById("matches-team");
        const venue = document.getElementById("matches-venue");
        if (search) search.value = "";
        if (season) season.value = "all";
        if (team) team.value = "all";
        if (venue) venue.value = "all";
        this.renderMatches(1);
    }

    // --------------------------------------------------
    // ROUTE 7: MATCH DETAIL (/matches/:matchId)
    // --------------------------------------------------
    async renderMatchDetail(matchId) {
        this.switchView("view-match-detail", "nav-matches", `Matches / #${matchId}`);
        try {
            const res = await fetch(`/api/matches/${matchId}`);
            const m = await res.json();
            if (!res.ok) return;

            document.getElementById("md-season-tag").textContent = `SEASON ${m.season} • MATCH #${m.match_id}`;
            document.getElementById("md-title").textContent = `${m.team1_full} vs ${m.team2_full}`;
            document.getElementById("md-subtitle").textContent = `${m.venue}${m.city ? ', ' + m.city : ''} | ${m.date}`;

            document.getElementById("md-winner").textContent = m.winner_full;
            document.getElementById("md-margin").textContent = `Result: ${m.match_result}`;
            document.getElementById("md-potm").textContent = m.player_of_match;

            document.getElementById("md-t1-name").textContent = `${m.team1} (1st Innings)`;
            document.getElementById("md-t1-score").textContent = `${m.first_score} Runs (${m.first_wickets} wkts)`;

            document.getElementById("md-t2-name").textContent = `${m.team2} (2nd Innings)`;
            document.getElementById("md-t2-score").textContent = `${m.second_score} Runs (${m.second_wickets} wkts)`;
        } catch (err) { console.error("Match Detail render error:", err); }
    }

    // --------------------------------------------------
    // ROUTE 8: ANALYSIS (/analysis)
    // --------------------------------------------------
    async renderAnalysis() {
        this.switchView("view-analysis", "nav-analysis", "Advanced IPL Analysis");
        try {
            const res = await fetch("/api/analysis");
            const data = await res.json();
            if (!res.ok) return;

            // Season Trends
            Plotly.react("ana-season-runs-chart", [{
                type: "bar", x: data.season_trends.map(s => s.season), y: data.season_trends.map(s => s.runs), marker: { color: "#2563EB" }
            }], { ...this.plotlyLayoutBase, margin: { t: 20, r: 20, l: 40, b: 30 } }, this.plotlyConfig);

            Plotly.react("ana-season-sr-chart", [{
                type: "scatter", mode: "lines+markers", x: data.season_trends.map(s => s.season), y: data.season_trends.map(s => s.strike_rate), line: { color: "#F59E0B", width: 3 }
            }], { ...this.plotlyLayoutBase, margin: { t: 20, r: 20, l: 40, b: 30 } }, this.plotlyConfig);

            // Scatter Analytics
            Plotly.react("ana-runs-sr-scatter", [{
                type: "scatter", mode: "markers", x: data.correlations.map(c => c.runs), y: data.correlations.map(c => c.strike_rate), text: data.correlations.map(c => c.player),
                marker: { size: 10, color: "#4F46E5" }
            }], { ...this.plotlyLayoutBase, xaxis: { title: "Runs" }, yaxis: { title: "SR" } }, this.plotlyConfig);

            Plotly.react("ana-boundary-sr-scatter", [{
                type: "scatter", mode: "markers", x: data.correlations.map(c => c.boundary_pct), y: data.correlations.map(c => c.strike_rate), text: data.correlations.map(c => c.player),
                marker: { size: 10, color: "#06B6D4" }
            }], { ...this.plotlyLayoutBase, xaxis: { title: "Boundary Run %" }, yaxis: { title: "SR" } }, this.plotlyConfig);

            // Team Win %
            Plotly.react("ana-team-winpct-chart", [{
                type: "bar", x: data.team_analysis.map(t => t.team), y: data.team_analysis.map(t => t.win_pct), marker: { color: "#10B981" },
                text: data.team_analysis.map(t => `${t.win_pct}%`), textposition: "inside"
            }], { ...this.plotlyLayoutBase, yaxis: { title: "Win Percentage (%)" } }, this.plotlyConfig);

            // Initialize 3D Player Performance Map
            if (window.ipl3DManager) {
                window.ipl3DManager.initAnalysis3DMap("analysis-3d-container", data.correlations);
            }
        } catch (err) { console.error("Analysis render error:", err); }
    }

    // --------------------------------------------------
    // ROUTE 9: REPORTS (/reports)
    // --------------------------------------------------
    async renderReports() {
        this.switchView("view-reports", "nav-reports", "IPL Reports");
        try {
            const res = await fetch("/api/reports");
            const r = await res.json();
            if (!res.ok) return;

            const preview = document.getElementById("report-preview-box");
            preview.innerHTML = `
==================================================
${r.title.toUpperCase()}
==================================================
Data Scope: IPL Seasons 2008–2026 (${r.season})
Total Matches Analyzed: ${r.total_matches}
Total Runs Scored: ${r.total_runs.toLocaleString()}
Total Boundary Fours: ${r.total_fours.toLocaleString()}
Total Maximum Sixes: ${r.total_sixes.toLocaleString()}

🏆 League Top Run Scorer: ${r.top_scorer.player} (${r.top_scorer.runs.toLocaleString()} runs)
🏏 League Top Team: ${r.top_team.team} (${r.top_team.runs.toLocaleString()} team runs)
            `;
        } catch (err) { console.error("Reports render error:", err); }
    }

    // --------------------------------------------------
    // ROUTE 10: SETTINGS (/settings)
    // --------------------------------------------------
    renderSettings() {
        this.switchView("view-settings", "nav-settings", "Settings");
        const themeBtn = document.getElementById("theme-toggle-btn");
        if (themeBtn && !this.themeWired) {
            themeBtn.addEventListener("click", () => {
                alert("Appearance Theme: Currently set to Dark Navy (Default). Theme preferences saved.");
            });
            this.themeWired = true;
        }
    }

    // --------------------------------------------------
    // GLOBAL SEARCH AUTOCOMPLETE
    // --------------------------------------------------
    setupGlobalSearch() {
        const input = document.getElementById("global-search");
        const results = document.getElementById("search-results");
        if (!input || !results) return;

        input.addEventListener("input", async () => {
            const val = input.value.toLowerCase().trim();
            if (!val) { results.classList.remove("active"); return; }

            const res = await fetch("/api/dashboard");
            const data = await res.json();

            const items = [];
            data.filters.players.forEach(p => { if (p.toLowerCase().includes(val)) items.push({ type: "Player", name: p, url: `/players/${encodeURIComponent(p)}` }); });
            data.filters.teams.forEach(t => { if (t.toLowerCase().includes(val)) items.push({ type: "Team", name: t, url: `/teams/${t}` }); });

            if (items.length === 0) { results.classList.remove("active"); return; }

            results.innerHTML = items.slice(0, 8).map(i => `
                <div class="search-result-item" data-url="${i.url}">
                    <span><b>${i.name}</b></span>
                    <span style="font-size: 11px; color: var(--blue-accent); font-weight: 700;">${i.type}</span>
                </div>
            `).join("");
            results.classList.add("active");
        });

        results.addEventListener("click", (e) => {
            const item = e.target.closest(".search-result-item");
            if (item) {
                const url = item.dataset.url;
                input.value = "";
                results.classList.remove("active");
                this.navigate(url);
            }
        });
    }
}

window.appRouter = new AppRouter();
