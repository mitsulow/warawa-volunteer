"""Supabase Management API で SQL を実行する小道具。
使い方: python scripts/dbq.py "select 1"   または  python scripts/dbq.py -f file.sql
1リクエスト=1トランザクション。User-Agent必須。
"""
import json
import os
import sys
import urllib.request

PROJECT = "dmixilrcxiofanwfhxfq"


def token() -> str:
    p = os.path.expanduser("~/.rakuichi-env")
    for line in open(p, encoding="utf-8"):
        if line.startswith("SUPABASE_ACCESS_TOKEN="):
            return line.split("=", 1)[1].strip()
    raise SystemExit("no token")


def run(sql: str):
    req = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{PROJECT}/database/query",
        data=json.dumps({"query": sql}).encode(),
        headers={
            "Authorization": f"Bearer {token()}",
            "Content-Type": "application/json",
            "User-Agent": "warawa-volunteer/1.0",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as r:
            body = r.read().decode()
    except urllib.error.HTTPError as e:
        print("HTTP", e.code, e.read().decode())
        sys.exit(1)
    print(body[:4000])


if __name__ == "__main__":
    if sys.argv[1] == "-f":
        run(open(sys.argv[2], encoding="utf-8").read())
    else:
        run(sys.argv[1])
