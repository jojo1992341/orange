# Mode édition des guides

Ajout d'un mode édition aux guides de Ganymède, inspiré du « Mode édition » de
**Mes guides Dofus**. Il permet de modifier un guide téléchargé (ou d'en créer un) sans
qu'une mise à jour venue du serveur n'écrase le travail.

## Ce que fait le mode édition

| Action | Où |
| --- | --- |
| Activer / quitter le mode édition | **Icône crayon** dans la barre du guide ouvert, à gauche des icônes note / sommaire / rapport (toujours visible, quelle que soit la taille de la fenêtre) |
| Activer le mode édition depuis la liste | **Clic droit** sur un guide → **Modifier le guide** (le guide s'ouvre directement en édition) |
| Activer le mode édition (fenêtre < 320 px) | Menu « ⋯ » d'un guide → **Mode édition** |
| Renommer le guide | Champ **Nom du guide** |
| Modifier le contenu d'une étape | Onglet **Contenu** (HTML de l'étape) + **Aperçu** |
| Renommer une étape, changer sa carte / ses coordonnées | Champs au-dessus de l'éditeur |
| Insérer `[X,Y]` au curseur | Bouton **Insérer [X,Y]** |
| Ajouter / dupliquer / supprimer une étape | Barre d'actions de l'étape |
| Déplacer une étape vers le haut / le bas | Flèches de la barre d'actions |
| Enregistrer | Bouton **💾** (ou le guide reste « Modifications non enregistrées ») |
| Abandonner le brouillon en cours | Bouton **↩** |
| Revenir à la version Ganymède du guide | **Rétablir le guide original** |
| Créer un guide vide | Bouton **+** de la bibliothèque des guides |
| Dupliquer un guide existant | Menu « ⋯ » → **Dupliquer le guide** |

Le bouton crayon est coloré (accent) tant que le mode édition est actif ; un second clic
le quitte, avec un avertissement si le brouillon n'est pas enregistré.

Le contenu d'une étape est le HTML utilisé par Ganymède : les coordonnées écrites
`[12,-8]` deviennent automatiquement des positions cliquables, et les blocs existants
(quêtes, liens vers une autre étape, images) continuent de fonctionner. L'onglet
**Aperçu** affiche le rendu réel, avec les mêmes composants que la lecture normale.

## Protection contre les mises à jour

À la première modification enregistrée d'un guide :

1. la version d'origine est copiée dans `<id>.json.bak`, à côté du guide ;
2. le guide reçoit un marqueur `local_edit` (date de dernière modification locale +
   version serveur dont il est issu) ;
3. le guide n'est **plus jamais** remplacé par les mises à jour automatiques :
   ni au démarrage, ni par « Mettre à jour tous les guides ». Il est signalé
   « conservé tel quel » dans le dialogue de résultat ;
4. il n'alimente plus l'indicateur « Des mises à jour sont disponibles » ;
5. un crayon apparaît à côté de son nom dans la bibliothèque des guides.

**Rétablir le guide original** télécharge à nouveau la version Ganymède, remplace le
fichier local et supprime le marqueur (ainsi que le `.bak`). L'action est refusée sur
les guides créés dans l'application, qui n'existent pas sur le serveur.

Retélécharger volontairement le même guide depuis le catalogue reste possible : c'est
une action explicite, elle écrase donc les modifications locales (le `.bak` reste sur
le disque).

## Fichiers et données

- Guides : `%APPDATA%\com.ganymede.ganymede-app\guides\` (Windows),
  `~/Library/Application Support/com.ganymede.ganymede-app/guides/` (macOS),
  `~/.config/com.ganymede.ganymede-app/guides/` (Linux).
  Un guide par fichier `<id>.json`, sauvegarde éventuelle `<id>.json.bak`.
- Les guides créés dans l'application utilisent des identifiants à partir de
  `2 000 000 000`, pour ne jamais entrer en collision avec un identifiant serveur.
- Aucun fichier existant n'est supprimé : au pire, un `.bak` est laissé sur place.
- Les notes d'étape (`step_notes.json`) et la progression ne sont pas touchées par le
  mode édition.

## Limites assumées

- Le mode édition modifie le **texte et la structure** des étapes. Il ne recalcule pas
  les besoins en ressources des quêtes comme le fait « Mes guides Dofus » : Ganymède
  n'embarque pas le catalogue de quêtes nécessaire, et les blocs de quête édités
  restent ceux du guide.
- Les modifications sont locales à la machine : rien n'est renvoyé au serveur Ganymède.
- La synchronisation des profils ne transporte que la progression, pas les guides.

## Notes de développement

Nouvelles commandes TauRPC (`src-tauri/src/guides.rs`, namespace `guides`) :

| Commande | Rôle |
| --- | --- |
| `saveGuide(guide_id, name, steps)` | Écrit le guide, crée le `.bak`, pose `local_edit` |
| `createLocalGuide(name, folder)` | Crée un guide vide avec un identifiant local |
| `duplicateGuide(guide_id)` | Copie un guide dans un nouveau guide local |
| `revertGuideToServer(guide_id)` | Réinstalle la version serveur et retire `local_edit` |

Autres points :

- `UpdateAllAtOnceResult` gagne la variante `skipped`, affichée dans le dialogue de
  résultat et dans le toast de mise à jour.
- `GuideWithSteps` gagne le champ optionnel `local_edit` (ignoré par les fichiers
  écrits avant cette version, grâce à `#[serde(default)]`).
- `src/ipc/bindings.ts` est généré par Specta : il a été mis à jour à la main ici, il
  sera régénéré tel quel par `pnpm tauri dev` / `pnpm tauri build`.
- État du brouillon : `src/lib/guide_edit.ts` (Zustand) + tests
  `src/lib/guide_edit.test.ts` (15 tests).
- Entrée du mode édition : `src/routes/_app/guides/-$id/edit_mode_button.tsx`. Elle est
  rendue **hors** du menu « ⋯ », car ce menu n'existe qu'en dessous de 320 px de large
  (le reste du temps, Ganymède affiche les icônes séparées) : c'est ce qui rendait la
  fonctionnalité invisible dans une fenêtre de taille normale.

Vérifications effectuées sur cette livraison : `pnpm typecheck`, `pnpm lint`,
`pnpm test` (38 tests) et `pnpm format:check`.
