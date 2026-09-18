# Plan — Dakaropoly (Monopoly 3D hot-seat)

## Objectif
Jeu de Monopoly complet (règles officielles) en 3D web fluide, multijoueur local hot-seat (2–8 joueurs sur une seule machine), plateau Dakar, ambiance diorama stylisé, animations + sons.

## Stack
- Vite + React 18 + TypeScript (strict)
- Three.js via @react-three/fiber + @react-three/drei
- Zustand (état du jeu) + Framer Motion (UI) + Howler.js (audio)
- Vitest (tests du moteur)

## Architecture

```
src/
  game/
    data/
      board.ts        # 40 cases Dakar (noms, couleurs, prix, loyers officiels)
      cards.ts        # 16 cartes Baraka + 16 cartes Teranga (effets typés)
    types.ts          # GameState, Player, Property, Phase, GameEvent...
    engine.ts         # réducteur pur applyAction(state, action) -> {state, events}
    selectors.ts      # calculs loyers, patrimoine, constructibilité
    store.ts          # Zustand + file d'animations (events queue)
  three/
    Board.tsx         # plateau diorama + 40 cases
    Tile.tsx          # case 3D (nom, couleur, maisons/hôtels, pions)
    Pawn.tsx          # pion stylisé + animation de déplacement case par case
    Dice.tsx          # dé 3D avec jet + atterrissage sur la bonne face
    Scene.tsx         # caméra, lumières, ombres douces, océan, poste
  ui/
    screens/
      Home.tsx
      Setup.tsx       # joueurs 2-8, prénoms, pions
      GameOver.tsx    # podium + stats + prix humoristiques
    hud/
      TurnBanner.tsx, PlayerPanel.tsx, ActionBar.tsx
      AuctionPanel.tsx, TradeModal.tsx, ManagePanel.tsx
      CardModal.tsx, EventLog.tsx, Toast.tsx
  audio/
    sounds.ts         # Howler manager + assets sonores générés (WebAudio)
  App.tsx, main.tsx
tests/ (vitest)
  engine.test.ts      # loyers, doubles/prison, enchères, faillite, cartes
```

## Règles couvertes (officielles)
- 2–8 joueurs, 1500 F de départ, salaire 200 F (double si pile sur Départ)
- Achat/refus → enchère (panel hot-seat, mise à la maison, enchérisseurs dans l'ordre)
- Loyers : rues (double si groupe complet, maisons/hôtels), gares 25/50/100/200, services ×4/×10
- Construction : groupe complet, uniforme, stock banque 32 maisons / 12 hôtels
- Hypothèque : valeur/2, rachat +10 %, pas de loyer ni construction
- Prison : 3 doubles → prison ; sortie par double, carte, ou 50 F ; max 3 tours
- Cartes Baraka/Teranga : 32 effets (déplacements, collectes, paiements, sortie de prison, réparation par maison/hôtel)
- Faillite : créancier joueur (hypothèques +10 %) ou banque (remise aux enchères) ; victoire = dernier debout

## Phases (3 étapes, vérifiables)

### Phase 1 — Socle jouable
1. `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, Tailwind
2. `game/types.ts` + `data/board.ts` (40 cases Dakar, prix officiels)
3. `game/engine.ts` v1 : lancers, déplacements, achat/loyer, fin de tour
4. `game/store.ts` + pont Zustand
5. `three/` : Scene, Board, Tile, Pawn, Dice v1
6. `ui/hud` minimal + écran Home/Setup
7. Vérif : `bun x tsc --noEmit` + partie de base jouable

### Phase 2 — Règles complètes
8. Enchères (AuctionPanel)
9. Maisons/hôtels (ManagePanel, stock banque)
10. Hypothèques + échanges (TradeModal)
11. Prison complète + cartes Baraka/Teranga (CardModal)
12. Faillite + élimination + GameOver
13. Tests vitest du moteur ; `bun x tsc --noEmit` + `bun run build`

### Phase 3 — Polish "fun"
14. Animations : déplacement pion saut par saut, vol de cartes, pluie de billets, célébrations
15. Sons (dés, pièces, cartes, alarme faillite) + toggle
16. Journal d'événements, toasts, bannière de tour animée
17. Prix humoristiques fin de partie + stats
18. Build final + review visuelle
