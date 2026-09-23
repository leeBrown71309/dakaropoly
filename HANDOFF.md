# HANDOFF — Dakaropoly

> Document de transfert pour agent. Objectif : comprendre le projet, ce qui est fait, et terminer le reste.

## 1. Vision

Monopoly 3D complet, jouable dans le navigateur, pour soirées famille : **2–8 joueurs**, soit sur un seul écran (hot-seat), soit **en ligne avec un code de salon**, chacun sur son appareil. Plateau **Dakar** (rues/ports réels, du moins cher au plus cher), **règles officielles** strictes, **3D diorama légère** (~60 fps, zéro asset externe), UI française, touches fun (sons, animations, prix humoristiques en fin de partie). Usage personnel, pas commercial.

## 2. Stack

Vite + React 19 + TypeScript strict + Tailwind v4 · Three.js via React Three Fiber + drei · Zustand · Framer Motion · Vitest. Sons synthétisés WebAudio (pas de Howler, pas de fichiers audio).

## 3. Architecture (ce qu'il faut retenir)

```
src/game/engine.ts     CŒUR — moteur pur sans React : applyAction(state, action) → { state, events }
                       Machine à états : turn-start | resolving | post-roll | buy-decision | auction | debt | card | game-over
src/game/store.ts      Zustand + file d'animations séquentielle (joue les événements : dés, déplacements, cartes, sons)
src/game/selectors.ts  Calculs de règles (loyers, constructibilité, hypothèque, valeur nette)
src/game/data/         board.ts (40 cases Dakar, prix officiels), cards.ts (16 Baraka + 16 Teranga), pawns.ts, colors.ts
src/three/             Scene.tsx (canvas), BoardMesh.tsx (plateau/cases), PawnMesh.tsx, DiceMesh.tsx,
                       geometry.ts (grille 13×13, ancres pions), textures.ts (labels canvas)
src/ui/screens/        Home, Setup, GameScreen, GameOver
src/ui/hud/            PlayersPanel, ActionBar, BuyPanel, AuctionPanel, DebtPanel, ManagePanel, TradeModal, CardModal, Toasts, TurnBanner
src/net/               Mode en ligne : Supabase Realtime, salons, verrouillage des tours
tests/                 47 tests (moteur, dés, événements, durcissement)
```

Règle d'or : **la logique va dans le moteur** (pur, testable), la 3D et l'HUD ne font que consommer l'état + jouer les événements.

## 4. Ce qui est fait et vérifié ✅

- Moteur complet : achat/enchères, loyers (groupe complet, maisons/hôtels, gares, services), hypothèques (+10 %), échanges, prison (3 tentatives, carte, 50 F), 3 doubles → prison, double salaire pile sur Départ, faillite (joueur ou banque → enchères), victoire dernier debout
- 40 cases Dakar + 32 cartes à effets typés ; 8 pions ; stock banque 32 maisons/12 hôtels
- 3D : plateau diorama, pions qui sautent case par case, dé 3D qui atterrit sur la bonne face, cartes animées, océan, caméra orbitale
- HUD complet : achat, enchères, dette, patrimoine (construire/vendre/hypothéquer), échange, journal, toasts, bannière de tour, pluie de billets
- Abandonner la partie : action moteur `resign` (le joueur sort définitivement ; son argent et la valeur de ses maisons sont partagés entre les joueurs restants, ses titres retournent à la banque ; le tour passe ; la case qu'il était en train de décider part aux enchères ; une dette envers lui devient due à la banque). À deux joueurs, l'autre gagne aussitôt. Refusé pendant une enchère, et pour le joueur qui a une carte ou une dette en cours (`canResign` dans `selectors.ts`). Bouton « Abandonner » dans le dialog de sortie, avec confirmation (Quitter = quitter le salon, le joueur reste assis ; Abandonner = le joueur quitte le jeu). En ligne, un abandon relayé par un appareil qui n'occupe pas ce siège est ignoré.
- Base de données : un salon dont plus aucun joueur assis ne donne signe de vie pendant son délai (10 min par défaut, 5/15/20/30 au choix de l'hôte, dans Paramètres → Salon ou dans le salon d'attente) est supprimé (`release_empty_rooms`, appelée par `create_room`, `get_room` et le heartbeat `touch_seat`). Les appareils encore connectés sont renvoyés à l'accueil avec l'explication. Schéma appliqué sur le projet Supabase le 23/09/2026.
- Paramètres refaits : barre latérale (Salon, Réglages, Groupes, Règles) et sections titrées, dans `src/ui/hud/settings/`.
- Sons WebAudio synthétisés + toggle 🔊
- `tsc` 0 erreur · `bun run build` OK · **26/26 tests** · testé visuellement dans le navigateur (partie complète : lancer, achat, impôt, rotation des tours, cartes)

## 5. Ce qui reste à faire 🔲 (par priorité)

1. **Polish visuel 3D** : silhouettes de monuments dakarois sur les cases premium, jet de pion plus expressif, contact shadows douces, léger tilt caméra vers le joueur actif.
2. **Fin de partie** : l'écran GameOver existe mais n'a jamais été testé en conditions réelles (faillite en UI). Vérifier podium, stats, prix humoristiques.
3. **Edge cases UI** : dettes à plusieurs joueurs (carte « payez 50 F à chacun »), enchères avec 3+ enchérisseurs en rotation, timer d'enchère avec suspense (prévu, non fait).
4. **Ambiance sonore** : boucle de fond légère + volume réglable.
5. **Règles maison configurables** (écran d'options avant partie : pot au parking, double salaire Départ on/off…).
6. ~~Mode en ligne~~ **fait** (étapes 1–2) : salon, code, tours verrouillés. Restent les échanges à double consentement, le chat écrit, les avatars et les spectateurs — puis le vocal, mis en attente.

## 6. Pièges / notes techniques pour l'agent

- Le hook `forced` sur l'action `roll` (`{ t: "roll", forced: { a, b } }`) existe pour les tests — ne pas l'exposer dans l'UI.
- Labels 3D = canvas textures (voir `src/three/textures.ts`) : pas de police web, tout est caché.
- Orientation plateau : textes TOUS à l'endroit (lisibles caméra unique) via `SIDE_LAYOUT` dans `geometry.ts` — ne pas réintroduire de rotation par côté.
- Le store garde l'état entre HMR — faire un reload complet pour repartir de zéro.
- Une partie en cours + modif du code = l'écran peut repasser au setup : comportement HMR, pas un bug.
- Vérifs imposées après chaque changement : `bun x tsc -p tsconfig.json --noEmit`, `bun run test`, et `bun run build` avant livraison.
- Mode en ligne : deux onglets du **même** navigateur sont deux joueurs distincts (l'identité est par onglet, pas par navigateur). Fermer l'onglet perd le siège — la reprise de siège reste à faire.
- Les échanges sont désactivés en ligne tant qu'ils s'exécutent sans l'accord du destinataire.

## 7. Commandes

```bash
bun install && bun run dev   # http://localhost:5173
bun run test                 # 26 tests moteur
bun run build                # tsc + build prod
```
