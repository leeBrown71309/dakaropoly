# Plan — Comptes joueurs et historique des parties

Branche : `feature/user-accounts` (depuis `online-part`, y revient avant `pre-prod` → `main`).

## Objectif

Permettre à un joueur de se connecter avec Google, de se choisir un pseudo unique et une
photo facultative, et de retrouver ses 20 dernières parties en ligne (terminées ou
inachevées) avec leur détail. Le jeu reste entièrement jouable sans compte.

## Architecture

- **Auth** : Supabase Auth, fournisseur Google. Pas de serveur, pas de Better Auth.
  L'identité Google *est* `auth.uid()` : c'est elle qui tient la chaise, donc toutes
  les fonctions existantes restent valables.
- **Stockage de session** : un adaptateur route une session anonyme vers
  `sessionStorage` (par onglet, comme aujourd'hui) et une session de compte vers
  `localStorage` (on reste connecté). En lecture, la session de l'onglet passe en
  premier : un onglet invité déjà assis ne devient jamais un compte par surprise.
- **Événements d'auth** : `onAuthStateChange` reçoit aussi les connexions faites dans
  les autres onglets (BroadcastChannel). Le store de compte relit donc `getSession()`
  au lieu de se fier au contenu de l'événement.
- **Connexion et déconnexion depuis l'accueil seulement**, hors salon.
- **Enregistrement des parties par la base** : `open_room` crée la partie,
  `resume_seat` ajoute un occupant, `advance_room` la termine, un trigger
  `before delete on rooms` la marque inachevée. Les appareils n'écrivent jamais
  d'historique.
- **Classement recalculé côté client** à partir de l'état final stocké
  (`final = state - 'log'`), avec les sélecteurs existants : aucune règle en SQL.
- **Compatibilité** : un seul projet Supabase sert `main` et les branches. Chaque
  changement de schéma doit rester compatible avec le client en ligne (mêmes
  signatures, comportement additionnel seulement).
- **Photo** : data URL base64, recadrée en carré 128 px, WebP (JPEG en repli),
  plafonnée à 60 000 caractères par une contrainte en base.

## Prérequis (à faire par toi, en parallèle du code)

- [ ] P1. Google Cloud Console : écran de consentement OAuth (externe, scopes `openid`,
      `email`, `profile`) et identifiant OAuth « Application Web », avec l'URI de
      redirection `https://<ref>.supabase.co/auth/v1/callback`.
- [ ] P2. Supabase → Authentication → Providers → Google : activer, coller l'identifiant
      et le secret.
- [ ] P3. Supabase → Authentication → URL Configuration : ajouter
      `http://localhost:5173/**` et `https://leebrown71309.github.io/dakaropoly/**`.

## Tâches

### Phase 1 — Moteur : ordre des faillites et classement unique

- [x] 1. `src/game/types.ts` : ajouter `eliminationOrder: number | null` à `Player`
      (1 pour le premier éliminé). Un numéro de tour ne suffisait pas : une carte
      « payez à chacun » peut éliminer deux joueurs dans le même tour.
- [x] 2. `src/game/engine.ts` : initialiser à `null` dans `createGame`, et le renseigner
      dans `transferAssets`, qui couvre la faillite et l'abandon.
- [x] 3. `src/game/selectors.ts` : `standingsOf(state)` classe les joueurs actifs au
      patrimoine décroissant, puis les éliminés du dernier tombé au premier.
- [x] 4. `src/game/store.ts` : `version: 3` ; `migrate` renseigne `eliminationOrder: null`
      sur une sauvegarde plus ancienne.
- [x] 5. `tests/standings.test.ts` : ordre des actifs, ordre des faillites, abandon,
      état sans `eliminationOrder` (lu comme `null`).
- [x] 6. `src/ui/screens/GameOver.tsx` : extraire le corps en `FinalStandings`
      (`src/ui/screens/FinalStandings.tsx`), qui prend un `GameState` et utilise
      `standingsOf`. `GameOver` garde les boutons.
- [x] 7. Vérifier : `bun x tsc -p tsconfig.json --noEmit` et `bun run test`. Commit
      `feat(game): record when each player went bankrupt and rank on it`.

### Phase 2 — Schéma (`supabase/schema.sql`)

- [x] 8. Table `profiles` : `id` (→ `auth.users`, cascade), `pseudo` unique et sensible
      à la casse (3–14 caractères, sans espace au début ni à la fin, lettres, chiffres,
      espace, `_`, `.` et `-`), `avatar` (null ou `data:image/…` de 60 000 caractères au
      plus), `created_at`, `updated_at`. RLS activée, sans aucune policy.
- [x] 9. Tables `games` (`id`, `room_code`, `status` playing/finished/unfinished,
      `started_at`, `ended_at`, `turn_count`, `winner`, `final`) et `game_seats` (`id`,
      `game_id` en cascade, `seat`, `account_id` → `profiles` en `set null`, `name`,
      `pawn`, `from_turn`), avec un index sur `(account_id, game_id)`. Colonne
      `rooms.game_id`. RLS activée, sans aucune policy.
- [x] 10. ~~Fonction interne `account_of(uid)`~~ : inutile, chaque fonction lit le profil
      directement (un `select … into` vide pour un invité). `close_game` factorise la
      clôture d'une partie, et supprime une partie où aucun compte n'a joué.
- [x] 11. `pseudo_available(p_pseudo)`, `get_my_profile()`, `save_profile(p_pseudo,
      p_avatar)` (refusé aux sessions anonymes ; une violation d'unicité remonte en
      « Ce pseudo existe déjà »), `delete_account()` (supprime la ligne `auth.users` ;
      la cascade et le `set null` font le reste).
- [x] 12. `claim_seat` : pour un compte, le nom et la photo viennent du profil,
      jamais de la requête.
- [x] 13. `resume_seat` : pour un compte, le nom de la liste des joueurs = son pseudo,
      avec sa photo. Si la chaise change de mains, ajouter une ligne `game_seats`
      (`from_turn` = `state.turnCount`).
- [x] 14. `open_room` : créer la ligne `games`, remplir `rooms.game_id`, et ajouter
      une ligne `game_seats` par joueur (nom et pion lus dans l'état, `account_id` si
      le client a un profil).
- [x] 15. `advance_room` : à l'arrivée en `game-over`, passer la partie en `finished`
      (`ended_at`, `turn_count`, `winner`, `final = p_state - 'log'`).
- [x] 16. Trigger `before delete on rooms` : une partie encore `playing` passe en
      `unfinished`, avec le dernier état connu et `ended_at = old.updated_at`.
- [x] 17. `get_my_games(p_limit default 20)` : `{ games: [...], people: { id: { pseudo,
      avatar } } }`. Les photos sont dédupliquées dans `people` plutôt que répétées
      à chaque siège.
- [x] 18. Ajouter chaque nouvelle fonction à la boucle `revoke` / `grant`.
- [x] 19. Appliquer le schéma au projet Supabase, à la main ou via le connecteur
      après ta confirmation. Vérifier les avertissements de sécurité (advisors).
      Fait le 24/09/2026 après 75 vérifications sur PGlite (profils, pseudo pris,
      partie complète, chaise reprise, expiration, invités seuls, suppression, droits).
      Commit `feat(db): record online games and player profiles`.

### Phase 3 — Client d'authentification

- [x] 20. `src/net/authStorage.ts` : l'adaptateur de stockage (fonction pure,
      testable avec de faux stockages) ; `tests/auth-storage.test.ts`.
