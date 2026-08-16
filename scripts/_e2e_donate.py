"""E2E: 使い捨てユーザーで /api/donate-talk を本番に投げ、TalK/donations が作られるか確認して掃除する。"""
import json
import os
import subprocess
import sys
import urllib.request

REF = "dmixilrcxiofanwfhxfq"
BASE = "https://warawa-volunteer.vercel.app"


def env(path, key):
    for line in open(os.path.expanduser(path), encoding="utf-8"):
        if line.startswith(key + "="):
            return line.split("=", 1)[1].strip()
    raise SystemExit("missing " + key)


mgmt = env("~/.rakuichi-env", "SUPABASE_ACCESS_TOKEN")
anon = env("~/.warawa-env", "SUPABASE_ANON_KEY")


def http(url, data=None, headers=None, method=None):
    req = urllib.request.Request(url, data=data, headers=headers or {}, method=method)
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


# 1) service role key
st, body = http(f"https://api.supabase.com/v1/projects/{REF}/api-keys?reveal=true",
                headers={"Authorization": f"Bearer {mgmt}", "User-Agent": "warawa/1.0"})
keys = json.loads(body)
service = next(k["api_key"] for k in keys if k.get("name") == "service_role")

H = {"apikey": service, "Authorization": f"Bearer {service}", "Content-Type": "application/json"}
email = "e2e-donate@warawa-mock.example"
pw = "E2eTest-Passw0rd!"

# 2) create user (or reuse)
st, body = http(f"https://{REF}.supabase.co/auth/v1/admin/users",
                data=json.dumps({"email": email, "password": pw, "email_confirm": True,
                                 "user_metadata": {"full_name": "E2Eテスト太郎"}}).encode(), headers=H, method="POST")
print("createUser", st, body[:120])
uid = json.loads(body).get("id")
if not uid:
    # already exists → find
    st, body = http(f"https://{REF}.supabase.co/auth/v1/admin/users?page=1&per_page=200", headers=H)
    uid = next(u["id"] for u in json.loads(body)["users"] if u["email"] == email)
print("uid", uid)

# 3) sign in with password
st, body = http(f"https://{REF}.supabase.co/auth/v1/token?grant_type=password",
                data=json.dumps({"email": email, "password": pw}).encode(),
                headers={"apikey": anon, "Content-Type": "application/json"}, method="POST")
print("signIn", st, body[:100])
token = json.loads(body).get("access_token")
if not token:
    sys.exit("no token (password provider disabled?)")

# 4) call donate-talk
st, body = http(f"{BASE}/api/donate-talk", data=json.dumps({"units": 3, "listed": False}).encode(),
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"}, method="POST")
print("donate-talk", st, body)

# 5) verify
st, body = http(f"https://{REF}.supabase.co/rest/v1/donations?user_id=eq.{uid}&select=units,amount,listed,email,display_name", headers=H)
print("donations", body)
st, body = http(f"https://{REF}.supabase.co/rest/v1/chats?or=(a.eq.{uid},b.eq.{uid})&select=id", headers=H)
chats = json.loads(body)
print("chats", chats)
for c in chats:
    st, body = http(f"https://{REF}.supabase.co/rest/v1/messages?chat_id=eq.{c['id']}&select=sender_id,body", headers=H)
    print("messages", body[:300])

# 6) cleanup
for c in chats:
    http(f"https://{REF}.supabase.co/rest/v1/messages?chat_id=eq.{c['id']}", headers=H, method="DELETE")
    http(f"https://{REF}.supabase.co/rest/v1/chats?id=eq.{c['id']}", headers=H, method="DELETE")
http(f"https://{REF}.supabase.co/rest/v1/donations?user_id=eq.{uid}", headers=H, method="DELETE")
http(f"https://{REF}.supabase.co/rest/v1/offers?user_id=eq.{uid}", headers=H, method="DELETE")
http(f"https://{REF}.supabase.co/rest/v1/profile_private?id=eq.{uid}", headers=H, method="DELETE")
http(f"https://{REF}.supabase.co/rest/v1/profiles?id=eq.{uid}", headers=H, method="DELETE")
st, body = http(f"https://{REF}.supabase.co/auth/v1/admin/users/{uid}", headers=H, method="DELETE")
print("deleteUser", st)
