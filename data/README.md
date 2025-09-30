# Data Directory

This directory contains references for extending the seed data used by the backend.

- `../backend/data/sample-bess-assets.json` seeds the MongoDB collection on first boot.
- Drop additional CSV/JSON/Parquet assets here when wiring real ingestion pipelines.
- Keep sensitive datasets out of source control. Use secrets management for credentials.

Refer to the resources in the root README to locate publicly available BESS datasets.
