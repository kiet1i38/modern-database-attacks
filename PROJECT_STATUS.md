# CampusDesk project status

Current application: four local variants in src/campus/, started with docker compose up -d --build --wait --wait-timeout 240.

Vercel preparation is available through api/index.js and vercel.json. See docs/VERCEL.html for separate hosted configuration and database setup. Preparing this branch does not publish or change the main-branch deployments.

- Required Topic 12: MongoDB-backed login, real operator-injection bypass, safe comparison.
- Primary guide: README.md and docs/DEMO_GUIDE.html.
- Code walkthrough: docs/CODE_AND_SECURITY_FLOW.html.
- Demonstration assumptions and limits: docs/DEMO_GUIDE.html.
- Automated checks: npm test; npm run build; npm run test:integration against the four running sites.
- Previous evidence is historical. Use the evidence folder produced by a new run for current results.
- Legacy code/tests and docker-compose.lab.yml describe the earlier two-route application, not the current CampusDesk startup.

Unsafe variants and public synthetic credentials are intentional. All app ports bind to loopback; database ports are not published. Never deploy this lab as a production service.
