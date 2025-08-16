# SukeNyaa

SukeNyaa est un add-on non officiel pour Stremio qui agrège et organise le contenu public issu de nyaa.si et sukebei.nyaa.si. Il permet de rechercher, filtrer et parcourir des torrents d'anime, films, séries et autres médias, directement depuis l'interface Stremio.

## 🌟 Fonctionnalités

- 🔍 **Recherche avancée** avec filtres par qualité, catégorie, langue, date et taille
- 📱 **Interface Stremio native** - Intégration transparente avec l'application Stremio
- 🚀 **Performance optimisée** avec mise en cache et limitation de débit
- 🔒 **Filtrage de contenu** avec exclusion stricte des contenus inappropriés
- 📊 **Monitoring** avec métriques de santé et endpoints de surveillance
- 🐳 **Support Docker** pour un déploiement facile
- 🛡️ **Sécurisé** avec protection rate limiting avancée et validation des données
- ⚡ **Configuration automatique** - Détection de plateforme et optimisation zero-config
- 🎯 **Installation automatisée** - Scripts universels pour tous les environnements
- 🔧 **Auto-résolution d'erreurs** - Détection et correction automatique des problèmes courants
- 📚 **Documentation auto-générée** - Guides et aides créés automatiquement selon votre plateforme
- 🎭 **Intégration TMDB automatique** - Métadonnées enrichies avec posters, synopsis et ratings
- 🔗 **Compatibilité multi-extensions** - Détection et synchronisation automatique avec autres addons Stremio
- 🧠 **Mise en cache intelligente** - Priorisation des métadonnées avec fallback intelligent
- 🔄 **Cross-référencement** - Navigation croisée fluide entre extensions
- 📈 **Diagnostics avancés** - Logs explicites pour résoudre les conflits d'extensions
- 📱 **Compatibilité Android/Termux** - Surveillance d'activité et gestion des limitations mobiles
- ⏱️ **Gestion intelligente du rate limiting** - Protection contre les surcharges avec files d'attente
- 🔄 **Gestion d'erreurs robuste** - Prévention des plantages Stremio avec messages utilisateur clairs

## 🚀 Installation rapide

### 🎯 Installation Zéro-Configuration (Recommandée)

**SukeNyaa se configure automatiquement pour une expérience optimale sans aucune manipulation !**

```bash
# Installation universelle avec auto-configuration
chmod +x install.sh
./install.sh

# Démarrage avec configuration automatique
npm start
```

**C'est tout !** Tout est configuré automatiquement :
- ✅ Détection automatique de votre plateforme (Desktop, Android/Termux, Docker)
- ✅ Configuration optimale pour vos ressources système
- ✅ Toutes les sources activées : Anime All, Trusted, Movies, Other
- ✅ Filtres de qualité, langue et contenu optimisés
- ✅ Performance ajustée pour votre appareil
- ✅ Paramètres de sécurité et confidentialité par défaut

### 📱 Installation Android/Termux Automatique

```bash
# Installation complètement automatisée pour Termux
chmod +x start-android.sh
./start-android.sh
```

Le script installe automatiquement :
- Node.js et dépendances nécessaires
- Configuration réseau et permissions
- Paramètres optimisés pour mobile
- Messages d'installation clairs et rassurants

### Installation Manuelle (Optionnelle)

Si vous préférez l'installation manuelle :

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

## 🎭 Intégrations Automatiques

SukeNyaa offre une **compatibilité et symbiose automatique** avec les autres extensions Stremio, en particulier TMDB, pour une expérience transparente et enrichie.

### 🎬 Intégration TMDB (The Movie Database)

L'intégration TMDB enrichit automatiquement les métadonnées de vos contenus :

- **Posters haute qualité** - Remplace les placeholders par de vraies affiches
- **Synopsis détaillés** - Descriptions professionnelles des films/séries
- **Ratings et popularité** - Notes IMDB et popularité TMDB
- **Genres enrichis** - Classification précise des contenus
- **Informations de casting** - Acteurs, réalisateurs et équipes

#### Configuration TMDB

