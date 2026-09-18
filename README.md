# IPL Analytics Web Dashboard

## Included files

- `app.py` - Flask backend and API routes
- `prepare_data.py` - combines historical 2008-2025 data with 2026 data
- `templates/index.html` - main batting dashboard
- `templates/teams.html` - team performance page
- `static/css/style.css` - shared dashboard and team-page styling
- `static/js/dashboard.js` - batting filters and Plotly charts
- `static/js/team.js` - team KPIs, charts and standings table

## Expected data folders

The Flask dashboard expects:

```text
data/
└── 2026/
    ├── batting_stats.csv
    ├── bowling_stats.csv
    ├── deliveries.csv
    ├── matches.csv
    └── points_table.csv
```

The data-preparation script additionally expects:

```text
data/
└── 2008-25/
    ├── matches_updated_ipl_upto_2025.csv
    └── deliveries_updated_ipl_upto_2025.csv
```

## Run

Install dependencies:

```bash
pip install flask pandas
```

Then:

```bash
python app.py
```

Open:

```text
http://127.0.0.1:5000
```

The Plotly library is loaded in the HTML pages from the Plotly CDN.

## Deploy online with Render

1. Create a new **Web Service** on [Render](https://render.com/) and connect the GitHub repository.
2. Select the Python runtime.
3. Use these commands:

    - Build command: `pip install -r requirements.txt`
    - Start command: `gunicorn app:app`

4. Choose the free instance for testing and deploy.

The CSV files used by the dashboard are included in this repository, so no database setup is required.
