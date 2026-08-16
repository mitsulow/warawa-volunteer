"""シェア用OGP画像 public/ogp.png (1200x630) を生成。
和紙色の地 + オレンジ帯 + 大天使ワラエル + 手書きロゴ(わらわ〜) + ボランティア + スローガン。
"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H = 1200, 630
ORANGE = (217, 106, 26)
ORANGE_D = (192, 94, 20)
BROWN = (58, 52, 40)
WASHI = (250, 246, 238)

FONT_B = "C:/Windows/Fonts/YuGothB.ttc"
FONT_M = "C:/Windows/Fonts/YuGothM.ttc"
FONT_KYO = "C:/Windows/Fonts/UDDigiKyokashoN-B.ttc"

img = Image.new("RGB", (W, H), WASHI)
d = ImageDraw.Draw(img)

# 上下のオレンジ帯
d.rectangle([0, 0, W, 14], fill=ORANGE)
d.rectangle([0, H - 14, W, H], fill=ORANGE)

# 右側にワラエル（薄い透かし大 + 本体）
wa = Image.open("public/waraeru-v2.png").convert("RGBA")
body = wa.resize((340, int(340 * wa.height / wa.width)))
img.paste(body, (800, 165), body)

# ロゴ「わらわ〜」(白抜きpng → オレンジに着色)
logo = Image.open("public/warawa-logo.png").convert("RGBA")
lw = 520
logo = logo.resize((lw, int(lw * logo.height / logo.width)))
tint = Image.new("RGBA", logo.size, ORANGE + (255,))
tint.putalpha(logo.split()[3])
img.paste(tint, (90, 150), tint)

# 「ボランティア」
f_title = ImageFont.truetype(FONT_B, 92)
d.text((100, 320), "ボランティア", font=f_title, fill=ORANGE)

# スローガン
f_slogan = ImageFont.truetype(FONT_KYO, 40)
d.text((100, 445), "届けたいのは「大丈夫」、", font=f_slogan, fill=BROWN)
d.text((100, 500), "配りたいのは「笑顔」。", font=f_slogan, fill=BROWN)

# 上部の小見出し
f_small = ImageFont.truetype(FONT_M, 30)
d.text((100, 60), "熊本地震 被災地支援 ── 助けて・助けたいをつなぐ場所", font=f_small, fill=ORANGE_D)

# 右下URL
f_url = ImageFont.truetype(FONT_M, 26)
d.text((W - 480, H - 62), "warawa-volunteer.vercel.app", font=f_url, fill=(138, 128, 112))

img.save("public/ogp.png", optimize=True)
print("saved", img.size)
