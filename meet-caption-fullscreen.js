/* Google Meet 字幕エリアだけを全画面表示するブックマークレット (source) */
(function () {
  'use strict';

  var ID = 'mcf-overlay';
  var prev = document.getElementById(ID);
  if (prev) { prev.__mcfClose(); return; }

  if (!/(^|\.)meet\.google\.com$/.test(location.hostname) && !window.MCF_FORCE &&
      !confirm('Google Meet ではないページですが、字幕ビューアを起動しますか？')) {
    return;
  }

  /* ---------------- state ---------------- */
  var LS_FONT = 'mcf.fontSize';
  var fontSize = parseInt(localStorage.getItem(LS_FONT) || '', 10) || 44;
  var entries = [];          /* {id, name, text, row, el, nameEl, textEl} */
  var rowIds = new WeakMap();
  var seq = 0;
  var container = null;
  var observer = null;
  var autoScroll = true;
  var logLines = [];

  /* ---------------- overlay ---------------- */
  /* CSP(style-src) 対策: インラインCSSではなく CSSOM の insertRule で注入する */
  var css = document.createElement('style');
  css.id = 'mcf-style';
  document.documentElement.appendChild(css);
  [
    '#mcf-overlay{position:fixed;inset:0;z-index:2147483647;display:flex;flex-direction:column;background:#000;color:#fff;font-family:"\u6e38\u30b4\u30b7\u30c3\u30af","Yu Gothic",Meiryo,"BIZ UDGothic",sans-serif;}',
    '#mcf-overlay *{box-sizing:border-box;}',
    '#mcf-bar{flex:0 0 auto;display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:6px 10px;background:#111;border-bottom:1px solid #333;font-size:13px;}',
    '#mcf-bar button{background:#2a2a2a;color:#fff;border:1px solid #555;border-radius:6px;padding:4px 10px;font-size:13px;cursor:pointer;font-family:inherit;}',
    '#mcf-bar button:hover{background:#3a3a3a;}',
    '#mcf-bar .mcf-stat{color:#9aa;margin-left:auto;}',
    '#mcf-body{flex:1 1 auto;overflow-y:auto;padding:24px 32px 40vh;}',
    '#mcf-overlay .mcf-e{margin:0 0 22px;}',
    '#mcf-overlay .mcf-n{color:#8ab4f8;font-size:.42em;font-weight:700;letter-spacing:.04em;margin-bottom:2px;}',
    '#mcf-overlay .mcf-t{line-height:1.45;white-space:pre-wrap;word-break:break-word;}',
    '#mcf-log{flex:0 0 auto;display:none;max-height:22vh;overflow-y:auto;background:#0b0b0b;border-top:1px solid #333;padding:6px 10px;font-family:ui-monospace,monospace;font-size:12px;line-height:1.5;white-space:pre-wrap;color:#7fd;}',
    '#mcf-empty{color:#888;font-size:18px;padding:8px 0;line-height:1.7;}'
  ].forEach(function (rule, n) {
    try { css.sheet.insertRule(rule, n); } catch (e) { /* 個別ルール失敗は無視 */ }
  });

  function el(tag, props, parent) {
    var e = document.createElement(tag);
    if (props) { for (var k in props) { if (k === 'text') { e.textContent = props[k]; } else { e.setAttribute(k, props[k]); } } }
    if (parent) parent.appendChild(e);
    return e;
  }

  var ov = el('div', { id: ID });
  var bar = el('div', { id: 'mcf-bar' }, ov);
  [['minus', 'A-'], ['plus', 'A+'], ['copy', '\u5168\u6587\u30b3\u30d3\u30fc'], ['clear', '\u5c65\u6b74\u30af\u30ea\u30a2'],
   ['log', '\u30ed\u30b0\u8868\u793a'], ['copylog', '\u30ed\u30b0\u30b3\u30d4\u30fc'], ['close', '\u9589\u3058\u308b (Esc)']]
    .forEach(function (b) { el('button', { 'data-a': b[0], text: b[1] }, bar); });
  var stat = el('span', { 'class': 'mcf-stat' }, bar);
  var body = el('div', { id: 'mcf-body' }, ov);
  var empty = el('div', { id: 'mcf-empty' }, body);
  empty.appendChild(document.createTextNode('\u5b57\u5e55\u3092\u5f85\u3063\u3066\u3044\u307e\u3059\u2026'));
  el('br', null, empty);
  empty.appendChild(document.createTextNode('Meet \u5074\u3067\u5b57\u5e55(CC) \u3092 ON \u306b\u3057\u3066\u304f\u3060\u3055\u3044\u3002\u3053\u306e\u30aa\u30fc\u30d0\u30fc\u30ec\u30a4\u306e\u88cf\u3067 Meet \u306f\u52d5\u304d\u7d9a\u3051\u3066\u3044\u307e\u3059\u3002'));
  var logBox = el('div', { id: 'mcf-log' }, ov);
  document.body.appendChild(ov);
  /* stylesheet が効かない環境でも最低限のレイアウトを保証する (element.style は CSP 非対象) */
  ov.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:2147483647;display:flex;' +
    'flex-direction:column;background:#000;color:#fff;font-family:"游ゴシック","Yu Gothic",Meiryo,sans-serif;';
  bar.style.cssText = 'flex:0 0 auto;display:flex;align-items:center;gap:6px;flex-wrap:wrap;' +
    'padding:6px 10px;background:#111;border-bottom:1px solid #333;font-size:13px;';
  [].forEach.call(bar.querySelectorAll('button'), function (b) {
    b.style.cssText = 'background:#2a2a2a;color:#fff;border:1px solid #555;border-radius:6px;' +
      'padding:4px 10px;font-size:13px;cursor:pointer;font-family:inherit;';
  });
  stat.style.cssText = 'color:#9aa;margin-left:auto;';
  body.style.cssText = 'flex:1 1 auto;overflow-y:auto;padding:24px 32px 40vh;';
  empty.style.cssText = 'color:#888;font-size:18px;line-height:1.7;';
  logBox.style.cssText = 'flex:0 0 auto;display:none;max-height:22vh;overflow-y:auto;background:#0b0b0b;' +
    'border-top:1px solid #333;padding:6px 10px;font-family:ui-monospace,monospace;font-size:12px;' +
    'line-height:1.5;white-space:pre-wrap;color:#7fd;';


  function log(msg) {
    var t = new Date().toTimeString().slice(0, 8);
    logLines.push('[' + t + '] ' + msg);
    if (logLines.length > 300) logLines.shift();
    logBox.textContent = logLines.join('\n');
    logBox.scrollTop = logBox.scrollHeight;
  }

  function applyFont() {
    body.style.fontSize = fontSize + 'px';
    localStorage.setItem(LS_FONT, String(fontSize));
  }
  applyFont();

  /* ---------------- caption DOM ----------------
     難読化クラス名 (.a4cQT / .nMcdL など) は Meet の更新で変わるため一切使わない。
     コンテナは aria-label / aria-live、行と話者名は DOM 構造だけで判定する。 */

  /* 字幕リージョンの aria-label（UI 言語で変わる）。ボタン類は別途除外する */
  var LABEL_EXACT = /^(字幕|キャプション|captions?|subtitles?|sous-titres|untertitel|subtítulos|legendas|자막|자막\s*표시|字幕記録)$/i;
  var LABEL_LOOSE = /字幕|キャプション|caption|subtitle|sous-titre|untertitel|subtítulo|legenda|자막/i;
  /* 「字幕をオンにする」などの操作系ラベルを弾く */
  var LABEL_ACTION = /オンにする|オフにする|開く|閉じる|設定|変更|turn (on|off)|open|close|settings?|options?|more/i;
  var strategy = '';

  function isInteractive(el) {
    return !!el.closest('button,a,[role="button"],[role="menuitem"],[role="tab"],[role="checkbox"],[role="switch"]');
  }

  function textLen(el) {
    return ((el.innerText || el.textContent || '').trim()).length;
  }

  function labelCandidates(re) {
    return [].filter.call(document.querySelectorAll('[aria-label]'), function (el) {
      if (ov.contains(el) || isInteractive(el)) return false;
      var label = el.getAttribute('aria-label') || '';
      return re.test(label) && !LABEL_ACTION.test(label);
    });
  }

  function pickBest(cands) {
    /* aria-live を含むものを優先し、次にテキスト量が多いものを選ぶ */
    var scored = cands.map(function (el) {
      return { el: el, live: el.matches('[aria-live]') || !!el.querySelector('[aria-live]') ? 1 : 0, len: textLen(el) };
    });
    scored.sort(function (a, b) { return (b.live - a.live) || (b.len - a.len); });
    return scored.length ? scored[0].el : null;
  }

  function findContainer() {
    var byLabel = pickBest(labelCandidates(LABEL_EXACT));
    if (byLabel) { strategy = 'aria-label 完全一致 ("' + byLabel.getAttribute('aria-label') + '")'; return byLabel; }

    var loose = pickBest(labelCandidates(LABEL_LOOSE).filter(function (el) {
      return el.matches('[aria-live]') || !!el.querySelector('[aria-live]') || textLen(el) > 0;
    }));
    if (loose) { strategy = 'aria-label 部分一致 ("' + loose.getAttribute('aria-label') + '")'; return loose; }

    /* 最後の手段: 画面上のライブリージョンのうちテキスト量が最大のもの */
    var live = [].filter.call(document.querySelectorAll('[aria-live="polite"],[aria-live="assertive"]'), function (el) {
      return !ov.contains(el) && !isInteractive(el);
    });
    live.sort(function (a, b) { return textLen(b) - textLen(a); });
    if (live.length) { strategy = 'aria-live フォールバック'; return live[0]; }
    return null;
  }

  function findRows(c) {
    /* 字幕本体はライブリージョン内にある。無ければコンテナ自身を起点にする */
    var root = c.matches('[aria-live]') ? c : (c.querySelector('[aria-live]') || c);
    /* 子が1つだけのラッパ階層を掘り下げて、発話が並ぶ親まで降りる */
    while (root.children.length === 1 && root.firstElementChild.children.length) {
      root = root.firstElementChild;
    }
    var rows = [].filter.call(root.children, function (el) { return textLen(el) > 0; });
    if (!rows.length && textLen(root) > 0) rows = [root];
    return rows;
  }

  function parseRow(row) {
    /* テキストを持つ末端要素を順に集める。先頭が話者名、残りが発話本文という構造を利用する
       (行がさらに入れ子でも末端は同じ順に並ぶので深さに依存しない) */
    var leaves = [].filter.call(row.querySelectorAll('*'), function (el) {
      return el.children.length === 0 && textLen(el) > 0;
    });
    var name = '', text = '';

    if (leaves.length >= 2) {
      var head = (leaves[0].innerText || '').trim();
      if (head.length <= 30 && head.indexOf('\n') < 0) {
        name = head;
        leaves = leaves.slice(1);
      }
      text = leaves.map(function (el) { return (el.innerText || '').trim(); }).join(' ');
    } else if (leaves.length === 1) {
      text = (leaves[0].innerText || '').trim();
    } else {
      /* 末端が取れない構造では innerText を行単位で分解する */
      var all = (row.innerText || '').trim();
      var nl = all.indexOf('\n');
      if (nl > 0 && nl <= 30) { name = all.slice(0, nl).trim(); all = all.slice(nl + 1); }
      text = all;
    }

    if (!name) {
      var av = row.querySelector('img[alt]');
      if (av && av.alt && av.alt.trim().length <= 30) name = av.alt.trim();
    }
    return { name: name.replace(/\s*\n\s*/g, ' '), text: text.replace(/\s*\n\s*/g, ' ').trim() };
  }

  function makeEntryEl(e) {
    var wrap = document.createElement('div');
    wrap.className = 'mcf-e';
    wrap.style.margin = '0 0 22px';
    var n = document.createElement('div');
    n.className = 'mcf-n';
    n.style.cssText = 'color:#8ab4f8;font-size:.42em;font-weight:700;letter-spacing:.04em;margin-bottom:2px;';
    var t = document.createElement('div');
    t.className = 'mcf-t';
    t.style.cssText = 'line-height:1.45;white-space:pre-wrap;word-break:break-word;';
    wrap.appendChild(n); wrap.appendChild(t);
    e.el = wrap; e.nameEl = n; e.textEl = t;
    n.textContent = e.name;
    t.textContent = e.text;
    return wrap;
  }

  function nearBottom() {
    return body.scrollHeight - body.scrollTop - body.clientHeight < 80;
  }

  function sync() {
    if (!container || !document.contains(container)) {
      var c = findContainer();
      if (c !== container) {
        container = c;
        if (observer) { observer.disconnect(); observer = null; }
        if (container) {
          log('字幕コンテナを検出 [' + strategy + '] <' + container.tagName.toLowerCase() + '>');
          observer = new MutationObserver(function () { sync(); });
          observer.observe(container, { childList: true, subtree: true, characterData: true });
        }
      }
      if (!container) return;
    }

    var rows = findRows(container);
    var stick = autoScroll && nearBottom();
    var changed = false;

    rows.forEach(function (row) {
      var p = parseRow(row);
      if (!p.text) return;
      var id = rowIds.get(row);
      if (id === undefined) {
        /* 同じ発話の DOM が作り直された場合は直前のエントリを更新扱いにする */
        var last = entries[entries.length - 1];
        if (last && last.name === p.name && !document.contains(last.row) &&
            (p.text.indexOf(last.text) === 0 || last.text.indexOf(p.text) === 0)) {
          rowIds.set(row, last.id);
          last.row = row;
          if (last.text !== p.text) { last.text = p.text; last.textEl.textContent = p.text; changed = true; }
          return;
        }
        id = ++seq;
        rowIds.set(row, id);
        var e = { id: id, name: p.name, text: p.text, row: row };
        entries.push(e);
        body.appendChild(makeEntryEl(e));
        changed = true;
        log('新しい発話 #' + id + ' ' + (p.name || '(名前不明)'));
      } else {
        var cur = null;
        for (var i = entries.length - 1; i >= 0; i--) { if (entries[i].id === id) { cur = entries[i]; break; } }
        if (!cur) return;
        cur.row = row;
        if (cur.text !== p.text) { cur.text = p.text; cur.textEl.textContent = p.text; changed = true; }
        if (p.name && cur.name !== p.name) { cur.name = p.name; cur.nameEl.textContent = p.name; changed = true; }
      }
    });

    if (changed) {
      empty.style.display = entries.length ? 'none' : '';
      stat.textContent = entries.length + ' 発話 / ' + fontSize + 'px' + (autoScroll ? '' : ' (自動スクロール停止)');
      if (stick) body.scrollTop = body.scrollHeight;
    }
  }

  /* ---------------- controls ---------------- */
  function transcript() {
    return entries.map(function (e) { return (e.name ? e.name + ': ' : '') + e.text; }).join('\n');
  }

  function copy(text, label) {
    var done = function () { log(label + 'をクリップボードにコピーしました (' + text.length + '文字)'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function (err) { fallbackCopy(text, done, err); });
    } else { fallbackCopy(text, done); }
  }
  function fallbackCopy(text, done, err) {
    var ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    ov.appendChild(ta); ta.select();
    try { document.execCommand('copy'); done(); }
    catch (e2) { log('コピー失敗: ' + (err || e2)); }
    ov.removeChild(ta);
  }

  bar.addEventListener('click', function (ev) {
    var a = ev.target.getAttribute && ev.target.getAttribute('data-a');
    if (!a) return;
    if (a === 'plus') { fontSize = Math.min(160, fontSize + 4); applyFont(); log('文字サイズ ' + fontSize + 'px'); }
    else if (a === 'minus') { fontSize = Math.max(14, fontSize - 4); applyFont(); log('文字サイズ ' + fontSize + 'px'); }
    else if (a === 'copy') { copy(transcript(), '字幕全文'); }
    else if (a === 'copylog') { copy(logLines.join('\n'), 'ログ'); }
    else if (a === 'clear') {
      entries.length = 0; seq = 0; rowIds = new WeakMap();
      [].slice.call(body.querySelectorAll('.mcf-e')).forEach(function (el) { el.remove(); });
      empty.style.display = ''; log('履歴をクリアしました');
    } else if (a === 'log') {
      var on = logBox.style.display !== 'block';
      logBox.style.display = on ? 'block' : 'none';
      ev.target.textContent = on ? 'ログ非表示' : 'ログ表示';
    } else if (a === 'close') { ov.__mcfClose(); }
    stat.textContent = entries.length + ' 発話 / ' + fontSize + 'px';
  });

  body.addEventListener('scroll', function () {
    var b = nearBottom();
    if (b !== autoScroll) {
      autoScroll = b;
      log(b ? '自動スクロール再開' : '自動スクロール停止 (最下部に戻すと再開)');
    }
  });

  function onKey(ev) {
    if (ev.key === 'Escape' && !document.fullscreenElement) { ov.__mcfClose(); }
  }
  document.addEventListener('keydown', onKey, true);

  var timer = setInterval(sync, 700);

  ov.__mcfClose = function () {
    clearInterval(timer);
    if (observer) observer.disconnect();
    document.removeEventListener('keydown', onKey, true);
    if (document.fullscreenElement === ov) { document.exitFullscreen().catch(function () {}); }
    ov.remove(); css.remove();
  };

  if (ov.requestFullscreen) {
    ov.requestFullscreen().then(function () { log('全画面表示に入りました'); },
      function (e) { log('全画面API失敗 (画面全体を覆う表示で継続): ' + e.message); });
  }

  log('起動しました。Meet の字幕(CC)を ON にしてください。');
  sync();
})();
