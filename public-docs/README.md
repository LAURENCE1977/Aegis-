# AEGIS public documentation site

This folder contains a deliberately curated, public-facing project overview. It is separate from the application and from internal engineering notes.

## Publish

The GitHub Actions workflow at `.github/workflows/pages.yml` validates pull requests and deploys this folder to GitHub Pages after changes reach `main` (or when manually dispatched).

Before the first deployment, a repository administrator must open **Settings → Pages** and set **Build and deployment → Source** to **GitHub Actions**.

The Pages site is public. Only publish content reviewed for public release. Do not copy internal handover documents, connection inventories, credentials, private URLs, operational endpoints or security-sensitive implementation details into this folder.

The workflow uploads only `public-docs/`; it does not publish the repository root or the application.
