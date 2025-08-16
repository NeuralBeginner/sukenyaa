# 📱 Installation Android avec Termux

Ce guide explique comment installer et utiliser l'addon SukeNyaa sur Android avec Termux et l'application Stremio.

## 📋 Prérequis

1. **Termux** - Terminal Linux pour Android
   - Télécharger depuis [F-Droid](https://f-droid.org/packages/com.termux/) (recommandé)
   - Ou depuis [GitHub Releases](https://github.com/termux/termux-app/releases)

2. **Stremio Android** - Application de streaming
   - Télécharger depuis [Google Play Store](https://play.google.com/store/apps/details?id=com.stremio.one)
   - Ou depuis [le site officiel](https://www.stremio.com/downloads)

## 🚀 Installation Rapide

### Étape 1: Configurer Termux

Ouvrez Termux et exécutez les commandes suivantes :

```bash
# Mettre à jour les paquets
pkg update && pkg upgrade

# Installer Node.js et Git
pkg install nodejs git

# Vérifier l'installation
node --version
npm --version
```

### Étape 2: Cloner et installer SukeNyaa

```bash
# Cloner le dépôt
git clone https://github.com/NeuralBeginner/sukenyaa.git
cd sukenyaa

# Installer les dépendances
npm install

# Construire le projet
npm run build
```

### Étape 3: Démarrer le serveur

```bash
# Option 1: Utiliser le script automatique (recommandé)
./start-android.sh

# Option 2: Démarrage manuel
npm start
```

Le serveur démarrera sur `http://localhost:3000`

### Étape 4: Installer l'addon dans Stremio

1. Ouvrez l'application **Stremio** sur votre Android
2. Allez dans **Add-ons** → **Community Add-ons**
3. Dans le champ de saisie, entrez : `http://localhost:3000/manifest.json`
4. Appuyez sur **Install**
5. L'addon devrait apparaître dans votre liste d'addons installés

## 🧪 Validation de l'installation

## 🧪 Validation de l'installation

### Test via navigateur

Pendant que le serveur fonctionne, ouvrez votre navigateur Android et allez sur :
- `http://localhost:3000/test` - Page de test interactive
- `http://localhost:3000/manifest.json` - Manifeste de l'addon

### Test via Termux

```bash
# Tester le serveur
curl http://localhost:3000/

# Tester le manifeste
curl http://localhost:3000/manifest.json

# Tester un catalogue
curl "http://localhost:3000/catalog/anime/nyaa-anime-all.json"

# Tester la recherche
curl "http://localhost:3000/catalog/anime/nyaa-anime-all.json?search=Attack+on+Titan"
```

### Scripts de test intégrés

```bash
# Test rapide du scraper
npm run test:scraper

# Test de compatibilité Android complet
npm run test:android

# Debug détaillé de la connectivité
npm run debug:scraper
```

### Nouveaux endpoints de monitoring mobile

SukeNyaa inclut maintenant des endpoints spécialisés pour le monitoring mobile :

```bash
# Santé générale du service
curl http://localhost:3000/api/health

# Diagnostic spécifique mobile/Android
curl http://localhost:3000/api/mobile-health

# Test de résilience réseau
curl http://localhost:3000/api/network-test

# Page de configuration interactive
# Ouvrir dans le navigateur : http://localhost:3000/configure
```

### Configuration personnalisée

L'addon dispose maintenant d'une **interface de configuration complète** accessible via :
- **Interface web** : `http://localhost:3000/configure`
- **API REST** : `http://localhost:3000/configure/api`

**Fonctionnalités de configuration** :
- 🔒 **Filtres de contenu** : NSFW, uploaders de confiance, catégories bloquées
- 🔍 **Préférences de recherche** : Tri par défaut, nombre de résultats, ordre
- 🎥 **Qualité vidéo** : Priorités 4K/1080p/720p/480p
- 🌐 **Langues préférées** : Anglais, Japonais, Chinois, Coréen
- ⚙️ **Options avancées** : Logs détaillés, timeout de cache

# Tests unitaires complets
npm test
```

## 🔧 Résolution de problèmes

## 🔧 Résolution de problèmes

### Le serveur ne démarre pas

```bash
# Vérifier les erreurs
npm run build
npm start

# Vérifier les ports utilisés
netstat -tlnp | grep 3000
```

### Stremio ne peut pas installer l'addon

1. Vérifiez que le serveur fonctionne : `curl http://localhost:3000/manifest.json`
2. Assurez-vous d'utiliser l'URL exacte : `http://localhost:3000/manifest.json`
3. Redémarrez Stremio si nécessaire
4. Vérifiez les logs du serveur dans Termux

### Problèmes de réseau

```bash
# Vérifier la configuration réseau
ip addr show
netstat -rn

# Tester la connectivité locale
ping 127.0.0.1

# Tester la connectivité à nyaa.si
curl -I https://nyaa.si/
```

### Le catalogue est vide ou ne charge pas

```bash
# Test direct du scraper
npm run test:scraper

# Test de compatibilité Android complet 
npm run test:android

# Diagnostic mobile/Android spécialisé
curl "http://localhost:3000/api/mobile-health"

# Vérifier les logs de requête
curl "http://localhost:3000/catalog/anime/nyaa-anime-all.json"
# Vérifier les logs dans la console Termux

# Test avec recherche spécifique
curl "http://localhost:3000/catalog/anime/nyaa-anime-all.json?search=Naruto"
```

### Performances lentes ou problèmes de connectivité

```bash
# Test de résilience réseau
curl "http://localhost:3000/api/network-test"

# Diagnostic de performance mobile
curl "http://localhost:3000/api/mobile-health" | jq '.performance'

# Statistiques détaillées
curl "http://localhost:3000/api/metrics"
```

### Configuration et préférences

```bash
# Voir la configuration actuelle
curl "http://localhost:3000/configure/api"

# Activer les logs détaillés pour le debug
curl -X POST "http://localhost:3000/configure/api" \
  -H "Content-Type: application/json" \
  -d '{"enableDetailedLogging": true}'

# Réinitialiser la configuration
curl -X POST "http://localhost:3000/configure/reset"
```

### Erreurs de parsing ou contenu manquant

```bash
# Debug détaillé du scraper
npm run debug:scraper

# Test de compatibilité Android avec diagnostic
npm run test:android

# Vérifier la structure HTML retournée
curl -s "https://nyaa.si/?c=1_0" | head -n 100

# Test des filtres de contenu
curl "http://localhost:3000/catalog/anime/nyaa-anime-trusted.json"
```

### Performance lente

```bash
# Diagnostic de performance mobile complet
curl "http://localhost:3000/api/mobile-health"

# Test de résilience réseau
curl "http://localhost:3000/api/network-test"

# Vérifier le cache et métriques
curl "http://localhost:3000/api/metrics"

# Vérifier les métriques de santé générale
curl "http://localhost:3000/api/health"

# Test de ping réseau
time curl -s "http://localhost:3000/manifest.json" > /dev/null
```

## 📊 Surveillance

## 📊 Surveillance

### Voir les logs en temps réel

Le serveur affiche les logs en temps réel. Pour voir l'activité :

```bash
# Dans Termux, les logs s'affichent automatiquement
# Rechercher les requêtes Stremio dans les logs
```

### Analyse des logs

**Logs normaux :**
```json
{"level":30,"time":...,"msg":"Processing catalog request","args":{"type":"anime","id":"nyaa-anime-all"}}
{"level":30,"time":...,"msg":"Search completed, converting to metas","searchResultCount":50}
{"level":30,"time":...,"msg":"Catalog request completed successfully","itemCount":50}
```

**Logs d'erreur à surveiller :**
```json
{"level":50,"time":...,"msg":"Catalog request failed","error":"..."}
{"level":40,"time":...,"msg":"Blocked torrent due to prohibited keywords"}
{"level":40,"time":...,"msg":"Failed to parse torrent row"}
```

**Indicateurs de performance :**
- `responseTime` : doit être < 2000ms
- `searchResultCount` : doit être > 0 pour un catalogue fonctionnel
- `metasGenerated` : doit correspondre à `searchResultCount`

### Endpoints de monitoring

- `http://localhost:3000/api/health` - État de santé
- `http://localhost:3000/api/metrics` - Métriques détaillées
- `http://localhost:3000/` - Informations générales

## 🛠️ Configuration avancée

### Variables d'environnement

Créez un fichier `.env` pour personnaliser la configuration :

```bash
# Dans le dossier sukenyaa
cp .env.example .env
nano .env
```

Variables importantes pour Android :
```env
PORT=3000
NODE_ENV=production
CORS_ORIGIN=*
CACHE_TTL=3600
LOG_LEVEL=info
```

### Démarrage automatique

Pour que l'addon démarre automatiquement quand vous ouvrez Termux :

```bash
# Ajouter au profil Termux
echo 'cd ~/sukenyaa && npm start' >> ~/.bashrc
```

## 💡 Conseils d'utilisation

1. **Gardez Termux ouvert** : Le serveur s'arrête si vous fermez Termux
2. **Utilisez un gestionnaire de sessions** : `screen` ou `tmux` pour faire tourner le serveur en arrière-plan
3. **Économisez la batterie** : Fermez l'addon quand vous ne l'utilisez pas
4. **Mises à jour** : Exécutez `git pull && npm install && npm run build` pour mettre à jour

## 🆘 Support

Si vous rencontrez des problèmes :

1. Vérifiez la [documentation principale](../README.md)
2. Consultez les [logs d'erreur](#surveillance)
3. Ouvrez une [issue GitHub](https://github.com/NeuralBeginner/sukenyaa/issues) avec :
   - Version d'Android
   - Version de Termux
   - Version de Node.js (`node --version`)
   - Logs d'erreur complets

## ✅ Statut de compatibilité

- ✅ Android 7+ avec Termux
- ✅ Stremio Android 1.5+
- ✅ Node.js 16+
- ✅ Connexions localhost uniquement (sécurisé)
- ✅ CORS configuré pour Stremio
- ✅ Endpoints Stremio SDK conformes