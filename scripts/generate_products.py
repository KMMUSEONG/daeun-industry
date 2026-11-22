#!/usr/bin/env python3
"""Build crawlable, static product pages from the public Supabase products API."""
import html
import json
import os
import pathlib
import re
import urllib.parse
import urllib.request
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parents[1]
SITE = 'https://kmmuseong.github.io/daeun-industry/'
CONFIG = (ROOT / 'config.js').read_text(encoding='utf-8')

def config_value(name):
    m = re.search(r'\b' + re.escape(name) + r'\s*:\s*[\'\"]([^\'\"]+)[\'\"]', CONFIG)
    if not m:
        raise RuntimeError(f'config.js: {name} 설정을 찾을 수 없습니다.')
    return m.group(1)

BASE = config_value('supabaseUrl').rstrip('/')
KEY = config_value('supabaseAnonKey')

def esc(v):
    return html.escape(str(v if v is not None else ''), quote=True)

def paths(value):
    if isinstance(value, list):
        return [p for p in value if isinstance(p, str) and p]
    if not isinstance(value, str) or not value:
        return []
    if value.lstrip().startswith('['):
        try:
            arr = json.loads(value)
            return [p for p in arr if isinstance(p, str) and p] if isinstance(arr, list) else []
        except json.JSONDecodeError:
            pass
    return [value]

def image_url(path):
    return BASE + '/storage/v1/object/public/product-images/' + '/'.join(urllib.parse.quote(part, safe='') for part in path.split('/'))

def fetch_products():
    url = BASE + '/rest/v1/products?select=*&order=sort_order.asc,created_at.asc'
    req = urllib.request.Request(url, headers={'apikey': KEY, 'Authorization': 'Bearer ' + KEY, 'Accept': 'application/json', 'User-Agent': 'DaeunIndustryStaticGenerator/1.0'})
    with urllib.request.urlopen(req, timeout=35) as response:
        data = json.load(response)
    if not isinstance(data, list):
        raise RuntimeError('제품 API가 목록을 반환하지 않았습니다.')
    return data

def product_file(p):
    identifier = str(p.get('id', ''))
    if not re.fullmatch(r'[a-zA-Z0-9_-]{1,100}', identifier):
        raise RuntimeError('안전하지 않은 제품 ID가 발견되었습니다.')
    return identifier + '.html'

