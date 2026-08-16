"""デスクトップの障害報告 .md → 見やすい HTML（自己完結）に変換。PDF は Edge の headless 印刷で作る。"""
import markdown, os, subprocess

DESK = os.path.join(os.path.expanduser("~"), "OneDrive", "デスクトップ")
src = os.path.join(DESK, "エンジニア共有_わらわ〜ボランティア公開初日の障害報告と対策_2026-08-16.md")
html_out = os.path.join(DESK, "エンジニア共有_わらわ〜ボランティア公開初日の障害報告と対策_2026-08-16.html")
pdf_out = os.path.join(DESK, "エンジニア共有_わらわ〜ボランティア公開初日の障害報告と対策_2026-08-16.pdf")

body = markdown.markdown(open(src, encoding="utf-8").read(), extensions=["tables", "fenced_code"])
html = f"""<!doctype html><html lang="ja"><head><meta charset="utf-8">
<title>わらわ〜ボランティア 公開初日の障害報告と対策（2026-08-16）</title>
<style>
 body{{font-family:"Yu Gothic UI","Meiryo","Hiragino Sans",sans-serif;color:#2b2620;background:#fff;max-width:860px;margin:0 auto;padding:32px 24px;line-height:1.75;font-size:15px}}
 h1{{font-size:24px;border-bottom:3px solid #d96a1a;padding-bottom:8px;color:#a84e0e}}
 h2{{font-size:19px;margin-top:34px;border-left:6px solid #d96a1a;padding-left:10px;color:#3a3428}}
 h3{{font-size:16px;color:#c05e14}}
 table{{border-collapse:collapse;width:100%;margin:12px 0;font-size:13.5px}}
 th,td{{border:1px solid #e0d6c6;padding:7px 9px;vertical-align:top}}
 th{{background:#fdeedd;text-align:left}}
 code{{background:#f4efe6;padding:1px 5px;border-radius:4px;font-size:13px}}
 pre{{background:#2b2620;color:#f4efe6;padding:12px;border-radius:8px;overflow:auto;font-size:12.5px}}
 pre code{{background:none;color:inherit;padding:0}}
 hr{{border:none;border-top:1px solid #e0d6c6;margin:26px 0}}
 blockquote{{border-left:4px solid #f0d0a8;margin:0;padding:4px 12px;color:#5a5448}}
 @media print{{body{{padding:0}} h2{{page-break-after:avoid}} table{{page-break-inside:avoid}}}}
</style></head><body>{body}</body></html>"""
open(html_out, "w", encoding="utf-8").write(html)
print("html", html_out)

edge = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
subprocess.run([edge, "--headless", "--disable-gpu", f"--print-to-pdf={pdf_out}", "--no-pdf-header-footer", "file:///" + html_out.replace("\\", "/")], timeout=120)
print("pdf", pdf_out, os.path.exists(pdf_out))
