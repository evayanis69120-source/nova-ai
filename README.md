# NOVA AI Plus

Interface de chat IA en français avec authentification Supabase, conversations synchronisées et backend Node/Express.

## Configuration rapide
Consulte `GUIDE-MISE-A-JOUR.md` avant le déploiement. Il faut configurer Supabase et les variables d'environnement Render.

## Développement local
- Node.js 18+
- `npm install`
- définir les variables du fichier `.env` (copier `.env.example`, puis remplacer les exemples)
- `npm start`
- ouvrir http://localhost:3000

Ne jamais publier `.env`, une clé Groq privée ou une clé Supabase `service_role`.
