/* Athéna — recherche dans le journal, entièrement locale.
   L'index est lu une fois ; aucune donnée ne sort de la page. */
(function () {
  "use strict";

  var champ = document.getElementById("recherche");
  if (!champ) return;

  var liste = document.querySelector("[data-liste]");
  var lignes = liste ? Array.prototype.slice.call(listes()) : [];
  var plus = document.querySelector("[data-plus]");
  var vide = document.querySelector("[data-vide]");
  var compteur = document.querySelector("[data-compte]");
  var taille = liste ? parseInt(liste.getAttribute("data-pagination") || "8", 10) : 8;
  var index = null;
  var visible = taille;

  function listes() {
    return liste.querySelectorAll(".article-ligne");
  }

  function maj() {
    var q = champ.value.trim().toLowerCase();
    var montrées = 0;
    lignes.forEach(function (ligne) {
      var cles = ligne.getAttribute("data-cles") || "";
      var ok = !q || cles.indexOf(q) !== -1;
      ligne.hidden = !ok || montrées >= visible;
      if (ok) montrées++;
    });
    if (vide) vide.hidden = montrées !== 0;
    if (plus) plus.hidden = q !== "" || montrées < lignes.length;
    if (compteur) {
      compteur.textContent = q
        ? montrées + " / " + lignes.length
        : lignes.length;
    }
  }

  champ.addEventListener("input", function () {
    visible = taille;
    maj();
  });

  if (plus) {
    plus.addEventListener("click", function () {
      visible += taille;
      maj();
    });
  }

  /* L'index complet sert quand on dépasse les premiers affichés. */
  fetch(champ.getAttribute("data-index"))
    .then(function (r) { return r.ok ? r.json() : []; })
    .catch(function () { return []; })
    .then(function (données) { index = données; })
    .then(maj);
})();
