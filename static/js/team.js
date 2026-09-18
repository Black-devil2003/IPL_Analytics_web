// ==================================================
// IPL TEAMS PAGE CONTROLLER
// ==================================================

document.addEventListener("DOMContentLoaded", () => {
    setupMobileNav();
    setupSeasonFilter();
    setupTeamSearch();
    loadTeams();
});

function setupMobileNav() {
    const mobileNavToggle = document.getElementById("mobile-nav-toggle");
    const sidebar = document.getElementById("sidebar");
    if (mobileNavToggle && sidebar) {
        mobileNavToggle.addEventListener("click", () => {
            sidebar.classList.toggle("sidebar-open");
        });
    }
}

let currentTeamsData = [];

const teamChartLayout = {
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    margin: { l: 160, r: 30, t: 20, b: 40 },
    font: { family: "Inter, sans-serif", color: "#0F172A", size: 12 },
    xaxis: { gridcolor: "#E2E8F0" },
    yaxis: { autorange: "reversed", automargin: true }
};

const teamChartConfig = { responsive: true, displayModeBar: false };

function val(v, fallback = 0) {
    return v === undefined || v === null || v === "" ? fallback : v;
}

async function setupSeasonFilter() {
    const seasonSelect = document.getElementById("team-season-filter");
    if (!seasonSelect) return;

    try {
        const response = await fetch("/api/dashboard");
        const data = await response.json();

        if (data && data.filters && data.filters.seasons) {
            seasonSelect.innerHTML = '<option value="all">All Seasons</option>';
            data.filters.seasons.forEach(season => {
                const opt = document.createElement("option");
                opt.value = season;
                opt.textContent = `Season ${season}`;
                seasonSelect.appendChild(opt);
            });
        }
    } catch (err) {
        console.error("Error setting up team season filter:", err);
    }

    seasonSelect.addEventListener("change", (e) => {
        loadTeams(e.target.value);
    });
}

function setupTeamSearch() {
    const searchInput = document.getElementById("team-search");
    if (!searchInput) return;

    searchInput.addEventListener("input", (e) => {
        const query = e.target.value.toLowerCase().trim();
        const filtered = currentTeamsData.filter(t => 
            (t.team || "").toLowerCase().includes(query) || (t.team_code || "").toLowerCase().includes(query)
        );
        renderTable(filtered);
    });
}

function renderSummary(data) {
    if (!data || !data.length) return;

    const leadingTeam = data[0];
    const mostWins = [...data].sort((a, b) => Number(b.wins) - Number(a.wins))[0];
    const bestNRR = [...data].sort((a, b) => Number(b.nrr) - Number(a.nrr))[0];

    const leadTeamElem = document.getElementById("leading-team");
    const leadPtsElem = document.getElementById("leading-team-points");
    const hgPtsElem = document.getElementById("highest-points");
    const mostWinsElem = document.getElementById("most-wins");
    const mostWinsCountElem = document.getElementById("most-wins-count");
    const bestNrrElem = document.getElementById("best-nrr");
    const bestNrrTeamElem = document.getElementById("best-nrr-team");

    if (leadTeamElem) leadTeamElem.textContent = leadingTeam.team;
    if (leadPtsElem) leadPtsElem.textContent = `${val(leadingTeam.points)} points`;
    if (hgPtsElem) hgPtsElem.textContent = val(leadingTeam.points);
    if (mostWinsElem) mostWinsElem.textContent = mostWins.team;
    if (mostWinsCountElem) mostWinsCountElem.textContent = `${val(mostWins.wins)} wins`;
    if (bestNrrElem) bestNrrElem.textContent = (Number(val(bestNRR.nrr)) > 0 ? "+" : "") + Number(val(bestNRR.nrr)).toFixed(3);
    if (bestNrrTeamElem) bestNrrTeamElem.textContent = bestNRR.team;
}

function renderPointsChart(data) {
    const teams = data.map(t => t.team);
    const points = data.map(t => Number(val(t.points)));

    Plotly.react(
        "team-points-chart",
        [{
            x: points,
            y: teams,
            type: "bar",
            orientation: "h",
            marker: {
                color: "#2563EB",
                line: { color: "#1E40AF", width: 1 }
            },
            text: points,
            textposition: "inside",
            hovertemplate: "<b>%{y}</b><br>Points: %{x}<extra></extra>"
        }],
        {
            ...teamChartLayout,
            xaxis: { ...teamChartLayout.xaxis, title: "Points" }
        },
        teamChartConfig
    );
}

function renderWinsChart(data) {
    const teams = data.map(t => t.team);
    const wins = data.map(t => Number(val(t.wins)));

    Plotly.react(
        "team-wins-chart",
        [{
            x: wins,
            y: teams,
            type: "bar",
            orientation: "h",
            marker: {
                color: "#4F46E5",
                line: { color: "#3730A3", width: 1 }
            },
            text: wins,
            textposition: "inside",
            hovertemplate: "<b>%{y}</b><br>Wins: %{x}<extra></extra>"
        }],
        {
            ...teamChartLayout,
            xaxis: { ...teamChartLayout.xaxis, title: "Wins" }
        },
        teamChartConfig
    );
}

const TEAM_LOGOS = {
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

function renderTable(data) {
    const tableBody = document.getElementById("team-table-body");
    if (!tableBody) return;

    if (!data || data.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 20px;">No team data found.</td></tr>`;
        return;
    }

    tableBody.innerHTML = data.map((team, index) => {
        const nrrVal = Number(val(team.nrr));
        const nrrFormatted = (nrrVal > 0 ? "+" : "") + nrrVal.toFixed(3);
        const posClass = (team.position || (index + 1)) <= 3 ? `rank-${team.position || (index + 1)}` : "";
        const code = team.team_code || team.team;
        const logoUrl = TEAM_LOGOS[code] || `/static/images/${code}.png`;

        return `
            <tr>
                <td><span class="rank-badge ${posClass}">${team.position || (index + 1)}</span></td>
                <td class="team-badge-cell" style="display: flex; align-items: center; gap: 8px;">
                    <img src="${logoUrl}" alt="${team.team}" class="table-team-logo" onerror="this.style.display='none';">
                    <b>${team.team}</b>
                </td>
                <td>${val(team.matches)}</td>
                <td><b style="color: #10B981">${val(team.wins)}</b></td>
                <td><span style="color: #EF4444">${val(team.defeats)}</span></td>
                <td>${val(team.ties)}</td>
                <td>${val(team.abandoned)}</td>
                <td><b>${val(team.points)}</b></td>
                <td><b>${nrrFormatted}</b></td>
            </tr>
        `;
    }).join("");
}

async function loadTeams(season = "all") {
    const tableBody = document.getElementById("team-table-body");
    if (tableBody) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; padding: 20px;">
                    Loading team data...
                </td>
            </tr>
        `;
    }

    try {
        const response = await fetch(`/api/teams?season=${season}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Unable to load team data.");
        }

        currentTeamsData = data;
        renderSummary(data);
        renderPointsChart(data);
        renderWinsChart(data);
        renderTable(data);
    } catch (err) {
        console.error("Error loading team data:", err);
        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="9" style="text-align: center; color: #EF4444; padding: 20px;">
                        Error loading team data: ${err.message}
                    </td>
                </tr>
            `;
        }
    }
}
