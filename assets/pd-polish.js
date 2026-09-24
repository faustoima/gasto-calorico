/* =========================================================
   Prato do Dia — refinamentos de UX
   NÃO altera dados, fórmulas, cálculos ou tabelas.
   ========================================================= */
(function () {
  "use strict";

  // 1. Sincroniza a classe 'pd-modal-open' quando o painel Dados abre/fecha
  const obs = new MutationObserver(function () {
    const overlay = document.getElementById("pd-data-overlay");
    if (!overlay) return;
    const open = overlay.style.display === "flex";
    document.body.classList.toggle("pd-modal-open", open);
  });
  obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["style"] });

  // 2. Garante que o título do documento reflita o estado de instalação
  if (window.matchMedia("(display-mode: standalone)").matches) {
    document.documentElement.setAttribute("data-pd-standalone", "1");
  }

  // 3. Previne o "double-tap zoom" em botões (iOS)
  let lastTouch = 0;
  document.addEventListener("touchend", function (e) {
    const now = Date.now();
    if (now - lastTouch < 300 && e.target.closest("button")) {
      e.preventDefault();
    }
    lastTouch = now;
  }, { passive: false });

  // 4. Adiciona aria-label nos botões icônicos que não têm
  function labelIcons() {
    document.querySelectorAll('button[aria-label=""]').forEach(function (b) {
      b.removeAttribute("aria-label");
    });
  }
  setInterval(labelIcons, 2000);
})();
