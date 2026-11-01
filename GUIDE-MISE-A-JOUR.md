# NOVA AI Plus — Guide de mise à jour

Cette version ajoute les comptes, les profils, l'historique synchronisé, le thème clair/sombre,
la suppression des discussions, la copie des réponses et l'arrêt de la requête côté navigateur.

## Important avant de commencer

- Fais une copie de ton ancien dossier.
- Ne téléverse jamais `.env` ou une clé Groq sur GitHub.
- N'utilise jamais la clé `service_role` de Supabase dans le navigateur ou dans le code public.
- La clé Supabase `anon` / `publishable` est prévue pour le navigateur, mais la sécurité dépend des règles RLS du SQL ci-dessous.
- Pour les comptes et les services en ligne, fais-toi accompagner par un parent/responsable.
- Les offres gratuites ont des quotas et peuvent changer.

## 1. Créer le projet Supabase

1. Ouvre https://supabase.com/ et crée un projet avec l'aide d'un parent/responsable.
2. Dans le tableau de bord, ouvre **Project Settings > API** (ou **Data API / API Keys** selon l'interface).
3. Copie l'URL du projet.
4. Copie la clé **anon / publishable**. Ne copie PAS `service_role` ou `secret`.
5. Dans **SQL Editor**, ouvre une nouvelle requête.
6. Copie tout le contenu de `supabase-schema.sql`, colle-le et clique sur **Run**.
7. Dans **Authentication > URL Configuration**, configure l'URL de ton site Render comme Site URL.
8. Pour simplifier le premier test, vérifie les paramètres de confirmation d'e-mail. Si la confirmation est activée, l'utilisateur doit cliquer sur le lien reçu avant de se connecter. Garde une configuration de confirmation adaptée à la sécurité de ton compte.

## 2. Mettre les variables dans Render

Dans Render > ton service NOVA AI > Environment, ajoute ou vérifie :

- `AI_API_URL` = `https://api.groq.com/openai/v1/chat/completions`
- `AI_API_KEY` = ta clé Groq privée (ne la partage jamais)
- `AI_MODEL` = `openai/gpt-oss-20b` (vérifie dans Groq Console que ce modèle est disponible pour ton compte)
- `SUPABASE_URL` = URL de ton projet Supabase
- `SUPABASE_ANON_KEY` = clé anon / publishable de Supabase

Ne mets pas la clé `service_role` dans Render pour cette version et ne publie aucune clé privée dans GitHub.
Le serveur utilise l'URL complète du point d'accès Groq, y compris `/chat/completions`.

## 3. Mettre à jour GitHub

1. Sur ton PC, garde une copie de l'ancien dossier.
2. Remplace les anciens fichiers par ceux de cette version.
3. Dans GitHub, ouvre ton dépôt `nova-ai`.
4. Pour chaque fichier modifié, utilise **Add file > Upload files** ou téléverse les fichiers du nouveau dossier en écrasant les anciens.
5. N'envoie pas `.env`.
6. Clique sur **Commit changes**.

Render détecte normalement le nouveau commit et redéploie le site.

## 4. Tester

1. Ouvre l'adresse Render.
2. Crée un compte avec une adresse e-mail et un mot de passe d'au moins 8 caractères.
3. Si Supabase demande une confirmation, ouvre le mail de confirmation.
4. Connecte-toi, crée une discussion et envoie « Bonjour ».
5. Vérifie que la discussion reste visible après actualisation.

## 5. Ce qui est enregistré

Les discussions sont stockées dans la table `conversations`, avec des règles Row Level Security qui limitent l'accès à chaque compte. Chaque utilisateur ne peut lire, modifier et supprimer que ses propres discussions via l'interface.
Le serveur vérifie le jeton de session Supabase avant d'autoriser l'appel au modèle IA.

## Limites à connaître

- L'arrêt du bouton stop annule l'attente dans le navigateur ; le fournisseur peut déjà avoir commencé à traiter la demande.
- Les quotas gratuits de Supabase, Render et Groq sont limités et peuvent évoluer.
- Ce projet est une base personnelle/prototype, pas un service prêt pour des milliers d'utilisateurs. Avant une ouverture publique, ajoute protection anti-abus, limitation de débit, politique de confidentialité, règles de modération et surveillance des quotas.
- Ne collecte pas d'informations sensibles auprès des utilisateurs.
