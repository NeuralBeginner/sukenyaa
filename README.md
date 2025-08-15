# SukeNyaa

SukeNyaa est un add-on non officiel pour Stremio qui agrège et organise le contenu public issu de nyaa.si et sukebei.nyaa.si. Il permet de rechercher, filtrer et parcourir des torrents d'anime, films, séries et autres médias, directement depuis l'interface Stremio.

## 🌟 Fonctionnalités

- 🔍 **Recherche avancée** avec filtres par qualité, catégorie, langue, date et taille
- 📱 **Interface Stremio native** - Intégration transparente avec l'application Stremio
- 🚀 **Performance optimisée** avec mise en cache et limitation de débit
- 🔒 **Filtrage de contenu** avec exclusion stricte des contenus inappropriés
- 📊 **Monitoring** avec métriques de santé et endpoints de surveillance
- 🐳 **Support Docker** pour un déploiement facile
- 🛡️ **Sécurisé** avec protection rate limiting et validation des données

## 🚀 Installation rapide

### Docker (Recommandé)

```bash
docker pull ghcr.io/mehdidlapgl/sukenyaa:latest
docker run -p 3000:3000 -e NODE_ENV=production ghcr.io/mehdidlapgl/sukenyaa:latest
```

### Installation manuelle

```bash
git clone https://github.com/MehdiDlaPgl/sukenyaa.git
cd sukenyaa
npm install
npm run build
npm start
```

## ⚙️ Configuration

Copiez le fichier `.env.example` vers `.env` et ajustez les paramètres selon vos besoins :

```bash
cp .env.example .env
```

### Variables d'environnement principales

| Variable | Description | Défaut |
|----------|-------------|--------|
| `PORT` | Port du serveur | `3000` |
| `NODE_ENV` | Environnement d'exécution | `development` |
| `CACHE_TTL` | Durée de cache (secondes) | `3600` |
| `REDIS_URL` | URL Redis optionnelle | - |
| `ENABLE_NSFW_FILTER` | Filtre de contenu NSFW | `true` |
| `STRICT_MINOR_CONTENT_EXCLUSION` | Exclusion stricte contenu mineur | `true` |

## 🔧 Développement

### Prérequis

- Node.js 16+
- npm ou yarn
- Redis (optionnel)

### Scripts disponibles

```bash
# Développement avec rechargement automatique
npm run dev

# Compilation TypeScript
npm run build

# Démarrage en production
npm start

# Tests
npm test
npm run test:watch
npm run test:coverage

# Linting et formatage
npm run lint
npm run lint:fix
npm run format
```

### Architecture du projet

```
src/
├── config/          # Configuration et manifeste
├── services/        # Services métier (scraping, cache, etc.)
├── routes/          # Routes API Express
├── middleware/      # Middlewares custom
├── utils/           # Utilitaires (logger, filtres, etc.)
├── types/           # Définitions TypeScript
└── index.ts         # Point d'entrée

tests/
├── unit/           # Tests unitaires
└── integration/    # Tests d'intégration
```

## 🔌 Installation dans Stremio

1. Démarrez le serveur SukeNyaa
2. Ouvrez Stremio
3. Allez dans **Add-ons** > **Community Add-ons**
4. Collez l'URL : `http://localhost:3000/manifest.json`
5. Cliquez sur **Install**

## 🛡️ Sécurité et conformité

- ✅ Exclusion stricte des contenus impliquant des mineurs
- ✅ Filtrage NSFW configurable
- ✅ Respect du robots.txt et des conditions d'utilisation
- ✅ Rate limiting pour éviter la surcharge des serveurs
- ✅ Validation et sanitisation des données
- ✅ Logging sécurisé sans exposition de données sensibles

## 📊 Monitoring

### Endpoints de santé

- `GET /ping` - Test de vie simple
- `GET /api/health` - État détaillé des services
- `GET /api/metrics` - Métriques complètes
- `GET /api/metrics/prometheus` - Format Prometheus

### Métriques surveillées

- Nombre de requêtes
- Taux d'erreur
- Temps de réponse moyen
- Taux de succès du cache
- État des services externes

## 🤝 Contribution

Les contributions sont les bienvenues ! Consultez [CONTRIBUTING.md](CONTRIBUTING.md) pour les guidelines.

### Process de contribution

1. Fork le projet
2. Créez une branche feature (`git checkout -b feature/amazing-feature`)
3. Committez vos changements (`git commit -m 'Add amazing feature'`)
4. Poussez vers la branche (`git push origin feature/amazing-feature`)
5. Ouvrez une Pull Request

## 📝 Changelog

Voir [CHANGELOG.md](CHANGELOG.md) pour l'historique des versions.

## 📄 Licence

Ce projet est sous licence MIT. Voir [LICENSE](LICENSE) pour plus de détails.

## ⚠️ Avertissement

Cet add-on est **non officiel** et n'est pas affilié à nyaa.si ou Stremio. Il est destiné uniquement à un usage éducationnel et de recherche. Les utilisateurs sont responsables du respect des lois locales concernant le téléchargement de contenu.

## 🙏 Remerciements

- [Stremio Addon SDK](https://github.com/Stremio/stremio-addon-sdk) pour l'excellente API
- [nyaa.si](https://nyaa.si) pour le contenu public
- La communauté open source pour les outils utilisés

---

**Prompt utilisé pour la génération** : Développer un add‑on Stremio en Node.js/TypeScript utilisant le Stremio Addon SDK pour alimenter des catalogues, métadonnées et streams en scrapant nyaa.si et, en option, sukebei.nyaa.si. L'add‑on doit proposer la recherche, des filtres avancés (qualité, sous‑catégorie, langue, date, taille), le tri, la pagination, et exposer des magnets/torrents avec informations de qualité (1080p/720p), seeders, taille, langue. Le code doit être conforme, fiable, performant et sécurisé, incluant gestion NSFW, exclusion stricte des contenus mineurs, respect robots.txt/ToS, throttling, cache, logs, métriques, endpoints santé, manifest conforme, Dockerfile, tests unitaires et intégration, README détaillé, structure de projet claire, configuration .env.example et prise en charge Redis en option.