- [x] 21. `src/net/supabase.ts` : brancher l'adaptateur et le flux `pkce`.
- [x] 22. `src/net/pseudo.ts` : `validatePseudo` (mêmes règles que la contrainte SQL,
      messages en français) et `suggestPseudo` (à partir du nom Google) ;
      `tests/pseudo.test.ts`.
- [x] 23. `src/net/account.ts` : `signInWithGoogle()` (redirection vers la page
      courante), `signOut()`, `fetchMyProfile`, `isPseudoAvailable`, `saveProfile`,
      `deleteAccount`, `fetchMyGames`. Chaque appel vérifie l'erreur qu'il reçoit.
      Les lectures de l'historique (place, victoire, reprises, noms du jour) sont dans
      `src/net/history.ts`, testées par `tests/history.test.ts`.
- [x] 24. `src/net/accountStore.ts` : store zustand `{ status: loading | guest |
      needs-profile | ready, profile, googleName, googlePhoto }`, initialisé au
      démarrage et resynchronisé à chaque événement d'auth en relisant
      `getSession()`. Retirer `?code=` de l'URL une fois la session obtenue.
- [x] 25. `src/ui/avatarImage.ts` : `fileToAvatar(file)` et `urlToAvatar(url)` (canvas,
      recadrage centré, 128 px, WebP puis JPEG) ; échec explicite si l'image est
      illisible ou trop lourde.
