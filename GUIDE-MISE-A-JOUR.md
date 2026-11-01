# Mettre à jour NOVA AI PREMIUM — voix et médias

Cette version conserve l'interface premium, les comptes Supabase, l'historique et le chat. Elle ajoute :
- la dictée vocale par microphone (Chrome et Edge sont les plus compatibles) ;
- la lecture à voix haute des réponses ;
- l'ajout d'images, de PDF et de vidéos aux discussions ;
- le stockage privé des pièces jointes dans Supabase Storage, avec accès limité au compte connecté.

**Limite importante :** les fichiers joints sont enregistrés et visibles dans la discussion, mais leur contenu n'est pas encore analysé par le modèle IA. La dictée transforme la voix en texte ; ce n'est pas encore une conversation audio en direct.

## 1. Sauvegarde
Garde ta copie de secours actuelle sur ton ordinateur.

## 2. Activer le stockage des médias dans Supabase
1. Ouvre ton projet Supabase.
2. Va dans **SQL Editor** puis crée une nouvelle requête.
3. Ouvre le fichier `supabase-media-setup.sql` dans ce dossier.
4. Copie tout son contenu et colle-le dans la nouvelle requête SQL.
5. Vérifie que le rôle d'exécution est `postgres`, puis clique sur **Run**.
6. Le résultat doit indiquer `Success`.

Ce script crée un espace de stockage privé appelé `nova-media`. Chaque compte ne peut envoyer, voir et supprimer que les fichiers rangés dans son propre dossier utilisateur. Limite : 20 Mo par fichier et 4 fichiers par message.

**Ne relance pas `supabase-schema.sql`** : tes tables de conversations existent déjà.

## 3. Remplacer les fichiers sur GitHub
1. Ouvre ton dépôt GitHub `nova-ai`.
2. Clique sur **Add file → Upload files**.
3. Dépose le contenu du dossier `nova-ai-premium` à la racine du dépôt, en gardant `public/` comme dossier.
4. Inclue `supabase-media-setup.sql` dans le dépôt si tu veux garder le script avec le projet.
5. Ne téléverse jamais un fichier `.env` qui contient des secrets.
6. Clique sur **Commit changes**.

## 4. Render
Render doit redéployer automatiquement. Attends **Live**.

Ne change pas tes variables existantes :
- `AI_API_URL`
- `AI_API_KEY`
- `AI_MODEL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

Aucune nouvelle variable Render n'est nécessaire.

## 5. Tester
1. Ouvre NOVA AI et connecte-toi.
2. Teste le microphone et autorise l'accès au micro dans le navigateur.
3. Envoie un message et utilise **Écouter** pour lire la réponse.
4. Joins une image, un PDF ou une vidéo et envoie le message.
5. Actualise la page et vérifie que la pièce jointe reste visible dans la discussion.

La dictée dépend du navigateur et de l'autorisation du microphone. Les fichiers sont stockés dans Supabase Storage et peuvent utiliser ton quota de stockage. Les pièces jointes ne sont pas encore analysées par l'IA.


## Activation de l'analyse réelle des médias

Dans Render > ton service NOVA > Environment, ajoute ou modifie :
- `AI_VISION_MODEL` = `qwen/qwen3.8-27b`

Conserve `AI_API_URL`, `AI_API_KEY`, `AI_MODEL`, `SUPABASE_URL` et `SUPABASE_ANON_KEY`.
Le modèle vision utilise le même endpoint et la même clé Groq. Après sauvegarde, Render redéploie le site.

Fonctions de cette version :
- Images : envoi au modèle vision pour analyse.
- PDF : extraction du texte dans le navigateur, puis transmission au modèle. Les PDF scannés sans couche texte ne seront pas lus par OCR.
- Vidéos : extraction de trois images d'aperçu et analyse de ces images. Ce n'est pas une compréhension complète de la vidéo ni de son audio.
- Dictée micro et lecture vocale : inchangées.

Limites : 4 pièces jointes max, 20 Mo par fichier au stockage, jusqu'à 3 images transmises au modèle par message. Ne joins pas de documents personnels ou confidentiels.
