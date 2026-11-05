"""배포 전 실행: 각 HTML의 assets 링크에 파일 내용 해시(?v=…)를 붙여, 업데이트 직후 옛 파일이 섞이지 않게 합니다.
사용: python3 tools/bust.py"""
import glob, hashlib, os, re
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def h(rel):
    with open(os.path.join(root, rel), "rb") as f: return hashlib.sha256(f.read()).hexdigest()[:10]
for page in glob.glob(os.path.join(root, "*.html")):
    s = open(page, encoding="utf-8").read()
    t = re.sub(r'((?:src|href)="(assets/[^"?]+))(?:\?v=[0-9a-f]+)?"', lambda m: m.group(1) + "?v=" + h(m.group(2)) + '"', s)
    if t != s: open(page, "w", encoding="utf-8").write(t)
print("ok")
