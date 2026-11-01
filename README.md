# NOVA AI — édition Premium

Interface web responsive pour NOVA AI, avec connexion Supabase, historique personnel, moteur IA compatible avec l'API OpenAI, dictée vocale, lecture à voix haute et pièces jointes privées (images, PDF et vidéos).

## Démarrage

```bash
npm install
npm start
```

Le site utilise les variables d'environnement configurées sur Render. Voir `GUIDE-MISE-A-JOUR.md`.

## Fonctions voix et médias

- Le microphone transforme la voix en texte avec la reconnaissance vocale du navigateur (Chrome/Edge sont généralement les plus compatibles).
- Les réponses peuvent être lues à voix haute avec la synthèse vocale du navigateur.
- Images, PDF et vidéos peuvent être ajoutés à une discussion et conservés dans le bucket privé Supabase `nova-media`.
- Les pièces jointes ne sont pas encore analysées par le modèle IA ; le site les conserve et les affiche dans l'historique.

## Important

- Exécuter `supabase-media-setup.sql` une seule fois pour créer le bucket privé et ses règles d'accès.
- Ne téléverse jamais un fichier `.env` contenant des secrets.
- Ne mets jamais la clé Supabase `service_role` dans le navigateur ou dans GitHub.
- Les valeurs `SUPABASE_URL` et `SUPABASE_ANON_KEY` côté Render doivent correspondre au projet Supabase.
- L'historique est protégé par les règles RLS du fichier `supabase-schema.sql`.


Analyse des médias : voir `GUIDE-MISE-A-JOUR.md` pour configurer `AI_VISION_MODEL` sur Render.