1. **Obtenez une clé API** : [https://www.themoviedb.org/settings/api](https://www.themoviedb.org/settings/api)
2. **Ajoutez à votre `.env`** :
   ```bash
   TMDB_API_KEY=votre_cle_api_ici
   TMDB_ENABLED=true
   ```
3. **Redémarrez SukeNyaa** - L'intégration est automatique !

### 🔗 Détection Multi-Extensions

SukeNyaa détecte automatiquement les autres extensions Stremio pour :

- **Cross-référencement** - Liens entre contenus d'extensions différentes
- **Navigation fluide** - Passages transparents entre addons
- **Synchronisation des métadonnées** - Partage d'informations entre extensions
- **Résolution de conflits** - Détection et gestion des doublons

#### Extensions Compatibles

- ✅ **Extensions TMDB** - Synchronisation automatique des métadonnées
- ✅ **Catalogues de films/séries** - Cross-référencement intelligent
- ✅ **Addons de streaming** - Navigation croisée fluide
- ✅ **Extensions de métadonnées** - Partage d'informations enrichies

### 🧠 Cache Intelligent

Le système de cache utilise une **priorisation des métadonnées** :

1. **Données TMDB** (priorité maximale) - Informations officielles
2. **Métadonnées d'extensions** - Données d'autres addons Stremio
3. **Fallback SukeNyaa** - Génération automatique de placeholders

### 📊 Diagnostics et Monitoring

Surveillez vos intégrations avec des endpoints dédiés :

```bash
# Statut général des intégrations
curl http://localhost:3000/api/integrations

# Statut TMDB spécifique
curl http://localhost:3000/api/integrations/tmdb/status

# Extensions détectées
curl http://localhost:3000/api/integrations/extensions

# Diagnostics complets
curl http://localhost:3000/api/integrations/diagnostics

# Refresh manuel des extensions
curl -X POST http://localhost:3000/api/integrations/extensions/scan
```

### 🔧 Configuration Avancée

Variables d'environnement pour les intégrations :

| Variable | Description | Défaut |
|----------|-------------|---------|
| `TMDB_API_KEY` | 🔑 Clé API TMDB (requis pour l'intégration) | - |
| `TMDB_ENABLED` | Activer l'intégration TMDB | `true` |
| `STREMIO_INTEGRATION_ENABLED` | Détection automatique d'extensions | `true` |
| `STREMIO_CROSS_REFERENCE` | Cross-référencement entre extensions | `true` |
| `STREMIO_KNOWN_EXTENSIONS` | URLs d'extensions connues (séparées par des virgules) | - |

### 🚨 Résolution de Problèmes

**TMDB ne fonctionne pas ?**
- Vérifiez votre clé API TMDB
- Consultez `http://localhost:3000/api/integrations/tmdb/status`
- Vérifiez la connectivité réseau

**Aucune extension détectée ?**
- Vérifiez que d'autres addons Stremio sont actifs
- Consultez `http://localhost:3000/api/integrations/extensions`
- Ajoutez des URLs dans `STREMIO_KNOWN_EXTENSIONS`

**Conflits d'extensions ?**
- Consultez `http://localhost:3000/api/integrations/diagnostics`
- Désactivez les fonctionnalités en doublon
- Vérifiez les logs pour plus de détails

**Limites de débit ?**
- Consultez `http://localhost:3000/api/rate-limit/status`
- Attendez la réinitialisation automatique (2-5 minutes)
- Utilisez des termes de recherche plus spécifiques
- Vérifiez la configuration du cache

**Problèmes Android/Termux ?**
- Consultez `http://localhost:3000/api/activity/status`
- Gardez Termux au premier plan pendant l'utilisation
- Configurez `termux-wake-lock` pour éviter la mise en pause
- Consultez [INSTALL_ANDROID.md](INSTALL_ANDROID.md) pour plus de détails

### 🔧 Endpoints de diagnostic

**Surveillance en temps réel :**
- `/api/health` - État global du système
- `/api/rate-limit/status` - Statut des limitations de débit
- `/api/activity/status` - Activité du serveur (Android/Termux)
- `/api/integrations` - État des intégrations TMDB et extensions

**Actions de maintenance :**
- `POST /api/rate-limit/clear` - Effacer manuellement les limites de débit
- `POST /api/cache/clear` - Vider le cache
- `POST /api/integrations/cache/clear` - Vider le cache des intégrations

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

### Installation Automatique (Zéro Configuration)

1. **Démarrez SukeNyaa** avec auto-configuration :
   ```bash
   ./install.sh  # Installation universelle
   # OU
   ./start-android.sh  # Pour Android/Termux
   ```

2. **Ouvrez Stremio** sur votre appareil

3. **Allez dans Add-ons** > **Community Add-ons**

4. **Collez l'URL** : `http://localhost:3000/manifest.json`

5. **Cliquez sur Install**

**🎉 C'est terminé !** Tout est pré-configuré pour une expérience optimale.

### Pages Utiles (Auto-Générées)

- **Page d'accueil** : `http://localhost:3000/welcome`
- **Guide de démarrage** : `QUICK_START.md` (créé automatiquement)
- **URLs d'installation** : `STREMIO_INSTALL.md` (créé automatiquement)
- **Dépannage** : `TROUBLESHOOTING_[PLATFORM].md` (créé automatiquement)

### Installation Standard (Manuelle)

Si vous préférez configurer manuellement :

1. Démarrez le serveur SukeNyaa
2. Ouvrez Stremio
3. Allez dans **Add-ons** > **Community Add-ons**
4. Collez l'URL : `http://localhost:3000/manifest.json`
5. Cliquez sur **Install**

### 📱 Installation Android avec Termux

Pour une installation sur smartphone Android avec Termux, consultez le guide détaillé :

**[📋 Guide d'installation Android](./INSTALL_ANDROID.md)**

Le serveur est optimisé pour fonctionner sur localhost (127.0.0.1) et est compatible avec Stremio Android.

**URL d'installation :** `http://localhost:3000/manifest.json`

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

## 📱 Android/Termux

### Installation rapide

Pour installer sur Android avec Termux, consultez le guide détaillé : [INSTALL_ANDROID.md](INSTALL_ANDROID.md)

```bash
# Installation rapide sur Termux
pkg update && pkg install nodejs git
git clone https://github.com/NeuralBeginner/sukenyaa.git
cd sukenyaa && npm install && npm run build
npm start
```

### Scripts de debug

```bash
# Test rapide du scraper
npm run test:scraper

# Debug de connectivité réseau
npm run debug:scraper

# Tests complets
npm test
```

### Debugging sur Android

**Problèmes courants :**

1. **Catalogue vide** : Vérifiez la connectivité avec `npm run debug:scraper`
2. **Addon non détecté** : Utilisez l'URL exacte `http://localhost:3000/manifest.json`
3. **Performance lente** : Surveillez les logs pour `responseTime` > 2000ms

**Logs à surveiller :**
```bash
# Logs de succès
{"msg":"Catalog request completed successfully","itemCount":50}

# Logs d'erreur
{"msg":"Catalog request failed","error":"..."}
{"msg":"Blocked torrent due to prohibited keywords"}
```

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