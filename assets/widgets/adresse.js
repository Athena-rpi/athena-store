/* Athéna — bouton « Copier » sur les adresses de paiement.
   Aucune donnée ne sort de la page ; la copie reste locale. */
(function () {
  "use strict";

  function copier(texte) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(texte);
    }
    var zone = document.createElement("textarea");
    zone.value = texte;
    zone.style.position = "fixed";
    zone.style.opacity = "0";
    document.body.appendChild(zone);
    zone.select();
    try { document.execCommand("copy"); } catch (e) { /* silencieux */ }
    document.body.removeChild(zone);
    return Promise.resolve();
  }

  function ajouter(bloc) {
    if (bloc.querySelector(".copier")) return;
    var bouton = document.createElement("button");
    bouton.type = "button";
    bouton.className = "copier";
    bouton.textContent = "Copier";
    bouton.addEventListener("click", function () {
      copier(bloc.textContent.trim()).then(function () {
        bouton.textContent = "Copié";
        bouton.classList.add("fait");
        setTimeout(function () {
          bouton.textContent = "Copier";
          bouton.classList.remove("fait");
        }, 1500);
      });
    });
    bloc.appendChild(bouton);
  }

  document.querySelectorAll(".adresse").forEach(ajouter);
})();
