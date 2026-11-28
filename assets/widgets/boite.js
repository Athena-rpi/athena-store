/* Athéna — client d'envoi de la boîte aux lettres (T134).
   Envoie le texte saisi au récepteur choisi (Worker Cloudflare, POST /message).

   Règles absolues :
   - aucun « envoyé » sur un simple appel réseau : il faut une réponse HTTP
     réussie ET une confirmation explicite du serveur ({ok:true, id:…}) ;
   - en cas d'échec, un message d'erreur LOCAL est affiché et le bouton reste
     actif pour permettre le réessai ;
   - le contenu de la réponse du serveur (id, erreur, n'importe quel champ)
     n'est JAMAIS affiché ni injecté dans la page : les seuls textes affichés
     viennent de la table MSG ci-dessous, écrite ici, et sont posés avec
     textContent — jamais innerHTML ;
   - seul {texte} est envoyé (le récepteur refuse tout champ supplémentaire) ;
   - sans JavaScript, le bouton reste désactivé côté serveur (T133).

   Toute la décision est dans des fonctions pures (confirme/transmettre),
   testées hors ligne par tests/test_boite_widget.mjs. */
(function (global) {
  "use strict";

  var URL_MESSAGE = "https://boite-aux-lettres.athena-boite.workers.dev/message";
  var MAX = 1000;

  /* Textes locaux, figés ici. Aucun ne provient du serveur. */
  var MSG = {
    fr: {
      envoyer: "Envoyer",
      attente: "Envoi en cours…",
      vide: "Écrivez un message avant d'envoyer.",
      long: "Message trop long (" + MAX + " caractères maximum).",
      ok: "Message envoyé. Merci.",
      erreur: "L'envoi a échoué. Vous pouvez réessayer."
    },
    en: {
      envoyer: "Send",
      attente: "Sending…",
      vide: "Write a message before sending.",
      long: "Message too long (" + MAX + " characters maximum).",
      ok: "Message sent. Thank you.",
      erreur: "Sending failed. You can try again."
    }
  };

  function langue(doc) {
    var l = (doc && doc.documentElement && doc.documentElement.lang) || "fr";
    return l.toLowerCase().indexOf("en") === 0 ? "en" : "fr";
  }

  function msg(lang, cle) {
    var table = MSG[lang] || MSG.fr;
    return table[cle] !== undefined ? table[cle] : MSG.fr[cle];
  }

  function nettoyer(texte) {
    return (typeof texte === "string" ? texte : "").normalize("NFC").trim();
  }

  function valider(texte) {
    var t = nettoyer(texte).length;
    return t >= 1 && t <= MAX;
  }

  /* Confirmation explicite du serveur. Un appel réseau réussi, un 200 obtenu
     via un proxy ou un corps arbitraire ne comptent PAS comme une preuve. */
  function confirme(reponse) {
    return !!(reponse && typeof reponse === "object" && !Array.isArray(reponse)
      && reponse.ok === true
      && typeof reponse.id === "string" && reponse.id.length > 0);
  }

  /* Renvoie une promesse de "ok" | "erreur" — jamais le contenu de la
     réponse, qui n'est utilisé que pour décider, puis oublié. */
  function transmettre(fetchFn, texte, lang) {
    return fetchFn(URL_MESSAGE, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ texte: nettoyer(texte) }),
      cache: "no-store"
    }).then(function (r) {
      if (!r || !r.ok) return "erreur";
      return r.json().then(function (j) {
        return confirme(j) ? "ok" : "erreur";
      }).catch(function () { return "erreur"; });
    }).catch(function () { return "erreur"; });
  }

  function brancher(bloc, doc, fetchFn) {
    var textarea = bloc.querySelector("textarea");
    var bouton = bloc.querySelector("button");
    if (!textarea || !bouton) return;
    var lang = langue(doc);

    var statut = doc.createElement("p");
    statut.className = "message-statut";
    statut.setAttribute("role", "status");
    statut.setAttribute("aria-live", "polite");
    bloc.appendChild(statut);

    /* textContent seulement : aucune donnée, aucun contenu de réponse,
       aucun HTML — y compris le texte saisi — n'est injecté. */
    function dire(cle, classe) {
      statut.className = "message-statut" + (classe ? " " + classe : "");
      statut.textContent = msg(lang, cle);
    }

    bouton.disabled = false;
    bouton.textContent = msg(lang, "envoyer");
    dire("attente", "");

    bouton.addEventListener("click", function () {
      if (bouton.disabled) return;
      var brut = textarea.value;
      if (!valider(brut)) {
        var tropLong = nettoyer(brut).length > MAX;
        dire(tropLong ? "long" : "vide", "ko");
        bouton.disabled = false;
        return;
      }
      bouton.disabled = true;             // évite deux envois simultanés
      dire("attente", "");
      transmettre(fetchFn, brut, lang).then(function (etat) {
        if (etat === "ok") {
          dire("ok", "ok");
          bouton.disabled = true;          // message confirmé : un seul envoi
        } else {
          dire("erreur", "ko");
          bouton.disabled = false;         // échec visible, réessai possible
        }
      });
    });
  }

  var api = {
    URL_MESSAGE: URL_MESSAGE, MAX: MAX, MSG: MSG, langue: langue, msg: msg,
    nettoyer: nettoyer, valider: valider, confirme: confirme,
    transmettre: transmettre, brancher: brancher
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;

  if (typeof document !== "undefined" && document.querySelectorAll) {
    document.querySelectorAll(".formulaire-message").forEach(function (bloc) {
      brancher(bloc, document, function (u, o) { return global.fetch(u, o); });
    });
  }
})(typeof window !== "undefined" ? window : globalThis);
