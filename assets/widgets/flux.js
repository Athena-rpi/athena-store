/* Athéna — widget « En direct » (U136).
   Affiche le dernier état publié par le collecteur (sys/flux.py) via le
   Worker public GET /etat (U134), rafraîchi par le minuteur toutes les
   3 minutes (U135).

   Règle absolue : une donnée absente, nulle ou invalide s'affiche
   « non disponible » (EN : « not available »). Rien n'est inventé,
   aucune valeur par défaut qui pourrait passer pour une mesure.
   Les revenus ne sont pas publiés par le collecteur : toujours
   « non disponible », avec la raison.

   Toute la mise en forme est dans modele() (pur, testé hors ligne par
   tests/test_flux_widget.mjs) ; le DOM est construit avec textContent,
   jamais innerHTML avec des données. */
(function (global) {
  "use strict";

  var URL_ETAT = "https://boite-aux-lettres.athena-boite.workers.dev/etat";
  var RAFRAICHIR_MS = 60000;   // re-lecture du flux
  var HORLOGE_MS = 30000;      // recalcul du « il y a … »

  var ND = { fr: "non disponible", en: "not available" };
  var ETATS_VALIDES = ["réfléchit", "agit", "en session", "à l'arrêt"];
  var ETATS_EN = {
    "réfléchit": "thinking",
    "agit": "acting",
    "en session": "in session",
    "à l'arrêt": "stopped"
  };

  function langue(doc) {
    var l = (doc && doc.documentElement && doc.documentElement.lang) || "fr";
    return l.toLowerCase().indexOf("en") === 0 ? "en" : "fr";
  }

  function dispo(v) {
    if (v === null || v === undefined) return false;
    if (typeof v === "number" && !isFinite(v)) return false;
    if (typeof v === "string" && v.trim() === "") return false;
    return true;
  }

  function nd(lang) { return ND[lang] || ND.fr; }

  function nombre(v, dec, lang) {
    if (!dispo(v) || typeof v !== "number") return nd(lang);
    var s = v.toFixed(dec);
    if (lang === "fr") s = s.replace(".", ",");
    return s;
  }

  function texte(v, lang) {
    return dispo(v) ? String(v) : nd(lang);
  }

  /* « il y a 3 min » / « 3 min ago ». Date invalide → non disponible.
     Une skew d'horloge ≤ 60 s dans le futur est ramenée à « instant ». */
  function delai(iso, maintenantMs, lang) {
    if (!dispo(iso)) return nd(lang);
    var t = Date.parse(iso);
    if (isNaN(t)) return nd(lang);
    var delta = maintenantMs - t;
    if (delta < -60000) return nd(lang);
    if (delta < 0) delta = 0;
    var s = Math.floor(delta / 1000);
    if (s < 60) return lang === "en" ? "less than a minute ago" : "il y a moins d'une minute";
    var m = Math.floor(s / 60);
    if (m < 60) return lang === "en" ? m + " min ago" : "il y a " + m + " min";
    var h = Math.floor(m / 60);
    if (h < 48) return lang === "en" ? h + " h ago" : "il y a " + h + " h";
    var j = Math.floor(h / 24);
    return lang === "en" ? j + " d ago" : "il y a " + j + " j";
  }

  function duree(secondes, lang) {
    if (!dispo(secondes) || typeof secondes !== "number" || secondes < 0) return nd(lang);
    var j = Math.floor(secondes / 86400);
    var h = Math.floor((secondes % 86400) / 3600);
    var m = Math.floor((secondes % 3600) / 60);
    if (lang === "en") return j + " d " + h + " h " + m + " min";
    return j + " j " + h + " h " + m + " min";
  }

  /* État de session : un flux sans état valide affiche « à l'arrêt »,
     jamais un état inventé (règle U137). */
  function etatSession(session, lang) {
    var brut = session && session.etat;
    var valide = dispo(brut) && ETATS_VALIDES.indexOf(brut) !== -1;
    var etat = valide ? brut : "à l'arrêt";
    return lang === "en" ? ETATS_EN[etat] : etat;
  }

  function classeEtat(session) {
    var brut = session && session.etat;
    if (brut === "réfléchit" || brut === "agit" || brut === "en session") return "actif";
    return "arret";
  }

  function dateLocale(iso, lang) {
    if (!dispo(iso)) return nd(lang);
    var t = Date.parse(iso);
    if (isNaN(t)) return nd(lang);
    var d = new Date(t);
    try {
      return d.toLocaleString(lang === "en" ? "en-CA" : "fr-CA",
        { dateStyle: "medium", timeStyle: "short" });
    } catch (e) {
      return d.toISOString();
    }
  }

  function champ(obj, cle) {
    return obj && Object.prototype.hasOwnProperty.call(obj, cle) ? obj[cle] : null;
  }

  /* Modèle pur : flux (objet ou null) + langue + maintenant → sections.
     flux null = flux injoignable : tout est « non disponible ». */
  function modele(flux, lang, maintenantMs) {
    var en = lang === "en";
    var pi = champ(flux, "pi");
    var session = champ(flux, "session");
    var backlog = champ(flux, "backlog");
    var cron = champ(flux, "cron");
    var git = champ(flux, "git");
    var sources = champ(flux, "sources");

    var m = {
      erreur: flux ? null : (en ? "Live feed unreachable — all data is not available."
                                : "Flux injoignable — toutes les données sont non disponibles."),
      fraicheur: {
        delai: delai(champ(flux, "genere_le"), maintenantMs, lang),
        date: dateLocale(champ(flux, "genere_le"), lang)
      },
      pi: [
        { label: en ? "CPU temperature" : "Température du CPU",
          valeur: dispo(champ(pi, "temp_c")) ? nombre(pi.temp_c, 1, lang) + " °C" : nd(lang) },
        { label: en ? "Throttling" : "Étranglement (throttling)",
          valeur: !dispo(champ(pi, "throttled")) ? nd(lang)
            : (pi.throttled === 0 ? (en ? "none" : "aucun")
                                  : (en ? "flag " : "drapeau ") + pi.throttled) },
        { label: en ? "Uptime" : "En marche depuis",
          valeur: duree(champ(pi, "uptime_s"), lang) },
        { label: en ? "Load (1 min)" : "Charge (1 min)",
          valeur: nombre(champ(pi, "load1"), 2, lang) },
        { label: en ? "Available memory" : "Mémoire disponible",
          valeur: dispo(champ(pi, "mem_avail_mb")) ? nombre(pi.mem_avail_mb / 1024, 1, lang) + " Go" : nd(lang) },
        { label: en ? "Disk used" : "Disque utilisé",
          valeur: dispo(champ(pi, "disk_used_pct")) ? nombre(pi.disk_used_pct, 1, lang) + " %" : nd(lang) },
        { label: en ? "Failed systemd units" : "Unités systemd en échec",
          valeur: texte(champ(pi, "failed_units"), lang) },
        { label: en ? "Temperature 24 h (min / avg / max)" : "Température 24 h (min / moy / max)",
          valeur: (dispo(champ(pi, "temp_min_24h")) && dispo(champ(pi, "temp_avg_24h")) && dispo(champ(pi, "temp_max_24h")))
            ? nombre(pi.temp_min_24h, 1, lang) + " / " + nombre(pi.temp_avg_24h, 1, lang) + " / " + nombre(pi.temp_max_24h, 1, lang) + " °C"
            : nd(lang) }
      ],
      athena: {
        etat: etatSession(session, lang),
        classe: classeEtat(session),
        depuis: session && dispo(session.depuis)
          ? delai(session.depuis, maintenantMs, lang) : nd(lang),
        tacheEnCours: nd(lang),   // le collecteur n'expose pas la tâche en cours
        prochaineTache: (function () {
          var p = champ(backlog, "prochaine");
          if (!p || !dispo(champ(p, "id")) || !dispo(champ(p, "titre"))) return nd(lang);
          return p.id + " — " + p.titre;
        })(),
        contexte: [
          { label: en ? "Session turn" : "Tour de session",
            valeur: texte(champ(session, "tour"), lang) },
          { label: en ? "Tool calls (turn)" : "Appels d'outils (tour)",
            valeur: texte(champ(session, "outils_appeles"), lang) },
          { label: en ? "Tokens (turn)" : "Jetons (tour)",
            valeur: texte(champ(session, "jetons"), lang) },
          { label: en ? "Active cron jobs" : "Jobs cron actifs",
            valeur: dispo(champ(cron, "actifs")) && dispo(champ(cron, "total"))
              ? cron.actifs + " / " + cron.total : nd(lang) },
          { label: en ? "Tasks remaining" : "Tâches restantes",
            valeur: dispo(champ(backlog, "restantes")) && dispo(champ(backlog, "total"))
              ? backlog.restantes + " / " + backlog.total : nd(lang) },
          { label: en ? "Git branch" : "Branche git",
            valeur: texte(champ(git, "branche"), lang) },
          { label: en ? "Last commit" : "Dernier commit",
            valeur: (function () {
              var c = champ(git, "dernier_commit");
              if (!c || !dispo(champ(c, "hash"))) return nd(lang);
              return c.hash + (dispo(champ(c, "date")) ? " (" + delai(c.date, maintenantMs, lang) + ")" : "");
            })() }
        ]
      },
      revenus: {
        valeur: nd(lang),
        note: en ? "The collector does not publish revenue. No figure is invented."
                 : "Le collecteur ne publie pas les revenus. Aucun chiffre n'est inventé."
      },
      sources: (function () {
        if (!sources || typeof sources !== "object") return [];
        return Object.keys(sources).sort().map(function (k) {
          return { nom: k, statut: texte(sources[k], lang) };
        });
      })()
    };
    return m;
  }

  /* ---- DOM : uniquement textContent, jamais innerHTML avec des données ---- */

  function el(doc, tag, classe, texteContenu) {
    var n = doc.createElement(tag);
    if (classe) n.className = classe;
    if (texteContenu !== undefined && texteContenu !== null) n.textContent = String(texteContenu);
    return n;
  }

  function dl(doc, paires) {
    var liste = el(doc, "dl", "flux-liste");
    paires.forEach(function (p) {
      liste.appendChild(el(doc, "dt", null, p.label));
      liste.appendChild(el(doc, "dd", null, p.valeur));
    });
    return liste;
  }

  function construire(m, lang, doc) {
    var en = lang === "en";
    var frag = doc.createDocumentFragment ? doc.createDocumentFragment() : el(doc, "div");

    frag.appendChild(el(doc, "p", "widget-titre",
      en ? "Live — the Pi and Athena, right now" : "En direct — le Pi et Athéna, maintenant"));

    if (m.erreur) frag.appendChild(el(doc, "p", "flux-erreur", m.erreur));

    var fraicheur = el(doc, "p", "flux-fraicheur");
    fraicheur.appendChild(el(doc, "span", null,
      (en ? "Last update: " : "Dernière mise à jour : ") + m.fraicheur.delai));
    fraicheur.appendChild(el(doc, "span", "flux-date", " (" + m.fraicheur.date + ")"));
    frag.appendChild(fraicheur);

    var sPi = el(doc, "section", "flux-section");
    sPi.appendChild(el(doc, "h3", null, en ? "The Raspberry Pi 5" : "Le Raspberry Pi 5"));
    sPi.appendChild(dl(doc, m.pi));
    frag.appendChild(sPi);

    var sA = el(doc, "section", "flux-section");
    sA.appendChild(el(doc, "h3", null, en ? "Athena" : "Athéna"));
    var etatLigne = el(doc, "p", "flux-etat " + m.athena.classe);
    etatLigne.appendChild(el(doc, "span", "flux-puce", "● "));
    etatLigne.appendChild(el(doc, "span", null,
      (en ? "State: " : "État : ") + m.athena.etat));
    sA.appendChild(etatLigne);
    sA.appendChild(dl(doc, [
      { label: en ? "In this state since" : "Dans cet état depuis", valeur: m.athena.depuis },
      { label: en ? "Current task" : "Tâche en cours", valeur: m.athena.tacheEnCours },
      { label: en ? "Next task" : "Prochaine tâche", valeur: m.athena.prochaineTache }
    ]));
    sA.appendChild(el(doc, "h4", null, en ? "Context" : "Contexte"));
    sA.appendChild(dl(doc, m.athena.contexte));
    frag.appendChild(sA);

    var sR = el(doc, "section", "flux-section");
    sR.appendChild(el(doc, "h3", null, en ? "Revenue" : "Revenus"));
    sR.appendChild(dl(doc, [{ label: en ? "Published revenue" : "Revenus publiés", valeur: m.revenus.valeur }]));
    sR.appendChild(el(doc, "p", "flux-note", m.revenus.note));
    frag.appendChild(sR);

    if (m.sources.length) {
      var sS = el(doc, "section", "flux-section");
      sS.appendChild(el(doc, "h3", null, en ? "Collector sources" : "Sources du collecteur"));
      sS.appendChild(dl(doc, m.sources.map(function (s) {
        return { label: s.nom, valeur: s.statut };
      })));
      frag.appendChild(sS);
    }

    frag.appendChild(el(doc, "p", "flux-note",
      en ? "Published every 3 minutes by the Pi itself. Missing data is shown as “not available”, never invented. No personal data, no addresses, no keys."
         : "Publié toutes les 3 minutes par le Pi lui-même. Une donnée absente s'affiche « non disponible », jamais inventée. Aucune donnée personnelle, ni adresse, ni clé."));
    return frag;
  }

  function rendu(bloc, flux, lang, maintenantMs, doc) {
    var m = modele(flux, lang, maintenantMs);
    while (bloc.firstChild) bloc.removeChild(bloc.firstChild);
    bloc.appendChild(construire(m, lang, doc));
    return m;
  }

  function brancher(bloc, doc, fetchFn, nowFn, timerFn) {
    var lang = langue(doc);
    var dernier = null;
    function dessiner() { rendu(bloc, dernier, lang, nowFn(), doc); }
    function lire() {
      fetchFn(URL_ETAT, { cache: "no-store" })
        .then(function (r) {
          if (!r.ok) throw new Error("HTTP " + r.status);
          return r.json();
        })
        .then(function (j) {
          dernier = (j && typeof j === "object") ? j : null;
          dessiner();
        })
        .catch(function () { dernier = null; dessiner(); });
    }
    dessiner();          // premier rendu : tout « non disponible » en attendant
    lire();
    timerFn(lire, RAFRAICHIR_MS);
    timerFn(dessiner, HORLOGE_MS);
  }

  var api = {
    URL_ETAT: URL_ETAT, dispo: dispo, nombre: nombre, texte: texte,
    delai: delai, duree: duree, etatSession: etatSession, classeEtat: classeEtat,
    modele: modele, construire: construire, rendu: rendu, brancher: brancher,
    langue: langue
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;

  if (typeof document !== "undefined" && document.querySelectorAll) {
    document.querySelectorAll('.widget[data-widget="flux"]').forEach(function (bloc) {
      brancher(bloc, document,
        function (u, o) { return global.fetch(u, o); },
        function () { return Date.now(); },
        function (f, ms) { return global.setInterval(f, ms); });
    });
  }
})(typeof window !== "undefined" ? window : globalThis);