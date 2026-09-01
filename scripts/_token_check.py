"""Management API トークンの生存確認（dbq.py と同じ読み方・トークンは表示しない）"""
import os
import urllib.request
import urllib.error

p = os.path.expanduser("~/.rakuichi-env")
tok = ""
for line in open(p, encoding="utf-8"):
    if line.startswith("SUPABASE_ACCESS_TOKEN="):
        tok = line.split("=", 1)[1].strip()

req = urllib.request.Request(
    "https://api.supabase.com/v1/projects",
    headers={"Authorization": f"Bearer {tok}", "User-Agent": "warawa-volunteer/1.0"},
)
try:
    with urllib.request.urlopen(req) as r:
        print("status:", r.status)
except urllib.error.HTTPError as e:
    print("status:", e.code, e.read().decode()[:200])
