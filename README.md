# Engineering Lab

An interactive technical environment connected to [victorkipruto.com](https://www.victorkipruto.com), built with plain HTML5, CSS3, and vanilla JavaScript (ES modules) — no frameworks, no build step.

## Structure

- `index.html` — landing page and system registry preview
- `pages/` — Systems, Architecture, Monitor, Data, API Playground, Code, Case Studies, Experiments
- `css/` — design tokens (`main.css`), shared components, and per-page styles
- `js/` — ES modules; `app.js` handles shared shell behavior (nav, mobile rail, fetch helper)
- `data/` — JSON data driving the systems registry, architecture diagrams, demo transactions, and demo telemetry

## Running locally

Any static file server works, since the site uses `fetch()` for JSON (which requires HTTP, not `file://`):

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Data & demo boundaries

- All telemetry and transaction data is synthetic and clearly labeled `DEMO` / `SANITIZED DEMO DATA`.
- No real M-Pesa identifiers, customer data, or credentials appear anywhere in this repository.
- The API Playground never leaves the browser — there is no backend.

## Deployment

`.github/workflows/deploy.yml` validates JSON and checks for obvious secrets before publishing to GitHub Pages.