def page(p, filename):
    ko = str(p.get('name_ko') or p.get('name_ja') or '제품')
    ja = str(p.get('name_ja') or ko)
    spec = str(p.get('spec_ko') or '')
    pot_spec = str(p.get('pot_spec_ko') or '')
    desc = str(p.get('description_ko') or '')
    photos = paths(p.get('image_path'))
    canonical = SITE + 'products/' + urllib.parse.quote(filename)
    summary = (desc or (ko + (' · 전체 규격 ' + spec if spec else '') + (' · 개별 포트 규격 ' + pot_spec if pot_spec else '') + ' | 대운산업 제품 정보 및 문의')).replace('\n', ' ').strip()[:155]
    img = image_url(photos[0]) if photos else ''
    gallery = ''.join('<img loading="lazy" src="' + esc(image_url(path)) + '" alt="' + esc(ko) + ' 제품 사진" />' for path in photos)
    if not gallery:
        gallery = '<div class="placeholder">제품 사진 준비 중</div>'
    ld = {'@context':'https://schema.org','@type':'Product','name':ko,'alternateName':ja,'description':desc or (('전체 규격 '+spec if spec else '') + (' / 개별 포트 규격 '+pot_spec if pot_spec else '')).strip(' /') or ko,'url':canonical,'brand':{'@type':'Brand','name':'대운산업'}}
    if img:
        ld['image'] = [image_url(path) for path in photos]
    json_ld = json.dumps(ld, ensure_ascii=False).replace('<', '\\u003c')
    return f'''<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{esc(ko)} | 대운산업</title><meta name="description" content="{esc(summary)}">
<link rel="canonical" href="{esc(canonical)}"><meta name="robots" content="index,follow">
<meta property="og:type" content="product"><meta property="og:title" content="{esc(ko)} | 대운산업"><meta property="og:description" content="{esc(summary)}"><meta property="og:url" content="{esc(canonical)}">
{('<meta property="og:image" content="'+esc(img)+'">') if img else ''}
<script type="application/ld+json">{json_ld}</script>
<style>*{{box-sizing:border-box}}body{{margin:0;font-family:Arial,'Malgun Gothic',sans-serif;color:#24352d;background:#fff;line-height:1.7}}a{{color:inherit;text-decoration:none}}header{{border-bottom:1px solid #e4e9e5;padding:20px max(20px,calc((100% - 1080px)/2));display:flex;align-items:center;justify-content:space-between;gap:12px}}.brand{{font-size:24px;font-weight:900;color:#194d38;letter-spacing:-.7px}}.brand small{{display:block;font-size:11px;color:#657b6a;letter-spacing:1px}}.back{{font-size:14px;color:#276449}}main{{max-width:1080px;margin:0 auto;padding:42px 20px 70px}}.crumb{{font-size:13px;color:#68796d;margin-bottom:22px}}.layout{{display:grid;grid-template-columns:1fr 1fr;gap:38px}}.photos{{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;align-content:start}}.photos img{{width:100%;aspect-ratio:1/1;object-fit:contain;background:#f6f8f5;border:1px solid #e6ece7;border-radius:9px}}.photos img:first-child{{grid-column:1/-1;aspect-ratio:4/3}}h1{{font-size:clamp(26px,3vw,36px);line-height:1.35;margin:4px 0 18px;word-break:keep-all}}h2{{font-size:17px;margin:25px 0 8px}}.muted{{color:#68796d}}.copy{{white-space:pre-wrap;overflow-wrap:anywhere}}.call{{display:inline-block;margin-top:28px;background:#276449;color:#fff;border-radius:6px;padding:12px 23px;font-weight:700}}footer{{padding:25px 20px;background:#f8faf8;text-align:center;font-size:12px;color:#77887b}}.placeholder{{grid-column:1/-1;background:#f6f8f5;aspect-ratio:4/3;display:grid;place-items:center;color:#718276}}@media(max-width:700px){{.layout{{grid-template-columns:1fr;gap:22px}}main{{padding:24px 17px 50px}}header{{padding:14px 17px}}.brand{{font-size:20px}}}}</style></head>
<body><header><a class="brand" href="../">Daeun Industry<small>대운산업</small></a><a class="back" href="../#products">← 전체 제품 보기</a></header>
<main><div class="crumb"><a href="../">홈</a> / <a href="../#products">제품 소개</a> / {esc(ko)}</div>
<div class="layout"><div class="photos">{gallery}</div><article><h1>{esc(ko)}</h1><div class="muted">{esc(ja)}</div>
{('<h2>전체 제품 규격</h2><div class="copy">'+esc(spec)+'</div>') if spec else ''}
{('<h2>개별 포트 규격</h2><div class="copy">'+esc(pot_spec)+'</div>') if pot_spec else ''}
{('<h2>제품 설명</h2><div class="copy">'+esc(desc)+'</div>') if desc else ''}
<a class="call" href="tel:+821038236637">제품 문의하기 · 010-3823-6637</a></article></div></main>
<footer>© 대운산업 · Daeun Industry</footer></body></html>'''

def main():
    products = fetch_products()
    output = ROOT / 'products'
    output.mkdir(exist_ok=True)
    generated = set()
    for p in products:
        filename = product_file(p)
        if filename in generated:
            raise RuntimeError('중복 제품 ID가 발견되었습니다.')
        generated.add(filename)
        (output / filename).write_text(page(p, filename), encoding='utf-8')
    for old in output.glob('*.html'):
        if old.name not in generated:
            old.unlink()
    links = [SITE] + [SITE + 'products/' + urllib.parse.quote(name) for name in sorted(generated)]
    lines = ['<?xml version="1.0" encoding="UTF-8"?>','<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    lines += ['  <url><loc>' + esc(url) + '</loc></url>' for url in links]
    lines.append('</urlset>')
    (ROOT / 'sitemap.xml').write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print(f'제품 {len(products)}개 검색 페이지 생성, 사이트맵 {len(links)}개 주소 갱신 완료')

if __name__ == '__main__':
    main()
