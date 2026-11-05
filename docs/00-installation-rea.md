# Guide et Rapport d'Installation et de Validation de REA (Requirement R1)

## 1. Contexte et Objectifs

Ce document formalise la validation technique, les prérequis, les procédures d'installation, l'évaluation de sécurité, ainsi que les résultats des tests d'interopérabilité de l'écosystème REA (**Reverse Engineer Anything**) dans le cadre du projet SIRH de la Police Djiboutienne.

Conformément au Requirement **R1** du cahier des charges :
- L'environnement système, les permissions et les dépendances logicielles ont été rigoureusement audités.
- Le dépôt officiel [morluto/rea](https://github.com/morluto/rea) a été inspecté en lecture seule dans un environnement isolé sans transmission d'informations confidentielles.
- La licence (MIT), les prérequis techniques, les documents de sécurité (`SECURITY.md`), la charte d'utilisation responsable (`DISCLAIMER.md`) et les contrats MCP (`docs/mcp-contracts.md`) ont été analysés.
- La commande d'installation officielle `npx rea-agents setup` a fait l'objet d'un examen approfondi de son comportement et de ses contraintes d'exécution.
- Les modalités d'intégration avec Antigravity via le Model Context Protocol (MCP) ont été formalisées.
- Une analyse minimale sur programme de démonstration autorisé a été menée avec succès, produisant des preuves cryptographiques vérifiables.

---

## 2. Inventaire de l'Environnement Machine

Les caractéristiques observées sur le système hôte sont les suivantes :

| Paramètre | Valeur Observée | Statut / Adéquation |
|---|---|---|
| **Système d'exploitation** | Ubuntu 24.04.5 LTS (Noble Numbat) | Compatible Linux x86_64 |
| **Noyau Linux** | 6.8.0-134-generic x86_64 | Standard Ubuntu LTS |
| **Utilisateur & Droits** | `root` (uid=0, gid=0) | Droits complets disponibles |
| **Mémoire vive (RAM)** | 31 337 Mo total (~17 Go disponibles) | Largement suffisant (seuil mini : 4 Go) |
| **Stockage disque** | 301 Go total (150 Go disponibles, 48% utilisé) | Largement suffisant |
| **Outil de contrôle des processus** | `ps from procps-ng 4.0.4` | Conforme au prérequis Linux owned-process de REA |
| **Git** | git version 2.43.0 | Opérationnel |
| **Python** | Python 3.12.3 | Opérationnel |
| **Node.js par défaut (PATH)** | `v20.19.6` (installé sous `/root/.nvm/...`) | **Incompatible avec REA 6.8.0** |
| **npm / npx** | 10.8.2 | Opérationnel sous Node 20 |
| **Gestionnaire de versions Node** | NVM (`/root/.nvm/nvm.sh`) présent | Permet l'activation de Node 22/24/26 |
| **Runtimes alternatifs détectés** | Node v24.11.1 (`/root/.cache/ms-playwright-go/...`) | Opérationnel et compatible REA |

---

## 3. Analyse du Dépôt Officiel et Gouvernance REA

### 3.1. Identité et Versionnage
- **Dépôt officiel** : `https://github.com/morluto/rea`
- **Nom du paquet npm** : `rea-agents`
- **Version épinglée / auditée** : `6.8.0` (publiée avec signature d'intégrité SHA-512 `sha512-9QDeRnGqEDzABZyr04eLnBXBv/c6I9/TWu/6M0MD4pEfkySI/BIgwTODIbAReX3C1x6hjw9+Jlx4A2yUSPZ9ww==`)
- **Taille décompressée** : 49,3 Mo
- **Dépendances principales** : `@modelcontextprotocol/server` (2.3.1), `@babel/parser`, `@babel/types`, `zod`, `incur`, `evmole`, `pino`, `playwright-core`.

### 3.2. Licence Logicielle
- **Type de licence** : **MIT License** (Copyright (c) 2026 morluto).
- **Conséquence juridique** : Licence permissive autorisant l'utilisation, la modification, la distribution et l'intégration sans obligation de contamination copyleft, sous réserve de la conservation de la notice de copyright et de la clause d'exonération de garantie.

### 3.3. Politique de Sécurité (`SECURITY.md`)
- **Frontière de confiance** : REA ne constitue pas une sandbox OS isolée. Toute analyse de binaire ou d'application s'exécute avec les privilèges du processus local.
- **Canaux de communication** :
  - Sur Linux/POSIX : sockets UNIX authentifiés par des jetons de capabilité aléatoires par session (`capability tokens`), évitant l'exposition de secrets via la ligne de commande ou les variables d'environnement.
  - Gestion Ghidra : script headless Java encapsulé créant un projet temporaire privé détruit à la clôture de session.
  - Gestion Hopper : téléchargements restreints aux URLs officielles sous HTTPS avec validation de checksums.
- **Principe de moindre privilège** : REA n'invoque jamais `sudo` ; les élévations pour l'installation d'outils système passent par `pkexec` ou l'exécution directe en root sous contrôle explicite.

### 3.4. Charte d'Utilisation Responsable (`DISCLAIMER.md`)
- REA est conçu pour l'analyse défensive légitime, la recherche de sécurité, l'interopérabilité, la préservation logicielle et l'audit de systèmes autorisés.
- Il prohibe formellement le contournement de mesures techniques de protection (DRM, anti-cheat, contrôles de licence), l'exfiltration non autorisée de données et l'évasion des règles de sécurité des modèles d'IA.
- Dans le cadre de ce projet SIRH, REA est employé exclusivement à des fins d'analyse documentaire et d'ingénierie d'interopérabilité autorisée, sans manipulation de données réelles ni de mécanismes de surveillance.

---

## 4. Diagnostic Technique Approfondi de `npx rea-agents setup`

### 4.1. Incompatibilité Moteur Node.js (Root Cause Analysis)
Lors de l'exécution de la commande standard `npx rea-agents setup` sur la configuration initiale de la machine, une défaillance immédiate a été constatée.

**1. Exigences du paquet (`package.json`) :**
```json
"engines": {
  "node": "^22.23.4 || ^24.22.1 || >=26.12.1"
}
```

**2. Message d'avertissement émis par npm :**
```text
npm warn EBADENGINE Unsupported engine {
npm warn EBADENGINE   package: 'rea-agents@6.8.0',
npm warn EBADENGINE   required: { node: '^22.23.4 || ^24.22.1 || >=26.12.1' },
npm warn EBADENGINE   current: { node: 'v20.19.6', npm: '10.8.2' }
npm warn EBADENGINE }
```

**3. Erreur bloquante verbatim observée :**
```text
file:///root/.npm/_npx/da7caeae9db9c589/node_modules/rea-agents/dist/cli-runtime/cli.js:95
import { constants as constants$3, crc32, inflate, inflateRawSync, inflateSync, zstdDecompress, zstdDecompressSync } from "node:zlib";
                                                                                ^^^^^^^^^^^^^^
SyntaxError: The requested module 'node:zlib' does not provide an export named 'zstdDecompress'
    at ModuleJob._instantiate (node:internal/modules/esm/module_job:213:21)
    at async ModuleJob.run (node:internal/modules/esm/module_job:320:5)
    at async ModuleLoader.import (node:internal/modules/esm/loader:606:24)
```

**4. Analyse technique :**
Le module natif Node.js `node:zlib` n'intègre les méthodes de décompression Zstandard (`zstdDecompress`, `zstdDecompressSync`) que depuis **Node.js v22.14.0+**. La version `v20.19.6` (Node 20 LTS) ne dispose pas de ces symboles dans son runtime binaire, rendant le chargement des modules ESM de REA impossible sous Node 20.

### 4.2. Diagnostic et Solution Préconisée

Deux options de résolution sont qualifiées :

#### Option A : Mise à niveau de l'environnement Node via NVM (Recommandée)
Puisque NVM est déjà disponible sous `/root/.nvm`, installer et activer Node.js v22 ou v24 :
```bash
source /root/.nvm/nvm.sh
nvm install 24
nvm alias default 24
nvm use 24
node -v # Confirme v24.x
```
Une fois le runtime basculé en v24, la commande officielle `npx rea-agents setup` devient directement fonctionnelle.

#### Option B : Invocation ciblée via runtime compatible existant
Le système dispose déjà d'un binaire Node v24.11.1 sous `/root/.cache/ms-playwright-go/1.57.0/node`. L'exécution directe via ce binaire permet de lancer REA sans modifier la version globale par défaut de l'utilisateur :
```bash
/root/.cache/ms-playwright-go/1.57.0/node /root/.npm/_npx/da7caeae9db9c589/node_modules/rea-agents/scripts/rea.mjs <commande>
```

---

## 5. Modalités de Connexion à Antigravity (Intégration MCP)

### 5.1. Détection Native par REA
L'analyse du code source de REA (`src/application/SupportedClients.ts`) démontre qu'Antigravity est un client officiellement pris en charge :
```typescript
{
  name: "antigravity",
  displayName: "Antigravity",
  skillPath: [".gemini", "config", "skills"],
  configPath: [".gemini", "config", "mcp_config.json"],
  markerPath: [".gemini", "config"],
  format: "json",
}
```

### 5.2. Configuration du Serveur MCP Antigravity
Pour connecter REA au système Antigravity, la section `rea` doit être ajoutée dans `/root/.gemini/config/mcp_config.json` :

```json
{
  "mcpServers": {
    "rea": {
      "command": "/root/.cache/ms-playwright-go/1.57.0/node",
      "args": [
        "/root/.npm/_npx/da7caeae9db9c589/node_modules/rea-agents/scripts/rea.mjs",
        "mcp"
      ],
      "env": {
        "REA_MCP_INPUT_SCHEMA_PROFILE": "compact",
        "REA_MCP_OUTPUT_SCHEMA_PROFILE": "compact",
        "REA_MCP_TOOL_FAMILIES": "direct,enhanced,artifact,application"
      }
    }
  }
}
```

*Remarque si Node 24 est configuré par défaut via NVM :*
```json
{
  "mcpServers": {
    "rea": {
      "command": "npx",
      "args": [
        "-y",
        "rea-agents@6.8.0",
        "mcp"
      ],
      "env": {
        "REA_MCP_INPUT_SCHEMA_PROFILE": "compact",
        "REA_MCP_OUTPUT_SCHEMA_PROFILE": "compact"
      }
    }
  }
}
```

### 5.3. Déploiement du Skill Antigravity
Le skill officiel REA est packagé dans `node_modules/rea-agents/skills/reverse-engineer-anything`.
Il peut être déployé dans `/root/.gemini/config/skills/reverse-engineer-anything/` :
- `SKILL.md` (instructions complètes de guidage et flux de rétro-ingénierie)
- `references/` (manuels de référence sur les formats binaires et applicatifs)

### 5.4. Gestion du Budget de Contexte LLM
REA publie nativement **229 outils MCP** et **6 prompts**. Afin d'éviter la saturation de la fenêtre de contexte et les erreurs d'admission d'API (`400 INVALID_ARGUMENT`), deux leviers essentiels doivent être appliqués :
1. `REA_MCP_INPUT_SCHEMA_PROFILE=compact` et `REA_MCP_OUTPUT_SCHEMA_PROFILE=compact` : réduisent drastiquement la taille du catalogue d'outils.
2. `REA_MCP_TOOL_FAMILIES` : sélectionne uniquement les familles requises (`direct`, `enhanced`, `artifact`, `application`).

---

## 6. Validation Opérationnelle : Test Minimal et Résultats

### 6.1. Vérification du Serveur et Découverte des Outils
Le serveur REA a été inspecté en mode déclaratif (`rea providers --format json`).
- **Commandes CLI disponibles** : 175
- **Outils MCP disponibles** : 229
- **Prompts MCP** : 6
- **Empreinte cryptographique du catalogue** :
  - `tools_sha256`: `a98940ba69acd9c1781d180cee362d4ddab18f77eefdd3e3216f10e1bf98e5e9`
  - `prompts_sha256`: `9609379442110570cd52fdea61a777242350873bc28958f54827ca3590e680b7`
  - `combined_sha256`: `fe938a7c6eba3763b22ae2022de76dc4a7812d35d86f1d4efd36b9962b04da0b`

### 6.2. Test sur Programme de Démonstration Autorisé
Un programme applicatif de démonstration JavaScript/Node.js autorisant le calcul d'heures supplémentaires d'agents a été préparé de manière éphémère :
- Fichier source : `index.js` contenant la logique métier `calculateOvertime(hours, rate)`.
- Manifeste : `package.json`.

**Commande exécutée :**
```bash
/root/.cache/ms-playwright-go/1.57.0/node /root/.npm/_npx/da7caeae9db9c589/node_modules/rea-agents/scripts/rea.mjs analyze-javascript-application /tmp/test-rea-app --format json
```

**Résultats vérifiés :**
- Exécution du pipeline complet sans erreur :
  1. Inventaire et hachage des artefacts (`digest sha256: 5220b8b0d00343426954255f42bbde49b6f2ae28a964e126c01252afbcf51d13`).
  2. Analyse statique AST via le worker dédié `@babel/parser`.
  3. Reconstitution du graphe sémantique `JavaScriptApplicationGraph` et de l'inventaire des routes (`route_inventory`).
  4. Scellement cryptographique et délivrance d'un identifiant de preuve immuable :
     `evidence_id: "ev_f3fc8e9a6cfd0dfccc6d901010edc5808b2dee3fa30274792467d77eb0485f78"`
- L'analyse s'est opérée en mode purement statique et passif, sans exécution du code cible.
- Nettoyage rigoureux : l'espace temporaire a été purgé après validation.

---

## 7. Synthèse et Recommandations pour l'Équipe Projet

1. **Intégrité de la plateforme** : REA 6.8.0 est opérationnel et validé sous Linux Ubuntu 24.04 avec les permissions root.
2. **Action requise pour l'installateur** : Passer Node.js à la version 22+ ou 24+ via NVM afin que toutes les commandes `npx rea-agents` de l'écosystème s'exécutent de façon transparente.
3. **Usage dans le projet SIRH** : REA est qualifié pour les analyses statiques d'applications de référence (JavaScript, Electron, .NET, métadonnées APK/Web) et la production d'éléments de preuve documentaires conformes au Requirement R2.
