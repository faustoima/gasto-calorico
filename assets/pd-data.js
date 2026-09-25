/* =========================================================================
   Prato do Dia — Dados, backup, importação e relatório
   -------------------------------------------------------------------------
   Integração com o IndexedDB REAL usado pelo aplicativo:
     DB:    prato-do-dia-offline-v2
     STORE: data

   Este módulo não altera alimentos, exercícios nem fórmulas de cálculo.
   JSON = backup completo/restauração
   CSV  = exportação para análise
   PDF  = relatório para impressão/Salvar como PDF
   ========================================================================= */
(function () {
  "use strict";

  var DB_NAME = "prato-do-dia-offline-v2";
  var DB_VERSION = 1;
  var STORE = "data";
  var BACKUP_VERSION = 2;

  var KEYS = [
    "profile",
    "body",
    "entries",
    "exercises",
    "workouts",
    "daily",
    "settings",
    "users",
    "customFoods",
    "customExercises"
  ];

  var DEFAULT_PROFILE = {
    name: "", configured: 0, birth: "", sex: "M", heightCm: null,
    weightKg: null, goal: "perder", adjustPct: 20, activityFactor: 1.2,
    formula: "mifflin", protPerKg: 1.6, fatPerKg: 1, macroBasis: "target",
    exerciseMode: "A", fiberGoal: 30, sodiumGoal: 2000, waterGoal: null,
    conditions: [], waterMl: null, waterManual: false, fiberG: 30,
    sodiumMg: 2000, consentAt: null
  };

  var LABELS = {
    profile: "Perfil",
    body: "Avaliações corporais",
    entries: "Refeições lançadas",
    exercises: "Exercícios salvos",
    workouts: "Treinos registrados",
    daily: "Dias de hidratação",
    settings: "Configurações",
    users: "Usuários",
    customFoods: "Meus alimentos",
    customExercises: "Meus exercícios"
  };

  var C = {
    card: "hsl(var(--card, 44 30% 99%))",
    fg: "hsl(var(--foreground, 80 12% 12%))",
    muted: "hsl(var(--muted, 42 14% 92%))",
    mutedFg: "hsl(var(--muted-foreground, 80 6% 38%))",
    border: "hsl(var(--border, 42 12% 86%))",
    primary: "hsl(var(--primary, 152 38% 27%))",
    destructive: "hsl(var(--destructive, 14 57% 42%))"
  };

  function defaultFor(key) {
    if (key === "profile") return Object.assign({}, DEFAULT_PROFILE);
    if (key === "settings") return {};
    return [];
  }

  function openDB() {
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) {
        reject(new Error("IndexedDB não está disponível neste navegador."));
        return;
      }
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function () {
        if (!req.result.objectStoreNames.contains(STORE)) {
          req.result.createObjectStore(STORE);
        }
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error("Falha ao abrir o banco.")); };
    });
  }

  function readAll() {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, "readonly");
        var store = tx.objectStore(STORE);
        var result = {};

        KEYS.forEach(function (key) {
          var req = store.get(key);
          req.onsuccess = function () {
            result[key] = req.result === undefined ? defaultFor(key) : req.result;
            if (key === "profile" && result[key] && typeof result[key] === "object") {
              result[key] = Object.assign({}, DEFAULT_PROFILE, result[key]);
            }
          };
          req.onerror = function () {
            reject(req.error || new Error("Falha ao ler " + key));
          };
        });

        tx.oncomplete = function () {
          db.close();
          resolve(result);
        };
        tx.onerror = function () {
          db.close();
          reject(tx.error || new Error("Falha ao ler os dados."));
        };
        tx.onabort = function () {
          db.close();
          reject(tx.error || new Error("Leitura cancelada."));
        };
      });
    });
  }

  function restoreAll(data) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, "readwrite");
        var store = tx.objectStore(STORE);

        // O backup é uma restauração completa. As chaves ausentes recebem
        // os valores padrão do aplicativo, evitando deixar dados antigos.
        KEYS.forEach(function (key) {
          var value = data[key] !== undefined ? data[key] : defaultFor(key);
          if (key === "profile" && value && typeof value === "object") {
            value = Object.assign({}, DEFAULT_PROFILE, value);
          }
          store.put(value, key);
        });

        tx.oncomplete = function () {
          db.close();
          resolve();
        };
        tx.onerror = function () {
          db.close();
          reject(tx.error || new Error("Falha ao restaurar os dados."));
        };
        tx.onabort = function () {
          db.close();
          reject(tx.error || new Error("Restauração cancelada."));
        };
      });
    });
  }

  function pad2(n) { return n < 10 ? "0" + n : String(n); }

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
    var old = document.getElementById("pd-data-toast");
    if (old && old.parentNode) old.parentNode.removeChild(old);

    var el = document.createElement("div");
    el.id = "pd-data-toast";
    el.textContent = message;
    var bg = kind === "error" ? "#a52a2a"
      : kind === "success" ? "#2f7a4d" : "#1f2937";

    el.style.cssText =
      "position:fixed;left:50%;bottom:78px;transform:translateX(-50%) translateY(6px);" +
      "z-index:100001;padding:12px 18px;border-radius:10px;font:500 14px system-ui;" +
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
      setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 220);
    }, 2800);
  }

  function counts(data) {
    var result = {};
    KEYS.forEach(function (key) {
      var value = data[key];
      result[key] = Array.isArray(value) ? value.length : (value ? 1 : 0);
    });
    return result;
  }

  function exportJSON() {
    return readAll().then(function (data) {
      var payload = {
        app: "Prato do Dia",
        appVersion: "1.0",
        backupVersion: BACKUP_VERSION,
        exportedAt: new Date().toISOString(),
        counts: counts(data),
        data: data
      };

      var blob = new Blob(
        [JSON.stringify(payload, null, 2)],
        { type: "application/json;charset=utf-8" }
      );

      downloadBlob(
        blob,
        "prato-do-dia-backup-" + fmtDate(new Date()) + ".json"
      );

      toast("Backup completo exportado · " + fmtBytes(blob.size), "success");
      return payload;
    });
  }

  function csvCell(value) {
    var s = value === null || value === undefined ? "" : String(value);
    return /[",\r\n;]/.test(s)
      ? '"' + s.replace(/"/g, '""') + '"'
      : s;
  }

  function exportCSV() {
    return readAll().then(function (data) {
      var rows = [[
        "tipo", "data", "hora", "refeicao", "descricao", "quantidade",
        "medida", "gramas", "kcal", "proteina_g", "carboidrato_g",
        "gordura_g", "fibra_g", "sodio_mg", "minutos", "series", "repeticoes",
        "kcal_bruta", "kcal_liquida", "peso_kg", "gordura_pct",
        "cintura_cm", "quadril_cm", "agua_ml", "observacoes"
      ]];

      (data.entries || []).forEach(function (e) {
        rows.push([
          "refeicao", e.date, e.time, e.meal, e.food, e.qty, e.measure,
          e.grams, e.kcal, e.prot, e.carb, e.fat, e.fiber, e.sodium,
          "", "", "", "", "", "", "", "", "", "", e.source
        ]);
      });

      (data.workouts || []).forEach(function (w) {
        rows.push([
          "exercicio", w.date, w.time, "", w.name, "", "min", "",
          "", "", "", "", "", "", w.minutes, w.sets, w.reps,
          w.kcalGross, w.kcalNet, "", "", "", "", "", w.notes
        ]);
      });

      (data.body || []).forEach(function (b) {
        rows.push([
          "corpo", b.date, "", "", "avaliação corporal", "", "kg",
          "", "", "", "", "", "", "", "", "", "", "", "",
          b.weight, b.bodyFat, b.waist, b.hip, "", b.notes
        ]);
      });

      (data.daily || []).forEach(function (d) {
        rows.push([
          "hidratacao", d.date, "", "", "água", "", "ml", "",
          "", "", "", "", d.fiberG, d.sodiumMg, "", "", "", "",
          "", "", "", "", d.waterMl, ""
        ]);
      });

      var csv = "\uFEFF" + rows.map(function (row) {
        return row.map(csvCell).join(",");
      }).join("\r\n");

      var blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      downloadBlob(blob, "prato-do-dia-" + fmtDate(new Date()) + ".csv");
      toast("CSV exportado · " + fmtBytes(blob.size), "success");
    });
  }

  function parseBackup(file) {
    return file.text().then(function (text) {
      var parsed;
      try {
        parsed = JSON.parse(text);
      } catch (_) {
        throw new Error("Arquivo inválido: não é um JSON válido.");
      }

      var data = parsed && parsed.data ? parsed.data : parsed;
      if (parsed && parsed.app && parsed.app !== "Prato do Dia") {
        throw new Error("Não foi possível restaurar este backup porque a estrutura do arquivo não é compatível.");
      }
      if (parsed && parsed.backupVersion != null && Number(parsed.backupVersion) < 2) {
        throw new Error("Não foi possível restaurar este backup porque a estrutura do arquivo não é compatível.");
      }
      if (!data || typeof data !== "object" || Array.isArray(data)) {
        throw new Error("Arquivo sem dados reconhecíveis.");
      }

      var found = KEYS.filter(function (key) {
        return data[key] !== undefined;
      });

      if (!found.length) {
        throw new Error("Nenhum dado do Prato do Dia foi encontrado neste arquivo.");
      }

      return { parsed: parsed, data: data, found: found };
    });
  }

  function importBackup(file) {
    if (!file) return;

    if (!/\.json$/i.test(file.name)) {
      toast("Selecione um arquivo JSON de backup.", "error");
      return;
    }

    parseBackup(file).then(function (result) {
      var data = result.data;
      var found = result.found;
      var currentCountsPromise = readAll();

      return currentCountsPromise.then(function (current) {
        var lines = found.map(function (key) {
          var value = data[key];
          var n = Array.isArray(value) ? value.length : (value ? 1 : 0);
          return "• " + (LABELS[key] || key) + ": " + n;
        }).join("\n");

        var exportedAt = result.parsed && result.parsed.exportedAt
          ? new Date(result.parsed.exportedAt).toLocaleString("pt-BR")
          : "não informada";

        var currentTotal =
          current.entries.length +
          current.workouts.length +
          current.body.length +
          current.daily.length;

        var msg =
          "RESTAURAR BACKUP\n\n" +
          "Arquivo: " + file.name + "\n" +
          "Tamanho: " + fmtBytes(file.size) + "\n" +
          "Exportado em: " + exportedAt + "\n\n" +
          "Conteúdo do backup:\n" + lines + "\n\n" +
          "Hoje existem " + currentTotal + " registros de uso neste aparelho.\n\n" +
          "ATENÇÃO: a restauração substituirá os dados atuais do aplicativo.\n" +
          "Se esses dados forem importantes, faça um backup antes de continuar.\n\n" +
          "Continuar?";

        if (!confirm(msg)) return false;

        // Backup de segurança automático antes da restauração.
        var safetyPayload = {
          app: "Prato do Dia",
          appVersion: "1.0",
          backupVersion: BACKUP_VERSION,
          exportedAt: new Date().toISOString(),
          reason: "backup-automatico-antes-da-restauracao",
          data: current,
          counts: counts(current)
        };

        var safetyBlob = new Blob(
          [JSON.stringify(safetyPayload, null, 2)],
          { type: "application/json;charset=utf-8" }
        );

        downloadBlob(
          safetyBlob,
          "prato-do-dia-backup-antes-da-restauracao-" +
          fmtDate(new Date()) + ".json"
        );

        return restoreAll(data).then(function () { return true; });
      });
    }).then(function (done) {
      if (done === true) {
        toast("Dados restaurados. Atualizando o aplicativo…", "success");
        setTimeout(function () { location.reload(); }, 900);
      }
    }).catch(function (error) {
      console.error(error);
      toast(error && error.message
        ? error.message
        : "Falha ao importar o backup.", "error");
    });
  }

  function esc(value) {
    return String(value === null || value === undefined ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function exportPDF() {
    var win = window.open("", "_blank");
    if (!win) {
      toast("Permita a abertura de novas janelas para gerar o relatório.", "error");
      return;
    }

    win.document.write(
      "<p style='font:16px system-ui;padding:20px'>Gerando relatório…</p>"
    );

    readAll().then(function (data) {
      var p = data.profile || {};
      var today = fmtDate(new Date());
      var day = (data.daily || []).find(function (x) {
        return x && x.date === today;
      }) || {};

      var entries = (data.entries || []).filter(function (x) {
        return x && x.date === today;
      });

      var workouts = (data.workouts || []).filter(function (x) {
        return x && x.date === today;
      });

      var body = (data.body || [])
        .filter(function (x) { return x && x.date; })
        .sort(function (a, b) {
          return String(a.date).localeCompare(String(b.date));
        });

      var last = body[body.length - 1] || {};
      var first = body[0] || {};

      var todayKcal = entries.reduce(function (sum, x) {
        return sum + (Number(x.kcal) || 0);
      }, 0);

      var todayWorkoutKcal = workouts.reduce(function (sum, x) {
        return sum + (Number(x.kcalGross) || 0);
      }, 0);

      function delta(a, b) {
        if (a == null || b == null || !Number.isFinite(Number(a)) ||
            !Number.isFinite(Number(b))) return "";
        var d = Number(a) - Number(b);
        return " (" + (d >= 0 ? "+" : "") + d.toFixed(1) + ")";
      }

      var html =
        "<!doctype html><html lang='pt-BR'><head><meta charset='utf-8'>" +
        "<title>Relatório Prato do Dia</title><style>" +
        "body{font:14px/1.55 Arial,system-ui;color:#17352e;max-width:760px;" +
        "margin:32px auto;padding:0 20px}" +
        "h1{color:#0e2c4b;border-bottom:2px solid #2d8061;padding-bottom:10px}" +
        "h2{color:#0e2c4b;margin-top:26px}" +
        ".grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}" +
        ".card{border:1px solid #ccd8d1;border-radius:10px;padding:12px;" +
        "background:#fafcfb}" +
        "small{color:#667}" +
        "@media print{body{margin:0;max-width:none}.no-print{display:none}}" +
        "</style></head><body>" +

        "<h1>Prato do Dia — Relatório</h1>" +
        "<small>Gerado em " + esc(new Date().toLocaleString("pt-BR")) + "</small>" +

        "<h2>Resumo de hoje</h2>" +
        "<div class='grid'>" +
        "<div class='card'><b>Perfil</b><br>" +
        esc(p.name || "—") +
        "<br>Peso no perfil: " + esc(p.weightKg == null ? "—" : p.weightKg) +
        " kg<br>Meta: " + esc(p.kcalGoal == null ? "calculada" : p.kcalGoal) +
        " kcal/dia</div>" +

        "<div class='card'><b>Hidratação</b><br>" +
        esc(day.waterMl || 0) + " ml registrados" +
        "<br>Meta: " + esc(p.waterMl == null ? "—" : p.waterMl) +
        " ml/dia</div>" +

        "<div class='card'><b>Alimentação hoje</b><br>" +
        entries.length + " registros<br>" +
        esc(Math.round(todayKcal)) + " kcal</div>" +

        "<div class='card'><b>Exercícios hoje</b><br>" +
        workouts.length + " registros<br>" +
        esc(Math.round(todayWorkoutKcal)) + " kcal brutas</div>" +
        "</div>" +

        "<h2>Evolução corporal</h2>" +
        "<p>Registros: " + body.length +
        ". Última avaliação: " + esc(last.date ? new Date(last.date + "T12:00:00").toLocaleDateString("pt-BR", {day:"2-digit", month:"2-digit", year:"2-digit"}) : "—") + "</p>" +

        "<div class='card'>" +
        "Peso: " + esc(last.weight == null ? "—" : last.weight) +
        " kg" + delta(last.weight, first.weight) + "<br>" +
        "IMC: " + esc(last.bmi == null ? "—" : last.bmi) + "<br>" +
        "Gordura corporal: " + esc(last.bodyFat == null ? "—" : last.bodyFat) +
        "%" + delta(last.bodyFat, first.bodyFat) + "<br>" +
        "Músculos: " + esc(last.muscle == null ? "—" : last.muscle) +
        "%<br>" +
        "Gordura visceral: " + esc(last.visceralFat == null ? (last.visceral == null ? "—" : last.visceral) : last.visceralFat) +
        "<br>Cintura: " + esc(last.waist == null ? "—" : last.waist) +
        " cm<br>Quadril: " + esc(last.hip == null ? "—" : last.hip) +
        " cm<br>RMR: " + esc(last.rmrBio == null ? "—" : last.rmrBio) + " kcal" +
        "</div>" +
        "<div class='card' style='overflow:auto'><table style='width:100%;border-collapse:collapse;font-size:12px'><thead><tr><th>Data</th><th>Peso kg</th><th>IMC</th><th>Gordura %</th><th>Músculos %</th><th>Gordura visceral</th></tr></thead><tbody>" +
        body.map(function (b) {
          var visceral = b.visceralFat == null ? b.visceral : b.visceralFat;
          var dateBR = b.date ? new Date(b.date + "T12:00:00").toLocaleDateString("pt-BR", {day:"2-digit", month:"2-digit", year:"2-digit"}) : "—";
          return "<tr><td>" + esc(dateBR) + "</td><td>" + esc(b.weight == null ? "—" : b.weight) + "</td><td>" + esc(b.bmi == null ? "—" : b.bmi) + "</td><td>" + esc(b.bodyFat == null ? "—" : b.bodyFat) + "</td><td>" + esc(b.muscle == null ? "—" : b.muscle) + "</td><td>" + esc(visceral == null ? "—" : visceral) + "</td></tr>";
        }).join("") +
        "</tbody></table></div>" +

        "<h2>Registros acumulados</h2>" +
        "<div class='card'>" +
        "Refeições: " + (data.entries || []).length + "<br>" +
        "Treinos: " + (data.workouts || []).length + "<br>" +
        "Avaliações corporais: " + (data.body || []).length + "<br>" +
        "Dias de hidratação: " + (data.daily || []).length +
        "</div>" +

        "<p style='margin-top:28px;color:#667;font-size:12px'>" +
        "Este relatório reproduz os dados registrados no aplicativo. " +
        "Os cálculos exibidos pelo aplicativo não foram alterados por este módulo." +
        "</p>" +

        "</body></html>";

      win.document.open();
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(function () { win.print(); }, 400);
    }).catch(function (error) {
      console.error(error);
      win.document.body.innerHTML =
        "<p style='font:16px system-ui;padding:20px'>" +
        "Não foi possível gerar o relatório.</p>";
    });
  }

  function localDB() {
    return new Promise(function (resolve, reject) {
      var r = indexedDB.open("prato-do-dia-offline-v2", 1);
      r.onupgradeneeded = function () { if (!r.result.objectStoreNames.contains("data")) r.result.createObjectStore("data"); };
      r.onsuccess = function () { resolve(r.result); };
      r.onerror = function () { reject(r.error); };
    });
  }
  function customRead(key) {
    return localDB().then(function (db) { return new Promise(function (resolve) { var r=db.transaction("data").objectStore("data").get(key); r.onsuccess=function(){resolve(r.result||[])}; r.onerror=function(){resolve([])}; }); });
  }
  function customWrite(key, value) {
    return localDB().then(function (db) { return new Promise(function (resolve,reject) { var tx=db.transaction("data","readwrite"); tx.objectStore("data").put(value,key); tx.oncomplete=function(){db.close();resolve()}; tx.onerror=function(){reject(tx.error)}; }); });
  }
  function askFields(type, old) {
    var isFood=type === "food", x=old||{};
    var name=prompt("Nome", x.n||x.name||""); if (!name || !name.trim()) return null;
    if (isFood) {
      var previous=[x.f||x.source||"Informada pelo usuário",x.k,x.p,x.c,x.g,x.fb,x.sd,x.m&&x.m[0]?x.m[0][0]:"porção",x.m&&x.m[0]?x.m[0][1]:100,x.notes||""].join(";");
      var line=prompt("Fonte; kcal; proteínas g; carboidratos g; gorduras g; fibras g; sódio mg; medida; gramas; observação",previous); if(line==null)return null;
      var parts=String(line).split(";"); while(parts.length<10)parts.push("");
      var source=parts[0]||"Informada pelo usuário", k=Number(String(parts[1]).replace(",",".")), p=Number(String(parts[2]).replace(",",".")), c=Number(String(parts[3]).replace(",",".")), g=Number(String(parts[4]).replace(",",".")), fb=Number(String(parts[5]).replace(",",".")), sd=Number(String(parts[6]).replace(",",".")), measure=parts[7]||"porção", grams=Number(String(parts[8]).replace(",",".")), notes=parts[9]||"";
      if ([k,p,c,g,fb,sd,grams].some(function(v){return v==null||!Number.isFinite(v)})) { toast("Cadastro cancelado: valores numéricos são obrigatórios.","error"); return null; }
      return {n:name.trim(),f:source,k:k,p:p,c:c,g:g,fb:fb,sd:sd,m:[[measure,grams]],notes:notes,origin:"usuario",createdAt:x.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString(),id:x.id||("ufood-"+Date.now())};
    }
    var cat=prompt("Categoria",x.cat||"Exercício personalizado")||"Exercício personalizado";
    var met=Number(String(prompt("MET",x.met==null?3:x.met)).replace(",",".")); if(!Number.isFinite(met)||met<=0){toast("MET inválido.","error");return null;}
    return {c:x.c||("UE"+Date.now()),n:name.trim(),en:"",cat:cat,grupo:prompt("Grupo muscular (opcional)",x.grupo||"")||"",eq:prompt("Equipamento (opcional)",x.eq||"")||"",met:met,ref:prompt("Referência/fonte",x.ref||"Informada pelo usuário")||"Informada pelo usuário",notes:prompt("Observação (opcional)",x.notes||"")||"",origin:"usuario",createdAt:x.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString(),id:x.id||("uex-"+Date.now())};
  }
  function customManager(panel) {
    var list=panel.querySelector("#pd-custom-list");
    function render(){
      Promise.all([customRead("customFoods"),customRead("customExercises")]).then(function(a){
        var rows=a[0].map(function(x){return {type:"food",x:x}}).concat(a[1].map(function(x){return {type:"exercise",x:x}}));
        list.innerHTML=rows.length?rows.map(function(row){var x=row.x;return '<div style="display:flex;gap:6px;align-items:center;border:1px solid '+C.border+';border-radius:9px;padding:8px;font-size:12px"><span style="flex:1"><b>'+esc(row.type==="food"?x.n:x.n)+'</b><br><small>origem: usuario · '+(row.type==="food"?"alimento":"exercício")+'</small></span><button type="button" data-edit-custom="'+row.type+'" data-id="'+esc(x.id)+'">Editar</button><button type="button" data-del-custom="'+row.type+'" data-id="'+esc(x.id)+'">Excluir</button></div>'}).join(""): '<small style="color:'+C.mutedFg+'">Nenhum cadastro personalizado.</small>';
      });
    }
    panel.querySelector("#pd-new-food").addEventListener("click",function(){var x=askFields("food");if(x)customRead("customFoods").then(function(a){a.push(x);return customWrite("customFoods",a)}).then(function(){toast("Alimento personalizado salvo.","success");location.reload()})});
    panel.querySelector("#pd-new-exercise").addEventListener("click",function(){var x=askFields("exercise");if(x)customRead("customExercises").then(function(a){a.push(x);return customWrite("customExercises",a)}).then(function(){toast("Exercício personalizado salvo.","success");location.reload()})});
    list.addEventListener("click",function(e){var edit=e.target.closest("[data-edit-custom]"), del=e.target.closest("[data-del-custom]");if(!edit&&!del)return;var type=edit?(edit.dataset.editCustom||""):(del.dataset.delCustom||""),key=type==="food"?"customFoods":"customExercises",id=(edit||del).dataset.id;customRead(key).then(function(a){var i=a.findIndex(function(x){return String(x.id)===String(id)});if(i<0)return;if(edit){var n=askFields(type,a[i]);if(n){a[i]=n;return customWrite(key,a).then(function(){location.reload()})}}if(del&&confirm("Excluir este cadastro? Os históricos já lançados serão preservados.")){a.splice(i,1);return customWrite(key,a).then(function(){toast("Cadastro excluído; históricos preservados.","success");location.reload()})}})});
    render();
  }
  function ensureUI() {
    if (document.getElementById("pd-data-fab")) return;

    var fab = document.createElement("button");
    fab.id = "pd-data-fab";
    fab.type = "button";
    fab.setAttribute("aria-label", "Abrir ferramentas de dados");
    fab.innerHTML =
      '<span aria-hidden="true" style="font-size:16px">↕</span><span>Dados</span>';

    fab.style.cssText =
      "position:fixed;left:14px;bottom:18px;z-index:9998;" +
      "display:inline-flex;align-items:center;gap:7px;" +
      "border:1px solid " + C.border + ";border-radius:999px;" +
      "padding:10px 14px;background:" + C.card + ";color:" + C.fg + ";" +
      "font:600 13px system-ui;box-shadow:0 6px 20px rgba(0,0,0,.14);" +
      "cursor:pointer;touch-action:manipulation;";

    var overlay = document.createElement("div");
    overlay.id = "pd-data-overlay";
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.50);" +
      "display:none;align-items:center;justify-content:center;padding:16px;" +
      "-webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px);";

    var panel = document.createElement("div");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-labelledby", "pd-data-title");
    panel.style.cssText =
      "background:" + C.card + ";color:" + C.fg + ";" +
      "border:1px solid " + C.border + ";border-radius:16px;width:100%;" +
      "max-width:480px;max-height:90vh;overflow-y:auto;padding:20px;" +
      "font:14px system-ui;box-shadow:0 25px 60px rgba(0,0,0,.4);";

    panel.innerHTML =
      '<div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:14px">' +
        '<div style="flex:1">' +
          '<h3 id="pd-data-title" style="margin:0;font-size:18px;font-weight:700">Seus dados</h3>' +
          '<p style="margin:6px 0 0;color:' + C.mutedFg + ';font-size:12.5px;line-height:1.5">' +
          'Backup completo, exportação para planilha, restauração e relatório. ' +
          'Tudo é processado localmente no aparelho.' +
          '</p>' +
        '</div>' +
        '<button id="pd-data-close" type="button" aria-label="Fechar" ' +
        'style="border:0;background:transparent;color:inherit;font-size:24px;line-height:1;cursor:pointer;padding:2px 6px">×</button>' +
      '</div>' +

      '<div id="pd-data-summary" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;padding:10px;border-radius:10px;background:' +
      C.muted + ';font-size:12px;margin-bottom:16px"></div>' +

      '<div style="display:grid;gap:8px">' +
        '<button id="pd-export-json" type="button" class="pd-act">' +
          '<strong>↥ Fazer backup completo</strong>' +
          '<span>JSON com todos os dados do aplicativo. Use para guardar ou restaurar em outro aparelho.</span>' +
        '</button>' +

        '<button id="pd-export-csv" type="button" class="pd-act">' +
          '<strong>▦ Exportar para Excel / planilha</strong>' +
          '<span>CSV para análise no Excel, Google Sheets ou Numbers.</span>' +
        '</button>' +

        '<button id="pd-import" type="button" class="pd-act pd-act-warn">' +
          '<strong>↧ Restaurar backup</strong>' +
          '<span>Importa um JSON e substitui os dados atuais. Um backup de segurança será feito antes.</span>' +
        '</button>' +

        '<button id="pd-pdf" type="button" class="pd-act">' +
          '<strong>▤ Relatório para impressão / PDF</strong>' +
          '<span>Abre um relatório pronto para imprimir ou salvar como PDF.</span>' +
        '</button>' +
      '</div>' +
      '<hr style="border:0;border-top:1px solid ' + C.border + ';margin:18px 0">' +
      '<h4 style="margin:0 0 8px">Cadastros pessoais</h4>' +
      '<p style="margin:0 0 10px;color:' + C.mutedFg + ';font-size:12px">Bases oficiais não podem ser editadas. Seus cadastros ficam apenas neste aparelho e entram no backup JSON.</p>' +
      '<button id="pd-new-food" type="button" class="pd-act"><strong>＋ Meu alimento</strong><span>Criar um alimento personalizado.</span></button>' +
      '<button id="pd-new-exercise" type="button" class="pd-act"><strong>＋ Meu exercício</strong><span>Criar um exercício personalizado.</span></button>' +
      '<div id="pd-custom-list" style="display:grid;gap:6px;margin-top:10px"></div>' +

      '<input id="pd-import-file" type="file" accept=".json,application/json" hidden>' +

      '<p style="margin:16px 0 0;font-size:11.5px;line-height:1.55;color:' +
      C.mutedFg + '">' +
      'O backup não é enviado para um servidor. Guarde o arquivo JSON em um local seguro.' +
      '</p>';

    var styleEl = document.createElement("style");
    styleEl.textContent =
      ".pd-act{display:block;width:100%;text-align:left;padding:13px 14px;border-radius:12px;" +
      "border:1px solid " + C.border + ";background:" + C.card + ";color:" + C.fg +
      ";font:inherit;cursor:pointer;touch-action:manipulation}" +
      ".pd-act:active{transform:scale(.985)}" +
      ".pd-act strong{display:block;font-size:13.5px;font-weight:700;margin-bottom:3px}" +
      ".pd-act span{display:block;font-size:12px;color:" + C.mutedFg + ";line-height:1.5}" +
      ".pd-act-warn{border-color:" + C.destructive + "66}" +
      ".pd-act-warn strong{color:" + C.destructive + "}";
    panel.appendChild(styleEl);

    overlay.appendChild(panel);
    document.body.appendChild(fab);
    document.body.appendChild(overlay);

    var isOpen = false;
    customManager(panel);

    function refreshSummary() {
      var el = panel.querySelector("#pd-data-summary");
      el.innerHTML =
        "<div style='grid-column:1/-1;color:" + C.mutedFg + "'>Lendo dados…</div>";

      readAll().then(function (data) {
        var s = counts(data);
        el.innerHTML =
          "<div><b>" + s.entries + "</b> refeições</div>" +
          "<div><b>" + s.workouts + "</b> treinos</div>" +
          "<div><b>" + s.body + "</b> avaliações</div>" +
          "<div><b>" + s.daily + "</b> dias de hidratação</div>";
      }).catch(function () {
        el.innerHTML =
          "<div style='grid-column:1/-1;color:" + C.mutedFg +
          "'>Não foi possível ler os dados.</div>";
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

    overlay.addEventListener("click", function (event) {
      if (event.target === overlay) close();
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && isOpen) close();
    });

    panel.querySelector("#pd-export-json").addEventListener("click", function () {
      exportJSON().catch(function (error) {
        console.error(error);
        toast("Falha ao exportar o backup.", "error");
      });
    });

    panel.querySelector("#pd-export-csv").addEventListener("click", function () {
      exportCSV().catch(function (error) {
        console.error(error);
        toast("Falha ao exportar o CSV.", "error");
      });
    });

    panel.querySelector("#pd-pdf").addEventListener("click", function () {
      try {
        exportPDF();
      } catch (error) {
        console.error(error);
        toast("Falha ao gerar o relatório.", "error");
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
      importBackup(file);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ensureUI);
  } else {
    ensureUI();
  }
})();
