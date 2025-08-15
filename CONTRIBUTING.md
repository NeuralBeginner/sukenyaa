# Guide de contribution

Merci de votre intérêt pour contribuer à SukeNyaa ! Ce guide vous explique comment participer au développement de ce projet.

## 🔧 Configuration de l'environnement de développement

### Prérequis

- Node.js 16.0+ et npm
- Git
- Un éditeur de code (VS Code recommandé)
- Redis (optionnel pour les tests)

### Installation

1. Forkez le dépôt sur GitHub
2. Clonez votre fork localement :
   ```bash
   git clone https://github.com/[votre-username]/sukenyaa.git
   cd sukenyaa
   ```
3. Installez les dépendances :
   ```bash
   npm install
   ```
4. Copiez le fichier de configuration :
   ```bash
   cp .env.example .env
   ```
5. Lancez les tests pour vérifier l'installation :
   ```bash
   npm test
   ```

## 🔀 Workflow de contribution

### 1. Créer une branche

Créez toujours une nouvelle branche pour votre contribution :

```bash
git checkout -b feature/nom-de-votre-feature
# ou
git checkout -b fix/description-du-bug
```

### 2. Conventions de nommage

- **Features** : `feature/description-courte`
- **Bug fixes** : `fix/description-du-probleme`
- **Documentation** : `docs/sujet-modifie`
- **Refactoring** : `refactor/zone-refactorisee`

### 3. Développement

- Écrivez du code TypeScript strict
- Suivez les conventions de style du projet
- Ajoutez des tests pour toute nouvelle fonctionnalité
- Documentez vos fonctions et classes importantes

### 4. Tests et validation

Avant de proposer vos changements :

```bash
# Tests
npm test
npm run test:coverage

# Linting
npm run lint
npm run format:check

# Build
npm run build
```

### 5. Commit

Utilisez des messages de commit descriptifs :

```bash
git add .
git commit -m "feat: ajoute filtrage par langue dans la recherche"
```

#### Conventions de commit

- `feat:` nouvelle fonctionnalité
- `fix:` correction de bug
- `docs:` modification de documentation
- `style:` formatage du code
- `refactor:` refactorisation sans changement de fonctionnalité
- `test:` ajout ou modification de tests
- `chore:` maintenance générale

### 6. Pull Request

1. Poussez votre branche :
   ```bash
   git push origin feature/nom-de-votre-feature
   ```

2. Créez une Pull Request sur GitHub avec :
   - Un titre descriptif
   - Une description détaillée des changements
   - Des captures d'écran si applicable
   - La mention de toute issue liée

## 📝 Standards de code

### TypeScript

- Utilisez le strict mode activé
- Définissez des types explicites pour les paramètres et retours de fonction
- Évitez `any`, utilisez des types appropriés
- Documentez les interfaces complexes

### Style

- Indentation : 2 espaces
- Point-virgules obligatoires
- Guillemets simples pour les chaînes
- Longueur de ligne : 100 caractères maximum

### Tests

- Tests unitaires pour la logique métier
- Tests d'intégration pour les endpoints API
- Couverture de code minimum : 80%
- Moquez les dépendances externes

### Logging

- Utilisez le logger Pino configuré
- Niveaux appropriés : `debug`, `info`, `warn`, `error`, `fatal`
- Pas de `console.log` en production
- Loggez les erreurs avec le contexte

## 🚨 Sécurité et conformité

### Content filtering

- Tout nouveau filtre doit être testé rigoureusement
- Respectez la politique d'exclusion stricte des contenus mineurs
- Ajoutez des tests pour valider les filtres

### Rate limiting

- Respectez les délais de scraping configurés
- N'augmentez jamais la fréquence sans justification
- Testez l'impact sur les services externes

### Données sensibles

- Jamais de clés API ou credentials en dur
- Utilisez les variables d'environnement
- Sanitisez les logs

## 🧪 Tests

### Organisation

```
tests/
├── unit/              # Tests unitaires
│   ├── services/      # Tests des services
│   └── utils/         # Tests des utilitaires
└── integration/       # Tests d'intégration
    └── api/           # Tests des endpoints
```

### Exemples

```typescript
// Test unitaire
describe('ContentFilter', () => {
  test('should block prohibited content', () => {
    const torrent = createMockTorrent({ title: 'prohibited content' });
    expect(ContentFilter.isAllowed(torrent)).toBe(false);
  });
});

// Test d'intégration
describe('API /health', () => {
  test('should return 200 for healthy service', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
  });
});
```

## 📋 Issues et bugs

### Signaler un bug

1. Vérifiez qu'il n'existe pas déjà une issue similaire
2. Utilisez le template d'issue approprié
3. Incluez :
   - Version de Node.js
   - Système d'exploitation
   - Étapes pour reproduire
   - Logs d'erreur
   - Comportement attendu vs observé

### Proposer une fonctionnalité

1. Ouvrez une issue de type "Feature Request"
2. Décrivez clairement le besoin
3. Proposez une solution
4. Discutez de l'implémentation

## 🔍 Review process

### Pour les contributeurs

- Soyez réceptif aux commentaires
- Répondez rapidement aux demandes de modification
- Testez vos changements sur différents environnements

### Pour les reviewers

- Soyez constructif et respectueux
- Focalisez sur le code, pas la personne
- Validez la sécurité et la performance
- Vérifiez la couverture de tests

## 📚 Documentation

### Code

- Commentaires JSDoc pour les fonctions publiques
- README mis à jour si nouveaux endpoints/features
- Types TypeScript documentés

### API

- Endpoints documentés avec exemples
- Codes d'erreur expliqués
- Paramètres et réponses détaillés

## 🚀 Déploiement

Les maintainers s'occupent du déploiement :

1. Merge de la PR
2. Tests automatiques
3. Build et déploiement
4. Tag de version si nécessaire

## 💬 Communication

- **Issues GitHub** : bugs et demandes de fonctionnalités
- **Pull Requests** : discussions sur le code
- **Discussions** : questions générales et idées

## 📄 Licence

En contribuant, vous acceptez que vos contributions soient sous licence MIT.

## 🙏 Reconnaissance

Tous les contributeurs seront mentionnés dans les notes de version et le fichier CONTRIBUTORS.md.

Merci de contribuer à SukeNyaa ! 🎉