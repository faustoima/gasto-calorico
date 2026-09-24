/* =========================================================================
   Prato do Dia — Módulo de Dados (exportar / importar / relatório em PDF)
   -------------------------------------------------------------------------
   - Não altera dados, fórmulas, tabelas de alimentos ou de exercícios.
   - Lê e grava direto no IndexedDB local (mesmo banco usado pelo sw.js).
   - Funciona offline, em PWA instalado, Android, iPhone e navegador.
   Carregado com <script defer src="./assets/pd-data.js"></script>
   ========================================================================= */
(function () {
  "use strict";

  // --------------------------- Constantes ---------------------------------
  var DB_NAME = "prato-do-dia-offline-v2";
  var DB_VERSION = 1;
  var STORE = "data";
  var BACKUP_VERSION = 1;

  var KEYS = [
    "profile",
    "body",
    "entries",
    "exercises",
    "workouts",
    "daily",
    "settings",
    "users"
  ];

  var LABELS = {
    profile: "Perfil",
    body: "Avaliações corporais",
    entries: "Refeições lançadas",
    exercises: "Exercícios salvos",
    workouts: "Treinos registrados",
    daily: "Hidratação diária",
    settings: "Configurações",
    users: "Usuários"
  };

  var C = {
    bg: "hsl(var(--background, 44 22% 96%))",
    card: "hsl(var(--card, 44 30% 99%))",
    fg: "hsl(var(--foreground, 80 12% 12%))",
    muted: "hsl(var(--muted, 42 14% 92%))",
    mutedFg: "hsl(var(--muted-foreground, 80 6% 38%))",
    border: "hsl(var(--border, 42 12% 86%))",
    primary: "hsl(var(--primary, 152 38% 27%))",
    destructive: "hsl(var(--destructive, 14 57% 42%))"
  };

  // ------------------------------ IndexedDB --------------------------------
  function openDB() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function () {
        if (!req.result.objectStoreNames.contains(STORE)) {
          req.result.createObjectStore(STORE);
        }
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function dbGet(db, key) {
    return new Promise(function (resolve, reject) {
      var r = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
      r.onsuccess = function () { resolve(r.result); };
      r.onerror = function () { reject(r.error); };
    });
  }

  function dbPut(db, key, value) {
    return new Promise(function (resolve, reject) {
      var r = db.transaction(STORE, "readwrite").objectStore(STORE).put(value, key);
      r.onsuccess = function () { resolve(); };
      r.onerror = function () { reject(r.error); };
    });
  }

  function collectAll() {
    return openDB().then(function (db) {
      var data = {};
      var chain = Promise.resolve();
      KEYS.forEach(function (k) {
        chain = chain.then(function () {
          return dbGet(db, k).then(function (v) { data[k] = v; });
        });
      });
      return chain.then(function () {
        db.close();
        return data;
      });
    });
  }

  function restoreAll(data) {
    return openDB().then(function (db) {
      var chain = Promise.resolve();
      KEYS.forEach(function (k) {
        if (data[k] === undefined) return;
        chain = chain.then(function () { return dbPut(db, k, data[k]); });
      });
      return chain.then(function () { db.close(); });
    });
  }

  // ----------------------------- Utilidades --------------------------------
  function pad2(n) { return n < 10 ? "0" + n : "" + n; }

  function fmtDate(d) {
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  function fmtBytes(n) {
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
    return (n / 1024 / 1024).toFixed(2) + " MB";
  }

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(url);
      if (a.parentNode) a.parentNode.removeChild(a);
    }, 2500);
  }

  function toast(message, kind) {
    var el = document.createElement("div");
    el.textContent = message;
    var bg = kind === "error" ? "#a52a2a"
           : kind === "success" ? "#2f7a4d"
           : "#1f2937";
    el.style.cssText =
      "position:fixed;left:50%;bottom:26px;transform:translateX(-50%) translateY(6px);" +
      "z-index:100000;padding:12px 18px;border-radius:10px;font:500 14px system-ui;" +
      "color:#fff;max-width:90vw;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,.3);" +
      "opacity:0;transition:opacity .2s ease,transform .2s ease;background:" + bg + ";";
    document.body.appendChild(el);
    requestAnimationFrame(function () {
      el.style.opacity = "1";
      el.style.transform = "translateX(-50%) translateY(0)";
    });
    setTimeout(function () {
      el.style.opacity = "0";
      el.style.transform = "translateX(-50%) translateY(6px)";
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 220);
    }, 2800);
  }

  // ------------------------------ Exportações ------------------------------
  function summarize() {
    return collectAll().then(function (data) {
      var summary = {};
      KEYS.forEach(function (k) {
        var v = data[k];
        summary[k] = Array.isArray(v) ? v.length : (v ? 1 : 0);
      });
      return { data: data, summary: summary };
    });
  }

  function exportJSON() {
    return summarize().then(function (r) {
      var payload = {
        app: "Prato do Dia",
        appVersion: "1.0",
        backupVersion: BACKUP_VERSION,
        exportedAt: new Date().toISOString(),
        counts: r.summary,
        data: r.data
      };
      var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      downloadBlob(blob, "prato-do-dia-backup-" + fmtDate(new Date()) + ".json");
      toast("Backup exportado · " + fmtBytes(blob.size), "success");
    });
  }

  function csvCell(v) {
    var s = v === null || v === undefined ? "" : String(v);
    return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function exportCSV() {
    return collectAll().then(function (data) {
      var rows = [[
        "tipo", "data", "hora", "refeicao", "descricao", "quantidade", "medida",
        "gramas", "kcal", "proteina_g", "carboidrato_g", "gordura_g",
        "fibra_g", "sodio_mg", "observacoes"
      ]];

      (data.entries || []).forEach(function (e) {
        rows.push([
          "refeicao", e.date, e.time, e.meal, e.food,
          e.qty, e.measure, e.grams,
          e.kcal, e.prot, e.carb, e.fat, e.fiber, e.sodium, e.source
        ]);
      });

      (data.workouts || []).forEach(function (w) {
        rows.push([
          "exercicio", w.date, w.time, "", w.name,
          w.minutes, "min", "", w.kcalGross,
          "", "", "", "", "", w.notes
        ]);
      });

      (data.body || []).forEach(function (b) {
        rows.push([
          "corpo", b.date, "", "", "avaliação corporal",
          b.weight, "kg", "", "", "", "", "", "", "", b.notes
        ]);
      });

      (data.daily || []).forEach(function (d) {
        rows.push([
          "hidratacao", d.date, "", "", "água",
          d.waterMl, "ml", "", "", "", "", "", "", "", ""
        ]);
      });

      var csv = "\uFEFF" + rows.map(function (r) {
        return r.map(csvCell).join(",");
      }).join("\r\n");

      var blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      downloadBlob(blob, "prato-do-dia-" + fmtDate(new Date()) + ".csv");
      toast("CSV exportado · " + fmtBytes(blob.size), "success");
    });
  }

  // ----------------------------- Importação --------------------------------
  function handleImport(file) {
    if (!file) return;
    if (!/\.json$/i.test(file.name)) {
      toast("Selecione um arquivo JSON de backup.", "error");
      return;
    }

    file.text().then(function (text) {
      var parsed;
      try {
        parsed = JSON.parse(text);
      } catch (e) {
        toast("Arquivo inválido: não é um JSON válido.", "error");
        return;
      }

      var data = parsed && parsed.data ? parsed.data : parsed;
      if (!data || typeof data !== "object") {
        toast("Arquivo sem dados reconhecíveis.", "error");
        return;
      }

      var found = KEYS.filter(function (k) { return data[k] !== undefined; });
      if (!found.length) {
        toast("Nenhum dado do Prato do Dia neste arquivo.", "error");
        return;
      }

      var lines = found.map(function (k) {
        var v = data[k];
        var n = Array.isArray(v) ? v.length : (v ? 1 : 0);
        return "• " + (LABELS[k] || k) + ": " + n;
      }).join("\n");

      var exportedAt = parsed && parsed.exportedAt
        ? new Date(parsed.exportedAt).toLocaleString("pt-BR")
        : "desconhecida";

      var msg =
        "Importar este backup?\n\n" +
        "Arquivo: " + file.name + "\n" +
        "Tamanho: " + fmtBytes(file.size) + "\n" +
        "Exportado em: " + exportedAt + "\n\n" +
        "Conteúdo:\n" + lines + "\n\n" +
        "ATENÇÃO: os dados atuais deste aparelho serão SUBSTITUÍDOS.\n" +
        "Recomendamos exportar um backup antes de continuar.\n\n" +
        "Deseja continuar?";

      if (!confirm(msg)) return;

      restoreAll(data).then(function () {
        toast("Dados importados com sucesso. Recarregando…", "success");
        setTimeout(function () { location.reload(); }, 900);
      }).catch(function (e) {
        console.error(e);
        toast("Falha ao importar os dados.", "error");
      });
    });
  }

  // -------------------------------- PDF -----------------------------------
  function exportPDF() {
    var win = window.open("", "_blank");
    if (!win) {
      toast("Permita a abertura de novas janelas para gerar o PDF.", "error");
      return;
    }
    win.document.write("<p style='font:16px system-ui;padding:20px'>Gerando relatório…</p>");

    collectAll().then(function (data) {
      var p = data.profile || {};
      var today = fmtDate(new Date());
      var day = (data.daily || []).find(function (x) { return x.date === today; }) || {};
      var entries = data.entries || [];
      var workouts = data.workouts || [];
      var body = (data.body || [])
        .filter(function (x) { return x && x.date; })
        .sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });
      var last = body[body.length - 1] || {};
      var first = body[0] || {};

      function delta(a, b) {
        return (a != null && b != null)
          ? " (" + (a - b >= 0 ? "+" : "") + (a - b).toFixed(1) + ")"
          : "";
      }

      win.document.documentElement.innerHTML =
        "<head><title>Relatório Prato do Dia</title><style>" +
        "body{font:14px/1.55 Arial,system-ui;color:#17352e;max-width:760px;margin:32px auto;padding:0 20px}" +
        "h1{color:#0e2c4b;border-bottom:2px solid #2d8061;padding-bottom:10px}" +
        "h2{color:#0e2c4b;margin-top:26px}" +
        ".grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}" +
        ".card{border:1px solid #ccd8d1;border-radius:10px;padding:12px;background:#fafcfb}" +
        "small{color:#667}" +
        "</style></head><body>" +
        "<h1>Prato do Dia — Painel resumo</h1>" +
        "<small>Gerado em " + new Date().toLocaleString("pt-BR") + "</small>" +
        "<div class='grid'>" +
          "<div class='card'><b>Perfil</b><br>" + (p.name || "") +
            "<br>Peso: " + (p.weightKg || "—") + " kg" +
            "<br>Meta: " + (p.kcalGoal || "calculada") + " kcal/dia</div>" +
          "<div class='card'><b>Hidratação</b><br>" + (day.waterMl || 0) + " ml registrados" +
            "<br>Meta: " + (p.waterMl || "—") + " ml/dia</div>" +
          "<div class='card'><b>Alimentação</b><br>" + entries.length + " registros</div>" +
          "<div class='card'><b>Exercícios</b><br>" + workouts.length + " registros</div>" +
        "</div>" +
        "<h2>Evolução das medidas</h2>" +
        "<p>Registros: " + body.length + ". Última avaliação: " + (last.date || "—") + "</p>" +
        "<div class='card'>" +
          "Peso: " + (last.weight != null ? last.weight : "—") + " kg" + delta(last.weight, first.weight) + "<br>" +
          "Gordura: " + (last.bodyFat != null ? last.bodyFat : "—") + "%" + delta(last.bodyFat, first.bodyFat) + "<br>" +
          "Cintura: " + (last.waist != null ? last.waist : "—") + " cm" + delta(last.waist, first.waist) + "<br>" +
          "Quadril: " + (last.hip != null ? last.hip : "—") + " cm" + delta(last.hip, first.hip) + "<br>" +
          "RMR: " + (last.rmrBio != null ? last.rmrBio : "—") + " kcal" +
        "</div>" +
        "<h2>Observação</h2>" +
        "<p>Este relatório é uma estimativa e não substitui orientação de nutricionista ou médico.</p>" +
        "</body>";

      win.focus();
      setTimeout(function () { win.print(); }, 400);
    }).catch(function (e) {
      console.error(e);
      win.document.body.innerHTML = "<p>Não foi possível gerar o relatório.</p>";
    });
  }

  // --------------------------------- UI -----------------------------------
  function ensureUI() {
    if (document.getElementById("pd-data-fab")) return;

    // --- FAB ---
    var fab = document.createElement("button");
    fab.id = "pd-data-fab";
    fab.type = "button";
    fab.setAttribute("aria-label", "Exportar e importar dados");
    fab.innerHTML =
      '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>' +
      '<polyline points="17 8 12 3 7 8"/>' +
      '<line x1="12" x2="12" y1="3" y2="15"/></svg><span>Dados</span>';
    fab.style.cssText =
      "position:fixed;left:14px;bottom:18px;z-index:9998;" +
      "display:inline-flex;align-items:center;gap:8px;" +
      "border:1px solid " + C.border + ";border-radius:999px;padding:10px 14px;" +
      "background:" + C.card + ";color:" + C.fg + ";font:600 13px system-ui;" +
      "box-shadow:0 6px 20px rgba(0,0,0,.14);cursor:pointer;" +
      "transition:transform .15s ease,box-shadow .15s ease;";
    fab.addEventListener("mouseenter", function () {
      fab.style.transform = "translateY(-2px)";
      fab.style.boxShadow = "0 10px 26px rgba(0,0,0,.2)";
    });
    fab.addEventListener("mouseleave", function () {
      fab.style.transform = "translateY(0)";
      fab.style.boxShadow = "0 6px 20px rgba(0,0,0,.14)";
    });

    // --- Overlay ---
    var overlay = document.createElement("div");
    overlay.id = "pd-data-overlay";
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.5);" +
      "display:none;align-items:center;justify-content:center;padding:16px;" +
      "-webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px);";

    // --- Painel ---
    var panel = document.createElement("div");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-labelledby", "pd-data-title");
    panel.style.cssText =
      "background:" + C.card + ";color:" + C.fg + ";" +
      "border:1px solid " + C.border + ";border-radius:16px;" +
      "width:100%;max-width:480px;max-height:90vh;overflow-y:auto;padding:20px;" +
      "font:14px system-ui;box-shadow:0 25px 60px rgba(0,0,0,.4);";

    panel.innerHTML =
      '<div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:14px">' +
        '<div style="flex:1">' +
          '<h3 id="pd-data-title" style="margin:0;font-size:17px;font-weight:700">Seus dados</h3>' +
          '<p style="margin:6px 0 0;color:' + C.mutedFg + ';font-size:12.5px;line-height:1.5">' +
            'Faça backup, exporte para planilha, importe um backup existente ou gere um relatório em PDF. ' +
            'Os dados ficam armazenados apenas neste aparelho.' +
          '</p>' +
        '</div>' +
        '<button id="pd-data-close" type="button" aria-label="Fechar" ' +
          'style="border:0;background:transparent;color:inherit;font-size:22px;line-height:1;' +
          'cursor:pointer;padding:2px 6px;border-radius:6px">×</button>' +
      '</div>' +
      '<div id="pd-data-summary" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));' +
        'gap:8px;padding:10px;border-radius:10px;background:' + C.muted + ';' +
        'font-size:12px;margin-bottom:16px;"></div>' +
      '<div style="display:grid;gap:8px">' +
        '<button id="pd-export-json" type="button" class="pd-act">' +
          '<strong>Exportar backup (JSON)</strong>' +
          '<span>Guarda todos os seus dados em um arquivo. Ideal para reinstalar em outro aparelho.</span>' +
        '</button>' +
        '<button id="pd-export-csv" type="button" class="pd-act">' +
          '<strong>Exportar planilha (CSV)</strong>' +
          '<span>Para abrir no Excel, Google Sheets ou Numbers.</span>' +
        '</button>' +
        '<button id="pd-import" type="button" class="pd-act pd-act-warn">' +
          '<strong>Importar backup (JSON)</strong>' +
          '<span>Restaura um backup. Substitui os dados atuais deste aparelho.</span>' +
        '</button>' +
        '<button id="pd-pdf" type="button" class="pd-act">' +
          '<strong>Relatório em PDF</strong>' +
          '<span>Resumo imprimível do perfil, hidratação, alimentação, treinos e evolução.</span>' +
        '</button>' +
      '</div>' +
      '<input id="pd-import-file" type="file" accept=".json,application/json" hidden />' +
      '<p style="margin:16px 0 0;font-size:11.5px;line-height:1.55;color:' + C.mutedFg + '">' +
        'Nada é enviado para servidores. O backup funciona offline e pode ser guardado no Google Drive, e-mail ou outro aparelho.' +
      '</p>';

    // CSS local do painel
    var styleEl = document.createElement("style");
    styleEl.textContent =
      ".pd-act{display:block;width:100%;text-align:left;padding:12px 14px;border-radius:12px;" +
        "border:1px solid " + C.border + ";background:" + C.card + ";color:" + C.fg + ";font:inherit;" +
        "cursor:pointer;transition:transform .12s ease,border-color .12s ease;}" +
      ".pd-act:hover{transform:translateY(-1px);border-color:" + C.primary + ";}" +
      ".pd-act:active{transform:scale(.98);}" +
      ".pd-act strong{display:block;font-size:13.5px;font-weight:700;margin-bottom:2px;}" +
      ".pd-act span{display:block;font-size:12px;color:" + C.mutedFg + ";line-height:1.5;}" +
      ".pd-act-warn{border-color:" + C.destructive + "66;}" +
      ".pd-act-warn:hover{border-color:" + C.destructive + ";}" +
      ".pd-act-warn strong{color:" + C.destructive + ";}";
    panel.appendChild(styleEl);

    overlay.appendChild(panel);
    document.body.appendChild(fab);
    document.body.appendChild(overlay);

    // --- Abrir / fechar ---
    var isOpen = false;

    function refreshSummary() {
      var el = panel.querySelector("#pd-data-summary");
      el.innerHTML = "<div style='grid-column:1/-1;color:" + C.mutedFg + "'>Lendo dados…</div>";
      summarize().then(function (r) {
        var s = r.summary;
        el.innerHTML =
          "<div><b>" + s.entries + "</b> refeições</div>" +
          "<div><b>" + s.workouts + "</b> treinos</div>" +
          "<div><b>" + s.body + "</b> avaliações</div>" +
          "<div><b>" + s.daily + "</b> dias de hidratação</div>";
      }).catch(function () {
        el.innerHTML = "<div style='grid-column:1/-1;color:" + C.mutedFg + "'>Não foi possível ler os dados.</div>";
      });
    }

    function open() {
      overlay.style.display = "flex";
      isOpen = true;
      document.body.classList.add("pd-modal-open");
      refreshSummary();
    }

    function close() {
      overlay.style.display = "none";
      isOpen = false;
      document.body.classList.remove("pd-modal-open");
    }

    fab.addEventListener("click", open);
    panel.querySelector("#pd-data-close").addEventListener("click", close);
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) close();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && isOpen) close();
    });

    // --- Ações ---
    panel.querySelector("#pd-export-json").addEventListener("click", function () {
      exportJSON().catch(function (err) {
        console.error(err);
        toast("Falha ao exportar backup.", "error");
      });
    });

    panel.querySelector("#pd-export-csv").addEventListener("click", function () {
      exportCSV().catch(function (err) {
        console.error(err);
        toast("Falha ao exportar CSV.", "error");
      });
    });

    panel.querySelector("#pd-pdf").addEventListener("click", function () {
      try {
        exportPDF();
      } catch (err) {
        console.error(err);
        toast("Falha ao gerar PDF.", "error");
      }
    });

    var fileInput = panel.querySelector("#pd-import-file");
    panel.querySelector("#pd-import").addEventListener("click", function () {
      fileInput.click();
    });
    fileInput.addEventListener("change", function () {
      var file = fileInput.files && fileInput.files[0];
      fileInput.value = "";
      close();
      handleImport(file);
    });
  }

  // ------------------------------ Bootstrap --------------------------------
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ensureUI);
  } else {
    ensureUI();
  }
})();
