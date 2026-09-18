# 🎲 Dakaropoly

Un Monopoly 3D complet, jouable dans le navigateur, avec le plateau de **Dakar** (Sénégal).
Conçu pour les soirées famille : **2 à 8 joueurs sur un seul écran** (hot-seat), chacun son tour.

## 🚀 Installation

```bash
bun install
bun run dev        # serveur de développement → http://localhost:5173
```

## 🛠️ Commandes

| Commande | Effet |
| --- | --- |
| `bun run dev` | Serveur de dev avec hot-reload |
| `bun run build` | Vérification TypeScript + build de production (`dist/`) |
| `bun run preview` | Prévisualiser le build de production |
| `bun run test` | Tests Vitest du moteur de règles (26 tests) |
| `bun run typecheck` | Vérification TypeScript seule |

## 🏙️ Le plateau Dakar

Du moins cher au plus cher, en suivant les prix réels de l'immobilier dakarois :

- 🟤 Marron : Pikine, Guédiawaye
- 🔵 Bleu clair : Parcelles Assainies, Grand Yoff, Ouest-Foire
- 🩷 Rose : Médina, Hann-Maristes, Fass-Colobane
- 🟠 Orange : Sicap-Liberté, Grand Dakar, Ouakam
- 🔴 Rouge : Yoff, Sacré-Cœur, Mermoz
- 🟡 Jaune : Point E, Fann, Plateau
- 🟢 Vert : Les Mamelles, Baobab, Fann Résidence
- 🔷 Bleu foncé : Ngor, Almadies

Les cases spéciales : gares du **TER** (Dakar, Bel-Air, Ouakam, Almadies), services **SENELEC** ⚡ et **SDE** 💧,
cartes **« Baraka ! »** 🍀 et **« Teranga »** 🤝, prison de **Rebeuss**, et le **Départ** (double salaire si pile dessus).

Les règles sont celles du **Monopoly officiel** : enchères obligatoires, construction uniforme,
stock limité de la banque (32 maisons / 12 hôtels), hypothèques (+10 %), prison (3 tentatives),
échanges entre joueurs, faillite (créancier joueur ou banque).

## 🏗️ Architecture

```
src/
  game/
    types.ts          # Types du jeu (état, actions, événements)
    engine.ts         # Moteur pur : applyAction(state, action) → { state, events }
    selectors.ts      # Calculs de règles (loyers, constructibilité, valeur nette)
    store.ts          # Zustand + file d'animations séquentielle
    data/
      board.ts        # 40 cases (noms Dakar, prix/loyers officiels)
      cards.ts        # 16 cartes Baraka + 16 cartes Teranga (effets typés)
      pawns.ts        # 8 pions (formes + couleurs)
    colors.ts
  three/
    Scene.tsx         # Canvas R3F, lumières, océan, caméra orbitale
    BoardMesh.tsx     # Plateau diorama (40 cases + decks + logo)
    PawnMesh.tsx      # Pions animés (saut de case en case)
    DiceMesh.tsx      # Dé 3D avec jet et atterrissage sur la bonne face
    geometry.ts       # Positions du plateau (grille 13×13)
    textures.ts       # Labels/logo générés via canvas (0 asset externe)
  ui/
    screens/          # Home, Setup, GameScreen, GameOver
    hud/              # Panels de jeu (achat, enchères, dette, patrimoine, échange…)
  audio/
    sounds.ts         # Sons synthétisés WebAudio (aucun fichier audio)
tests/
  engine.test.ts      # Tests des règles (loyers, prison, enchères, faillite…)
```

**Principes :**

- Le **moteur** (`game/engine.ts`) est du TypeScript pur, sans React : chaque action joueur passe
  par `applyAction(state, action)` et produit un nouvel état + une liste d'événements.
- La **file d'animations** du store joue ces événements séquentiellement (dés, déplacements, cartes,
  sons) pour que la 3D raconte toujours ce qui se passe.
- **Zéro asset externe** : plateau, pions, dés et textes sont générés procéduralement — chargement
  instantané et ~60 fps.

## 🎯 Roadmap possible

- Mode en ligne (chaque joueur sur son appareil, session partagée)
- Ambiance sonore de fond + musiques
- Règles maison configurables (pot au parking gratuit, etc.)
- Décor Dakar enrichi (monuments 3D sur les cases premium)
