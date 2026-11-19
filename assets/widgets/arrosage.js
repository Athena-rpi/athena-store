/* Kit serre — décideur d'arrosage.
   Réplique exacte de la règle du guide, section 9.1, et de
   ``examples/arrosage.py`` : pompe ON seulement si les quatre conditions sont
   réunies. Aucune donnée ne sort de la page. */
(function () {
  "use strict";

  var SEUIL = 25;      // % d'humidité du sol
  var DEBUT = 6;       // fenêtre horaire, en heures
  var FIN = 21;
  var DELAI = 600;     // secondes entre deux cycles

  function decision(sol, cuve, depuis, heure) {
    if (sol === null || sol === undefined || isNaN(sol) || !cuve) return false;
    if (heure < DEBUT || heure >= FIN) return false;
    if (sol >= SEUIL) return false;
    if (depuis < DELAI) return false;
    return true;
  }

  function conditions(sol, cuve, depuis, heure) {
    return [
      { ok: sol !== null && sol !== undefined && !isNaN(sol) && sol < SEUIL,
        texte: "sol < " + SEUIL + " %" },
      { ok: !!cuve, texte: "cuve pleine" },
      { ok: heure >= DEBUT && heure < FIN,
        texte: "heure dans [" + DEBUT + "h, " + FIN + "h[" },
      { ok: depuis >= DELAI, texte: "délai >= " + DELAI + " s" }
    ];
  }

  function render(bloc) {
    bloc.innerHTML =
      '<p class="widget-titre">Le décideur d’arrosage — essayez la règle</p>' +
      '<div class="widget-controle">' +
      '  <label>humidité du sol <output id="w-sol">20 %</output></label>' +
      '  <input type="range" min="0" max="100" value="20" data-w="sol">' +
      '  <label>dernière pompe il y a <output id="w-depuis">900 s</output></label>' +
      '  <input type="range" min="0" max="1800" step="30" value="900" data-w="depuis">' +
      '  <label>heure <output id="w-heure">12 h</output></label>' +
      '  <input type="range" min="0" max="23" value="12" data-w="heure">' +
      '  <label class="widget-cuve"><input type="checkbox" data-w="cuve" checked> cuve pleine</label>' +
      '</div>' +
      '<div class="widget-resultat" data-w="resultat"></div>';

    function maj() {
      var sol = parseFloat(bloc.querySelector('[data-w="sol"]').value);
      var depuis = parseFloat(bloc.querySelector('[data-w="depuis"]').value);
      var heure = parseInt(bloc.querySelector('[data-w="heure"]').value, 10);
      var cuve = bloc.querySelector('[data-w="cuve"]').checked;
      bloc.querySelector('#w-sol').textContent = sol + " %";
      bloc.querySelector('#w-depuis').textContent = depuis + " s";
      bloc.querySelector('#w-heure').textContent = heure + " h";

      var res = bloc.querySelector('[data-w="resultat"]');
      var lignes = conditions(sol, cuve, depuis, heure).map(function (c) {
        return (c.ok ? "  oui  " : "  non  ") + c.texte;
      });
      var on = decision(sol, cuve, depuis, heure);
      res.className = "widget-resultat " + (on ? "ok" : "ko");
      res.textContent = lignes.join("\n") + "\ndécision : " + (on ? "POMPE ON" : "POMPE OFF");
    }

    bloc.querySelectorAll("input").forEach(function (e) {
      e.addEventListener("input", maj);
    });
    maj();
  }

  document.querySelectorAll('.widget[data-widget="arrosage"]').forEach(render);
})();
