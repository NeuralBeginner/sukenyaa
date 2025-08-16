# Changelog

Toutes les modifications notables de ce projet seront documentées dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/),
et ce projet adhère au [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Non publié]

### Ajouté
- 🎭 **Intégration TMDB automatique** - Métadonnées enrichies avec posters, synopsis et ratings
- 🔗 **Détection multi-extensions Stremio** - Compatibilité et symbiose automatique avec autres addons
- 🧠 **Cache intelligent avec priorité** - Système de fallback hiérarchique des métadonnées
- 🔄 **Cross-référencement automatique** - Navigation croisée fluide entre extensions
- 📊 **Diagnostics avancés d'intégrations** - Endpoints de monitoring et résolution de conflits
- 🔧 **Configuration plug & play** - Zéro configuration supplémentaire requise
- 🎯 **Endpoints API d'intégration** :
  - `/api/integrations` - Statut général des intégrations
  - `/api/integrations/tmdb/status` - Statut TMDB détaillé
  - `/api/integrations/extensions` - Extensions Stremio détectées
  - `/api/integrations/diagnostics` - Diagnostics complets
  - `/api/integrations/extensions/scan` - Refresh manuel des extensions
- 📚 **Documentation d'intégration** - Guide complet pour TMDB et extensions
- Intégration avec sukebei.nyaa.si pour contenus adultes (avec filtres appropriés)
- Support pour les playlists et séries multi-épisodes
- Configuration avancée des filtres de contenu
- Métriques Prometheus pour monitoring avancé
- Support des sous-titres intégrés
- API de recherche REST pour intégrations tierces

### Modifié
- Amélioration des performances de scraping
- Interface de configuration plus intuitive
- Messages d'erreur plus informatifs

### Corrigé
- Gestion des timeouts réseau
- Parsing des titres avec caractères spéciaux
- Cache Redis en mode cluster

## [1.0.0] - 2024-01-15

### Ajouté
- ✨ **Première version stable de SukeNyaa**
- 🔍 Recherche avancée avec filtres multiples (qualité, catégorie, langue, date, taille)
- 📱 Interface Stremio native avec manifeste conforme
- 🚀 Scraping optimisé de nyaa.si avec respect des limitations
- 🔒 Filtrage de contenu avec exclusion stricte des contenus inappropriés
- 📊 Système de monitoring complet avec métriques de santé
- 🐳 Support Docker avec image optimisée
- 🛡️ Sécurité renforcée avec rate limiting et validation
- ⚡ Cache en mémoire avec support Redis optionnel
- 🧪 Suite de tests complète (unitaires et intégration)
- 📚 Documentation complète avec guides d'installation et de contribution

### Fonctionnalités principales

#### Core Stremio
- Manifeste Stremio conforme avec métadonnées complètes
- Support des catalogues avec pagination
- Handlers pour catalog, meta et stream
- Types de contenu : anime, movies, series, other

#### Scraping et contenu
- Scraping intelligent de nyaa.si avec throttling automatique
- Parsing robuste des torrents avec extraction de métadonnées
- Détection automatique de qualité (4K, 1080p, 720p, 480p)
- Extraction de langue et sous-catégories
- Informations complètes : seeders, leechers, taille, date

#### Filtrage et sécurité
- Exclusion stricte des contenus impliquant des mineurs
- Filtres NSFW configurables
- Blocage par mots-clés et catégories
- Validation et sanitisation des données
- Respect du robots.txt et des ToS

#### Performance et fiabilité
- Cache multi-niveaux (mémoire + Redis optionnel)
- Rate limiting configurable
- Gestion des erreurs et retry automatique
- Timeouts et circuit breakers
- Logging structuré avec Pino

#### Monitoring et observabilité
- Endpoints de santé détaillés
- Métriques de performance en temps réel
- Support Prometheus pour monitoring
- Alertes de dégradation de service
- Tableaux de bord de cache et requêtes

#### Déploiement et configuration
- Image Docker optimisée multi-stage
- Configuration via variables d'environnement
- Support pour différents environnements
- Health checks automatiques
- Scripts npm complets

#### Développement
- TypeScript strict avec types complets
- ESLint et Prettier configurés
- Jest pour les tests avec couverture
- Hooks Git pour validation
- Hot reload en développement

### Configuration
- Variables d'environnement documentées
- Configuration par défaut sécurisée
- Support Redis pour mise à l'échelle
- Paramètres de throttling ajustables
- Filtres de contenu configurables

### Sécurité
- Headers de sécurité avec Helmet
- CORS configuré pour Stremio
- Rate limiting par IP
- Validation des entrées
- Logging sécurisé sans exposition de données

### API Endpoints
- `GET /` - Informations de l'addon
- `GET /manifest.json` - Manifeste Stremio
- `GET /api/health` - État de santé
- `GET /api/metrics` - Métriques détaillées
- `GET /api/info` - Informations API
- `POST /api/cache/clear` - Vider le cache

### Documentation
- README complet avec exemples
- Guide de contribution détaillé
- Documentation API
- Instructions Docker
- Examples de configuration

---

## Légende des types de changements

- ✨ **Ajouté** pour les nouvelles fonctionnalités
- 🔄 **Modifié** pour les changements de fonctionnalités existantes
- 🚨 **Déprécié** pour les fonctionnalités bientôt supprimées
- 🗑️ **Supprimé** pour les fonctionnalités supprimées
- 🔧 **Corrigé** pour les corrections de bugs
- 🔒 **Sécurité** pour les vulnérabilités corrigées