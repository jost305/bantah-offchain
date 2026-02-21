#!/usr/bin/env python3
"""Run specified SQL migration files against the DATABASE_URL using psycopg2.

Usage: python migrations/run_migrations.py path/to/migration1.sql [path/to/migration2.sql ...]

The script reads DATABASE_URL from the environment.
"""
import os
import sys
from pathlib import Path

try:
    import psycopg2
except Exception:
    print("psycopg2 is required. Install with: pip install psycopg2-binary")
    sys.exit(2)


def run_file(conn, path: Path):
    sql = path.read_text()
    print(f"Running {path}...")
    cur = conn.cursor()
    try:
        cur.execute(sql)
        conn.commit()
        print(f"✅ Applied {path}")
    except Exception as e:
        conn.rollback()
        print(f"✗ Failed {path}: {e}")
        raise
    finally:
        cur.close()


def main():
    if 'DATABASE_URL' not in os.environ:
        print('Environment variable DATABASE_URL is not set')
        sys.exit(1)

    if len(sys.argv) < 2:
        print('Usage: run_migrations.py migration1.sql [migration2.sql ...]')
        sys.exit(1)

    dburl = os.environ['DATABASE_URL']
    files = [Path(p) for p in sys.argv[1:]]
    for f in files:
        if not f.exists():
            print(f'File not found: {f}')
            sys.exit(1)

    conn = None
    try:
        conn = psycopg2.connect(dburl)
        for f in files:
            run_file(conn, f)
    finally:
        if conn:
            conn.close()


if __name__ == '__main__':
    main()
