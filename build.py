# /// script
# dependencies = []
# ///
"""meet-caption-fullscreen.js から docs/index.html (GitHub Pages) を生成する。
   使い方: uv run build.py

   GitHub の README は javascript: リンクをサニタイズするため、ドラッグ用リンクは
   Pages (docs/) 側に置き、README からはそこへリンクする。"""
import html
import os
import re
import urllib.parse

REPO_URL = 'https://github.com/yugo-yamamoto/meet-caption-fullscreen'
PAGES_URL = 'https://yugo-yamamoto.github.io/meet-caption-fullscreen/'

src = open('meet-caption-fullscreen.js', encoding='utf-8').read()

# ブロックコメントと行頭インデントを削るだけの安全な圧縮（改行は残すので ASI の影響を受けない）
mini = re.sub(r'/\*.*?\*/', '', src, flags=re.S)
mini = '\n'.join(ln.strip() for ln in mini.split('\n') if ln.strip())

url = 'javascript:' + urllib.parse.quote(mini, safe="!~*'()")

page = '''<meta charset="utf-8"><title>Meet 字幕フルスクリーン</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
body{font-family:"游ゴシック","Yu Gothic",Meiryo,"BIZ UDGothic",sans-serif;max-width:820px;margin:40px auto;padding:0 20px;line-height:1.8;color:#222}
h1{font-size:22px}h2{font-size:18px;margin-top:32px}
a.bm{display:inline-block;background:#1a73e8;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:700;font-size:17px}
.hint{color:#666;font-size:14px}
textarea{width:100%;height:120px;font-family:ui-monospace,monospace;font-size:11px}
button{padding:8px 16px;font-size:14px;border-radius:6px;border:1px solid #999;background:#fff;cursor:pointer}
#log{background:#111;color:#7fd;font-family:ui-monospace,monospace;font-size:12px;padding:8px;height:90px;overflow:auto;border-radius:6px;white-space:pre-wrap}
kbd{background:#f1f3f4;border:1px solid #ccc;border-radius:4px;padding:0 5px;font-size:13px}
</style>
<h1>Meet 字幕フルスクリーン</h1>
<p>Google Meet の字幕エリアだけをブラウザ画面いっぱいに拡大表示するブックマークレットです。
下のボタンを<strong>ブックマークバーへドラッグ＆ドロップ</strong>してください。</p>
<p><a class="bm" href="__HREF__">Meet 字幕フルスクリーン</a></p>
<p class="hint">クリックしても実行されません。ブックマークバーへのドラッグ用リンクです。</p>

<h2>使い方</h2>
<ol>
<li>Google Meet で会議に参加する</li>
<li>Meet 側で字幕(CC)を ON にし、<code>字幕設定を開く</code> → <code>会議の言語</code> を話す言語に合わせる</li>
<li>ブックマークバーの「Meet 字幕フルスクリーン」をクリック</li>
<li>終了は <kbd>Esc</kbd>、「閉じる」ボタン、またはブックマークを再クリック</li>
</ol>

<h2>できること</h2>
<ul>
<li>字幕を巨大表示（<kbd>A-</kbd> / <kbd>A+</kbd> で文字サイズ変更、次回起動時も記憶）</li>
<li>Meet が消してしまう過去の字幕も<strong>履歴として蓄積</strong>してスクロール閲覧</li>
<li><strong>全文コピー</strong>で「話者: 発言」形式のテキストをクリップボードへ</li>
<li>上へスクロールすると自動追尾を停止、最下部に戻すと再開</li>
<li>ログ表示 / ログコピー（不具合報告用）</li>
</ul>

<h2>手動インストール</h2>
<p class="hint">ドラッグできない場合は、下のコードをコピーしてブックマークマネージャで新規ブックマークの URL に貼り付けてください。</p>
<textarea id="code" readonly>__HREF_TEXT__</textarea>
<p><button id="copy">コードをコピー</button></p>
<div id="log">log:</div>

<h2>ソース</h2>
<p><a href="__REPO__">__REPO__</a></p>
<script>
const logEl=document.getElementById('log');
const log=m=>{logEl.textContent+='\\n'+new Date().toTimeString().slice(0,8)+' '+m;logEl.scrollTop=logEl.scrollHeight;};
document.getElementById('copy').onclick=async()=>{
  const v=document.getElementById('code').value;
  try{await navigator.clipboard.writeText(v);log('コピーしました ('+v.length+'文字)');}
  catch(e){document.getElementById('code').select();document.execCommand('copy');log('fallbackコピー: '+e.message);}
};
document.querySelector('a.bm').addEventListener('click',e=>{e.preventDefault();log('ここでは実行できません。ブックマークバーへドラッグしてください');});
log('読み込み完了 / コード長 '+document.getElementById('code').value.length);
</script>
'''
page = (page.replace('__HREF__', html.escape(url, quote=True))
            .replace('__HREF_TEXT__', html.escape(url))
            .replace('__REPO__', REPO_URL))

os.makedirs('docs', exist_ok=True)
open('docs/index.html', 'w', encoding='utf-8').write(page)
# Jekyll に処理させない（アンダースコア始まりのファイル対策・ビルド高速化）
open('docs/.nojekyll', 'w', encoding='utf-8').write('')

print('source : %d chars' % len(src))
print('minified: %d chars' % len(mini))
print('bookmarklet: %d chars -> docs/index.html' % len(url))
print('pages url: %s' % PAGES_URL)
