/* Athéna — interactions minimales du site.
   Rien d'externe, rien de tracké. Le menu mobile est géré en CSS ; ce fichier
   ne sert qu'à de petites commodités. */
(function () {
  "use strict";

  // Ferme le menu mobile après un choix (le menu est un checkbox en CSS).
  var bascule = document.getElementById("nav-bascule");
  if (bascule) {
    document.querySelectorAll(".nav a").forEach(function (lien) {
      lien.addEventListener("click", function () { bascule.checked = false; });
    });
  }
})();
