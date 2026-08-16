"""E2E: 使い捨てユーザーで本番 /api/upload に画像を投げ、R2の公開URLが返り取得できるか確認して掃除する。"""
import io
import json
import os
import urllib.request
import uuid

from PIL import Image

REF = "dmixilrcxiofanwfhxfq"
BASE = "https://warawa-volunteer.vercel.app"


def env(path, key):
    for line in open(os.path.expanduser(path), encoding="utf-8"):
        if line.startswith(key + "="):
            return line.split("=", 1)[1].strip()
    raise SystemExit("missing " + key)


def http(url, data=None, headers=None, method=None):
    req = urllib.request.Request(url, data=data, headers=headers or {}, method=method)
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()


mgmt = env("~/.rakuichi-env", "SUPABASE_ACCESS_TOKEN")
anon = env("~/.warawa-env", "SUPABASE_ANON_KEY")
st, body = http(f"https://api.supabase.com/v1/projects/{REF}/api-keys?reveal=true",
                headers={"Authorization": f"Bearer {mgmt}", "User-Agent": "warawa/1.0"})
service = next(k["api_key"] for k in json.loads(body) if k.get("name") == "service_role")
H = {"apikey": service, "Authorization": f"Bearer {service}", "Content-Type": "application/json"}
email, pw = "e2e-upload@warawa-mock.example", "E2eTest-Passw0rd!"
st, body = http(f"https://{REF}.supabase.co/auth/v1/admin/users",
                data=json.dumps({"email": email, "password": pw, "email_confirm": True}).encode(), headers=H, method="POST")
uid = json.loads(body).get("id")
st, body = http(f"https://{REF}.supabase.co/auth/v1/token?grant_type=password",
                data=json.dumps({"email": email, "password": pw}).encode(),
                headers={"apikey": anon, "Content-Type": "application/json"}, method="POST")
token = json.loads(body)["access_token"]

# 小さなWebP画像を作って multipart で送る
im = Image.new("RGB", (64, 64), (217, 106, 26))
buf = io.BytesIO()
im.save(buf, "WEBP", quality=80)
img = buf.getvalue()
boundary = "----warawa" + uuid.uuid4().hex
parts = (
    f"--{boundary}\r\nContent-Disposition: form-data; name=\"folder\"\r\n\r\nphotos\r\n"
    f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"t.webp\"\r\nContent-Type: image/webp\r\n\r\n"
).encode() + img + f"\r\n--{boundary}--\r\n".encode()
st, body = http(f"{BASE}/api/upload", data=parts, headers={"Authorization": f"Bearer {token}", "Content-Type": f"multipart/form-data; boundary={boundary}"}, method="POST")
print("upload", st, body[:200])
url = json.loads(body).get("url") if st == 200 else None
if url:
    st2, b2 = http(url)
    print("public GET", st2, len(b2), "bytes")

# cleanup
http(f"https://{REF}.supabase.co/auth/v1/admin/users/{uid}", headers=H, method="DELETE")
print("cleanup done")
