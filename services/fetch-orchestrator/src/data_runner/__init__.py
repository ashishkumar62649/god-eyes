"""GOD EYES Data Runner — local dev data pipeline orchestrator.

Supervises existing Python fetch/normalize/ingest scripts for all enabled
layers. Does not rewrite layer workers; connects existing scripts together,
schedules them, restarts long-running jobs, and keeps layer data fresh.
"""