- [x] 26. Vérifier : tsc et tests. Commit `feat(net): sign in with Google and keep
      the account between visits`.

### Phase 4 — Profil et tableau de bord

- [ ] 27. `src/ui/kit/Avatar.tsx` : la photo, ou l'initiale sur un fond aux couleurs
      du plateau (SVG, sans fichier externe).
- [ ] 28. `src/ui/icons/PlayerMark.tsx` : prop `avatar` facultative ; sinon, la photo
      du siège dans le salon courant. Photo cerclée de la couleur du joueur, avec son
      pion en pastille à partir de 20 px.
- [ ] 29. `src/game/store.ts` + `src/App.tsx` : écran `"profile"` et `openProfile()`.
- [ ] 30. `src/ui/profile/ProfileForm.tsx` : pseudo avec disponibilité vérifiée
      pendant la saisie (délai de 400 ms, « Ce pseudo existe déjà ») ; photo (Google,
      import, retrait) ; Enregistrer. Sert à la création comme à la modification.
- [ ] 31. `src/ui/profile/GameHistory.tsx` : les 20 dernières parties (date, durée,
      tours, badge Inachevée, ta place, vainqueur, joueurs, mention de reprise de
      chaise).
- [ ] 32. `src/ui/profile/GameDetail.tsx` : `FinalStandings` en lecture seule, avec
      les photos venant de `people`.
- [ ] 33. `src/ui/screens/Profile.tsx` : titre, section Profil, section Mes parties,
      puis en pied de page Se déconnecter et Supprimer mon compte (confirmation).
      En `needs-profile`, n'afficher que le formulaire de création.
- [ ] 34. `src/ui/screens/Home.tsx` : bouton « Se connecter avec Google », ou pastille
      avatar + pseudo qui ouvre le profil. Masqué sans configuration en ligne.
- [ ] 35. Vérifier : tsc, tests, build. Commit `feat(ui): add the profile screen and
      the history of online games`.

### Phase 5 — Le compte à la table

- [ ] 36. `src/ui/screens/Online.tsx` : pour un compte, remplacer le champ « Votre
      nom » par l'identité (avatar + pseudo, « à modifier dans le profil »). Pas de
      renommage dans le salon d'attente. Avatars dans la liste des joueurs.
- [ ] 37. `src/net/roomStore.ts` : `host`, `join` et `setPawn` envoient le pseudo ;
      `renameSelf` est refusé à un compte ; après `resume` d'une chaise par un compte,
      dispatcher `rename` si le nom sur le plateau n'est pas son pseudo.
- [ ] 38. `src/ui/hud/PlayersPanel.tsx`, `src/ui/hud/ChatPanel.tsx`,
      `src/ui/hud/settings/RoomTab.tsx` : photos via `PlayerMark` / `Avatar`
      (spectateurs : initiale). Le renommage dans RoomTab est masqué pour un compte.
- [ ] 39. Vérifier : tsc, tests, build. Commit `feat(net): carry the account's
      pseudo and photo to the table`.

### Phase 6 — Vérification et documentation

- [ ] 40. Navigateur, mode invité : partie locale, création et arrivée dans un salon
      sans compte. Rien ne doit avoir changé.
- [ ] 41. Navigateur, mode compte (une fois P1–P3 faits) : connexion, création du
      profil, pseudo déjà pris, photo, salon, partie jusqu'au bout, historique,
      détail, partie inachevée après expiration du salon, déconnexion, suppression.
- [ ] 42. `CLAUDE.md` (section Comptes), `HANDOFF.md`, `README.md` (configuration
      Google). Commit `docs: record accounts and game history`.

## Limites assumées

- Un client modifié peut envoyer une fausse fin de partie : c'est le même niveau de
  confiance que le jeu en ligne actuel.
- Un compte est le même joueur dans tous les onglets du navigateur. Ouvrir le même
  salon dans deux onglets revient à se reconnecter depuis l'autre.
- Les spectateurs n'ont pas de photo.
- Hors périmètre : Facebook, statistiques globales, parties locales dans
  l'historique, profils publics.
