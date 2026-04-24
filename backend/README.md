# Backend Development Notes

## Database Lifecycle

- Schema changes are managed only through Alembic.
- Do not use `Base.metadata.create_all()` in runtime or tests.

## Local Startup

```bash
cd backend
alembic upgrade head
uvicorn app.main:app --reload
```

## Existing Database Bootstrap

```bash
cd backend
alembic stamp 861ffc1e3691
alembic upgrade head
uvicorn app.main:app --reload
```

## Pulling New Migrations

```bash
cd backend
alembic upgrade head
```

## Snapshot Before Risky Migration

```bash
bash scripts/pg_dump_snapshot.sh
```

