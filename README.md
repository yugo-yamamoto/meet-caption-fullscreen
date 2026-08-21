# Meet 字幕フルスクリーン

Google Meet の**字幕エリアだけをブラウザ画面いっぱいに拡大表示**するブックマークレットです。
Meet 標準の字幕は数行で流れて消えてしまうため、字幕を大きく表示しつつ**過去の発話を履歴として蓄積**します。

## インストール

**→ [インストールページを開く](https://yugo-yamamoto.github.io/meet-caption-fullscreen/)**

開いたページの青いボタンを**ブックマークバーへドラッグ＆ドロップ**してください。

> [!NOTE]
> GitHub は README 内の `javascript:` リンクをサニタイズして無効化するため、
> ドラッグ用のリンクはこの README には埋め込めません。上記の GitHub Pages 上のページから登録してください。
> ドラッグを使わない場合は [`bookmarklet.txt`](bookmarklet.txt) の中身をコピーし、
> ブックマークマネージャで新規ブックマークの URL 欄に貼り付けてもインストールできます。

## 使い方

1. Google Meet で会議に参加する（字幕が OFF なら**自動で ON にします**）
2. ブックマークバーの「Meet 字幕フルスクリーン」をクリック
3. 終了は <kbd>Esc</kbd>、「閉じる」ボタン、またはブックマークを再クリック（トグル）

ブラウザの Fullscreen API は使わず、ページ内のオーバーレイ（`position: fixed`）として最大化します。
Meet 本体はオーバーレイの裏で動き続けるため、退出やミュートはオーバーレイを閉じてから操作してください。

## 機能

| 操作 | 内容 |
| --- | --- |
| `A-` / `A+` | 文字サイズ変更（`localStorage` に保存し次回も再現） |
| `字幕ON` | 字幕(CC)を手動で ON（自動 ON が効かなかったとき用） |
| `全文コピー` | 「話者: 発言」形式の全履歴をクリップボードへ |
| `履歴クリア` | 蓄積した発話履歴を破棄 |
| `ログ表示` / `ログコピー` | 検出状況・動作ログの確認とコピー（不具合報告用） |
| `閉じる` | オーバーレイを終了（<kbd>Esc</kbd> でも可） |

- 字幕が OFF のときは Meet の CC ボタン（`aria-label="字幕をオンにする"` / `"Turn on captions"`）を
  自動でクリックして ON にします（最大 3 回・3 秒間隔。「オフにする」側は押しません）
- 発話中の行はリアルタイムに書き換わり、確定済みの発話は履歴として残ります
- 上へスクロールすると自動追尾を停止し、最下部に戻すと再開します

## 実装メモ

### Meet の CSP (Trusted Types) 対応

Meet は `require-trusted-types-for 'script'` を強制しているため、`innerHTML` への代入は
`This document requires 'TrustedHTML' assignment.` でブロックされます。そのため

- UI は `createElement` / `textContent` のみで構築（`innerHTML` 不使用）
- CSS はインライン `<style>` ではなく CSSOM の `sheet.insertRule()` で注入（`style-src` 制限を回避）
- さらに `element.style` で最低限のレイアウトを二重に適用し、CSS が全滅しても崩れないようにしています

### 字幕(CC)の自動 ON

字幕コンテナが見つからない、または発話行が空のときは、`button` / `[role="button"]` などの中から
`aria-label`（または `data-tooltip` / `title`）が「字幕」系かつ「オンにする / turn on / enable」に
マッチするものを探してクリックします。「オフにする」を含むラベルは対象外なので、
既に ON の状態で誤って OFF にすることはありません。無駄打ちを防ぐため自動実行は最大 3 回・3 秒間隔で、
ツールバーの `字幕ON` から手動で再試行できます。

### 字幕コンテナの検出（難読化クラス名を使わない）

`.a4cQT` などの難読化クラス名は Meet の更新で変わるため一切使わず、ARIA 属性と DOM 構造で判定します。

実測した Meet の DOM（2026-08 時点）:

- 字幕エリアは `div[role="region"][aria-label="字幕"]`。**内側に `aria-live` は無い**
- ページ上の `aria-live` は画面外（`top:-9999px` / `height:1px`）の読み上げ専用アナウンサーのみ
  （`自動字幕起こしがオンになっています` / `読み込み中...`）
- 同じ「字幕」を含むラベルを持つおとりが複数ある:
  `字幕をオン/オフにする`（ボタン）、`字幕の種類`（`role=combobox` / `role=listbox`）、
  `字幕設定を開く`（ボタン）、`最新の字幕に移動`（ボタン）

判定はこの実測に合わせた 4 段構成です。

1. **コンテナ**: `[aria-label]` のうち `字幕` / `Captions` などに**完全一致**するものを採用。
   おとりを外すため、`button` / `a` / `[role="button"]` / `[role="combobox"]` / `[role="listbox"]` /
   `[role="tab"]` などの内側にあるものと、「オンにする」「設定」「種類」「翻訳」「移動」
   「turn on/off」「settings」等の操作・設定系ラベルは除外します。
   複数残った場合は（画面外アナウンサーを除いた）`aria-live` を含むもの優先 → テキスト量が多い順。
2. 完全一致が無ければ**部分一致**
3. それも無ければ**可視の `aria-live` リージョン**でテキスト量最大のもの。
   `[role="status"]` / `[aria-atomic="true"]` / `[data-mdc-dom-announce]` や画面外要素は
   アナウンサーとして除外します（除外しないとここを字幕と誤認します）
4. 最後に**可視の `[role="region"]`** でテキスト量最大のもの（ラベル文言が変わった場合の保険）
5. **発話行**: コンテナ内に（アナウンサーでない）`aria-live` があればそれを、無ければコンテナ自身を起点に、
   子が 1 つだけのラッパ階層を掘り下げ、その子要素を行として扱う
6. **話者名と本文**: 行内の「テキストを持つ末端要素」を順に集め、先頭が 30 文字以内なら話者名、残りを本文として連結
   （入れ子の深さに依存しない）。名前が取れない場合はアバターの `img[alt]` で補完

どの段で検出できたかは `ログ表示` に出ます（例: `字幕コンテナを検出 [aria-label 完全一致 ("字幕")] <div>`）。

### 発話の重複排除

Meet は発話中の行の DOM ノードを再利用してテキストを書き換えるため、行要素そのものを `WeakMap` のキーにして
通し番号を振り、同じノードなら「更新」、初見なら「新規発話」と判定します。
ノードごと作り直された場合の保険として、直前のエントリが DOM から外れており、話者が同じで
前後どちらかが他方の接頭辞なら継続と見なして統合します。

## 開発

```bash
# ソースを編集したら再ビルド（bookmarklet.txt と docs/index.html を再生成）
uv run build.py
```

- `meet-caption-fullscreen.js` — 本体（編集はここだけ）
- `build.py` — コメント除去 → URL エンコード → `bookmarklet.txt` / `docs/index.html` を生成
- `docs/` — GitHub Pages 用のインストールページ（Settings → Pages で `main` / `docs` を指定）

### 動作確認

Meet と同じ CSP を付けたローカルサーバーと、難読化クラスを持たない字幕 DOM シミュレータで検証できます。

```bash
uv run serve_csp.py 8765     # require-trusted-types-for 'script'; style-src 'self' を付与
# http://localhost:8765/test-meet-dom.html?autoclick
```

| クエリ | 検証内容 |
| --- | --- |
| `?autoclick` | ツールバー全ボタンを自動クリックして例外が出ないか |
| `?en` | 英語 UI（`aria-label="Captions"`）で検出できるか |
| `?ccoff` | 字幕 OFF 状態から CC ボタンを自動クリックして ON にできるか |
| `?nolabel` | `aria-label` 消失時に `aria-live` フォールバックが働くか |
| `?onlydecoy` | 字幕リージョンのラベルを外し、おとり（CC ボタン / `字幕の種類` リストボックス / 設定ボタン）を誤検出しないか |
| `?noregion` | `aria-label` も `role=region` も無い場合に、画面外アナウンサーを誤検出しないか（何も掴まなければ OK） |

ヘッドレス Chrome での確認例:

```bash
google-chrome --headless=new --screenshot=shot.png --window-size=1400,760 \
  "http://localhost:8765/test-meet-dom.html?autoclick"
```

## 対応環境

Chrome / Edge など Chromium 系ブラウザ。ブックマークレットのため拡張機能のインストールは不要です。

## ライセンス

MIT License — [LICENSE](LICENSE)
