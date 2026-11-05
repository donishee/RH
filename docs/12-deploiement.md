# Guide de Déploiement et d'Exploitation en Production Souveraine (R7 & R5)

**République de Djibouti**  
*Unité — Égalité — Paix*  
**Ministère de l'Intérieur**  
**Direction Générale de la Police Nationale (DGPN)**  
**Division des Systèmes d'Information et Télécommunications (DSIT)**

---

## 1. Principes Directeurs et Cadre de Déploiement Souverain

Le présent guide définit la procédure officielle d'installation, de configuration durcie et d'exploitation en production du Système d'Information des Ressources Humaines (SIRH) de la **Police Nationale de la République de Djibouti**.

### 1.1. Principes Fondamentaux de Sécurité Régaliennes
1. **Hébergement National Souverain Exclusif** : L'ensemble de la pile applicative et la base de données centrale sont hébergés sur les serveurs physiques sécurisés du Centre de Données de la DGPN à Djibouti-Ville. Aucun recours à des services d'hébergement ou de calcul cloud public externe n'est toléré.
2. **Cloisonnement Réseau Intranet Intégral** : Le système est accessible exclusivement depuis le réseau Intranet fermé de la Police Nationale ou via les liaisons VPN chiffrées sécurisées reliant les directions régionales (Ali-Sabieh, Dikhil, Tadjourah, Obock, Arta).
3. **Principe du Moindre Privilège** : L'exécution du serveur applicatif s'effectue sous un compte de service système sans privilèges super-utilisateur (`sirh-app`).
4. **Zéro Base de Données Locale sur les Postes Clients** : Aucun client lourd, aucune réplication locale et aucun fichier de base décentralisé n'est déployé sur les postes de travail des commissariats (Architecture Web 3-Tiers pure).

---

## 2. Prérequis Techniques et Matériels

### 2.1. Spécifications du Serveur Central (Hôte de Production)
- **Système d'Exploitation** : Linux Ubuntu 22.04 LTS Server ou Debian 12 (noyau 6.x+, environnement 64 bits x86_64).
- **Processeur (CPU)** : 8 cœurs physiques dédiés minimum.
- **Mémoire Vive (RAM)** : 16 Go ECC minimum (32 Go recommandés pour supporter la charge des 17 unités territoriales).
- **Stockage Disque** : 200 Go en volume SSD NVMe configuré en RAID 1 ou RAID 10 matériel (chiffrement de volume LUKS activé).
- **Interfaces Réseau** : Double interface réseau Gigabit Ethernet redondée (bonding LACP).

### 2.2. Prérequis Logiciels et Dépendances
- **Node.js** : Version 20.x LTS (>= 20.17.0) ou 22.x LTS.
- **PostgreSQL** : Version 16.x serveur, configuré pour écouter sur le port dédié **5433** (isolation stricte par rapport à d'éventuelles instances par défaut sur le port 5432).
- **TypeScript** : Version 5.6.x (utilisé pour la compilation officielle de distribution).
- **Nginx** : Version 1.24+ configuré comme reverse-proxy HTTPS avec terminaison TLS 1.3.
- **OpenSSL** : Version 3.0+ pour la gestion des certificats républicains X.509 et clés de chiffrement.
- **Systemd** : Gestionnaire de services système standardisé Linux.

---

## 3. Architecture Physique et Réseau

```
  Postes Clients Commissariats (Navigateur Web)
    [ Commissariat Central, 1er au 5ème Arr., Ali-Sabieh, Dikhil, Tadjourah, Obock, Arta ]
                                │
                                │ HTTPS / TLS 1.3 (Port 443)
                                ▼ Intranet Sécurisé Police (10.50.0.0/16)
               ┌─────────────────────────────────┐
               │    Serveur Nginx (Frontal)      │
               │  - Terminaison SSL/TLS 1.3      │
               │  - En-têtes républicains durcis │
               │  - Compression & Cache Statique │
               └────────────────┬────────────────┘
                                │ Proxy interne HTTP (127.0.0.1:3000)
                                ▼
               ┌─────────────────────────────────┐
               │  Serveur Applicatif Node.js     │
               │  - Fastify v4 / TypeScript      │
               │  - Contrôle d'accès RBAC / ABAC │
               │  - Moteur Form Builder v2       │
               │  - Audit chaîné SHA-256         │
               └────────────────┬────────────────┘
                                │ Pool de connexions TCP (127.0.0.1:5433)
                                ▼
               ┌─────────────────────────────────┐
               │ Base PostgreSQL 16 (Port 5433)  │
               │  - Base : sirh_djibouti         │
               │  - Rôle : sirh_app              │
               │  - 24 tables relationnelles     │
               │  - Contraintes POSIX médicales  │
               │  - Triggers d'audit immuables   │
               └─────────────────────────────────┘
```

---

## 4. Procédure d'Installation et de Déploiement Pas à Pas

### Étape 1 : Préparation du Système et Création des Comptes de Service

Connecté en tant qu'administrateur système sur le serveur central :

```bash
# Mise à jour des dépôts et paquets du système souverain
sudo apt-get update && sudo apt-get upgrade -y

# Installation des utilitaires indispensables
sudo apt-get install -y curl wget git build-essential nginx postgresql-16 postgresql-client-16 openssl logrotate

# Création du compte système dédié à l'exécution de l'application (sans shell interactif)
sudo useradd -r -s /usr/sbin/nologin -d /opt/sirh-pnd -m sirh-app

# Installation de Node.js 20 LTS via le canal officiel
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

---

### Étape 2 : Configuration Durcie de PostgreSQL 16 sur le Port 5433

Le moteur relationnel central doit impérativement écouter sur le port **5433** afin de garantir l'isolation complète du SIRH régalien.

1. **Modification du port d'écoute PostgreSQL** (`/etc/postgresql/16/main/postgresql.conf`) :
```ini
# Configuration réseau PostgreSQL
port = 5433
listen_addresses = '127.0.0.1'
max_connections = 100

# Paramètres de performance et intégrité
shared_buffers = 4GB
effective_cache_size = 12GB
work_mem = 64MB
maintenance_work_mem = 1GB
wal_level = replica
checkpoint_completion_target = 0.9
```

2. **Création du rôle applicatif et de la base de données** :
```bash
# Redémarrage du service PostgreSQL pour appliquer le port 5433
sudo systemctl restart postgresql

# Création de l'utilisateur et de la base sous l'interpréteur PostgreSQL
sudo -u postgres psql -p 5433 << 'EOF'
-- Création du rôle applicatif sécurisé
CREATE ROLE sirh_app WITH LOGIN PASSWORD 'sirh_djibouti_2026' NOSUPERUSER NOCREATEDB NOCREATEROLE;

-- Création de la base de données régalienne
CREATE DATABASE sirh_djibouti WITH OWNER sirh_app ENCODING 'UTF8' LC_COLLATE 'fr_FR.UTF-8' LC_CTYPE 'fr_FR.UTF-8';

-- Attribution des privilèges
GRANT ALL PRIVILEGES ON DATABASE sirh_djibouti TO sirh_app;
\c sirh_djibouti
GRANT ALL ON SCHEMA public TO sirh_app;
EOF
```

3. **Sécurisation des accès locaux** (`/etc/postgresql/16/main/pg_hba.conf`) :
```ini
# Autoriser exclusivement la connexion locale du compte sirh_app par mot de passe chiffré scram-sha-256
local   sirh_djibouti   sirh_app                                scram-sha-256
host    sirh_djibouti   sirh_app        127.0.0.1/32            scram-sha-256
host    sirh_djibouti   sirh_app        ::1/128                 scram-sha-256
```

---

### Étape 3 : Déploiement du Code Source Applicatif

```bash
# Création du répertoire de production officiel
sudo mkdir -p /opt/sirh-pnd
sudo chown -R sirh-app:sirh-app /opt/sirh-pnd

# Déploiement des sources du SIRH (ex : depuis le dépôt souverain interne)
cd /opt/sirh-pnd
# (Ou copie intégrale de l'arborescence validée /root/RH)
sudo cp -r /root/RH/* /opt/sirh-pnd/
sudo chown -R sirh-app:sirh-app /opt/sirh-pnd
```

---

### Étape 4 : Configuration des Variables d'Environnement (`.env`)

Créer le fichier `/opt/sirh-pnd/.env` protégé par des permissions strictes (`600`, lecture réservée au compte `sirh-app`) :

```bash
sudo -u sirh-app bash -c 'cat > /opt/sirh-pnd/.env' << 'EOF'
# Configuration Réseau et Écoute HTTP interne
PORT=3000
HOST=127.0.0.1

# Paramètres de Connexion Base de Données Centrale PostgreSQL
PGHOST=127.0.0.1
PGPORT=5433
PGDATABASE=sirh_djibouti
PGUSER=sirh_app
PGPASSWORD=sirh_djibouti_2026

# Secret Cryptographique des Sessions HttpOnly (Générer une clé de 64 caractères aléatoires)
SESSION_SECRET=c8f5d8a9e2b10471b4c398018e7d23a456123089ef0912bcde45781034ab56cd

# Environnement d'Exécution
NODE_ENV=production
EOF

# Verrouillage des droits d'accès
sudo chmod 600 /opt/sirh-pnd/.env
```

---

### Étape 5 : Installation des Dépendances et Compilation TypeScript

```bash
cd /opt/sirh-pnd

# Installation propre des dépendances strictes
sudo -u sirh-app npm install

# Compilation des sources TypeScript vers le répertoire dist/
sudo -u sirh-app npm run build
```

---

### Étape 6 : Application des Migrations DDL et Peuplement du Référentiel

Le script de migration applique l'intégralité du schéma DDL (`schema.sql`), les contraintes d'intégrité POSIX de protection médicale et les triggers de scellement d'audit :

```bash
cd /opt/sirh-pnd

# Application des 24 tables, contraintes POSIX et triggers
sudo -u sirh-app npm run db:migrate

# Peuplement initial du référentiel républicain (grades, unités djiboutiennes, administrateurs)
sudo -u sirh-app npm run db:seed
```

---

### Étape 7 : Configuration du Service d'Arrière-Plan Systemd

Créer le fichier d'unité de service `/etc/systemd/system/sirh-pnd.service` garantissant le redémarrage automatique en cas de panne et un durcissement d'exécution poussé :

```ini
[Unit]
Description=SIRH Police Nationale de Djibouti - Serveur Applicatif
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=sirh-app
Group=sirh-app
WorkingDirectory=/opt/sirh-pnd
EnvironmentFile=/opt/sirh-pnd/.env
ExecStart=/usr/bin/node dist/server.js
Restart=always
RestartSec=5s

# Durcissement de sécurité du processus (Linux Sandboxing)
NoNewPrivileges=true
ProtectSystem=full
ProtectHome=true
PrivateTmp=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
```

Activation et démarrage du service :
```bash
sudo systemctl daemon-reload
sudo systemctl enable sirh-pnd.service
sudo systemctl start sirh-pnd.service

# Vérification du statut opérationnel
sudo systemctl status sirh-pnd.service
```

---

### Étape 8 : Configuration du Reverse-Proxy Nginx avec Chiffrement HTTPS

Créer la configuration `/etc/nginx/sites-available/sirh.police.dj` :

```nginx
server {
    listen 80;
    server_name sirh.police.dj;
    # Redirection automatique intégrale HTTP vers HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name sirh.police.dj;

    # Certificats SSL/TLS de l'Autorité Républicaine de Djibouti (PKI Souveraine)
    ssl_certificate /etc/ssl/certs/sirh_police_dj.crt;
    ssl_certificate_key /etc/ssl/private/sirh_police_dj.key;

    # Paramètres de durcissement cryptographique TLS 1.3
    ssl_protocols TLSv1.3 TLSv1.2;
    ssl_ciphers 'ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305';
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;

    # En-têtes de sécurité républicains durcis
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self';" always;

    # Limitation de la taille des requêtes (téléversement pièces jointes arrêté/diplôme)
    client_max_body_size 10M;

    # Journalisation d'accès et d'erreurs
    access_log /var/log/nginx/sirh_access.log;
    error_log /var/log/nginx/sirh_error.log warn;

    # Proxy inverse vers le serveur d'application Node.js
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

Activation du site Nginx :
```bash
sudo ln -sf /etc/nginx/sites-available/sirh.police.dj /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl restart nginx
```

---

## 5. Supervision, Santé du Système et Exploitation Courante

### 5.1. Point de Contrôle de Santé Automatisé (`/api/sante`)
Le système dispose d'une route native de supervision interrogeable par les sondes de monitoring :
```bash
curl -s http://127.0.0.1:3000/api/sante | jq .
```

Réponse nominale attendue :
```json
{
  "statut": "OPERATIONNEL",
  "systeme": "SIRH Police Nationale de Djibouti",
  "version": "1.0.0",
  "base_de_donnees": "CONNECTEE",
  "horodatage": "2026-11-05T10:00:00.000Z"
}
```

### 5.2. Rotation des Journaux d'Événements (`/etc/logrotate.d/sirh-pnd`)
```ini
/var/log/nginx/sirh_*.log {
    daily
    missingok
    rotate 90
    compress
    delaycompress
    notifempty
    create 0640 www-data adm
    sharedscripts
    postrotate
        [ -f /var/run/nginx.pid ] && kill -USR1 `cat /var/run/nginx.pid`
    endscript
}
```

### 5.3. Procédure de Sauvegarde Quotidienne Chiffrée

Créer le script `/opt/sirh-pnd/scripts/sauvegarde_quotidienne.sh` exécuté chaque nuit à 01h00 UTC par `cron` :

```bash
#!/bin/bash
set -e

DATE=$(date +%Y%m%d_%H%M%S)
DOSSIER_BACKUP="/var/backups/sirh"
FICHIER_SQL="${DOSSIER_BACKUP}/sirh_djibouti_${DATE}.sql"
FICHIER_ENC="${FICHIER_SQL}.enc"
CLE_CHIFFREMENT="/etc/sirh/cle_sauvegarde.key"

mkdir -p "${DOSSIER_BACKUP}"

# 1. Export PostgreSQL complet sur port 5433
PGPASSWORD='sirh_djibouti_2026' pg_dump -h 127.0.0.1 -p 5433 -U sirh_app -d sirh_djibouti -F c -b -v -f "${FICHIER_SQL}"

# 2. Calcul de la somme de contrôle SHA-256 du dump brut
sha256sum "${FICHIER_SQL}" > "${FICHIER_SQL}.sha256"

# 3. Chiffrement symétrique AES-256-CBC
openssl enc -aes-256-cbc -salt -pbkdf2 -in "${FICHIER_SQL}" -out "${FICHIER_ENC}" -pass file:"${CLE_CHIFFREMENT}"

# 4. Suppression du dump brut en clair
rm -f "${FICHIER_SQL}"

# 5. Purge des sauvegardes vieilles de plus de 365 jours
find "${DOSSIER_BACKUP}" -type f -mtime +365 -delete

echo "[$(date)] Sauvegarde chiffrée réussie : ${FICHIER_ENC}"
```

---

## 6. Procédure de Reprise Après Sinistre (Restauration)

En cas d'incident matériel majeur ou de sinistre nécessitant la restauration de la base :

1. **Arrêt du serveur applicatif** :
   ```bash
   sudo systemctl stop sirh-pnd
   ```

2. **Déchiffrement de l'archive de sauvegarde** :
   ```bash
   openssl enc -d -aes-256-cbc -pbkdf2 -in /var/backups/sirh/sirh_djibouti_AAAAMMJJ_HHMMSS.sql.enc -out /tmp/restauration.sql -pass file:/etc/sirh/cle_sauvegarde.key
   ```

3. **Vérification de la somme de contrôle SHA-256** :
   ```bash
   sha256sum /tmp/restauration.sql
   cat /var/backups/sirh/sirh_djibouti_AAAAMMJJ_HHMMSS.sql.sha256
   # Les deux empreintes doivent correspondre rigoureusement.
   ```

4. **Restauration de la base de données** :
   ```bash
   # Réinitialisation du schéma et restauration intégrale
   PGPASSWORD='sirh_djibouti_2026' pg_restore -h 127.0.0.1 -p 5433 -U sirh_app -d sirh_djibouti --clean --if-exists /tmp/restauration.sql
   rm -f /tmp/restauration.sql
   ```

5. **Vérification de l'intégrité de la chaîne d'audit SHA-256** :
   ```bash
   cd /opt/sirh-pnd
   sudo -u sirh-app npm test tests/boundaries/limites_securite_injections.test.js
   ```

6. **Redémarrage du service** :
   ```bash
   sudo systemctl start sirh-pnd
   curl -s http://127.0.0.1:3000/api/sante
   ```

Le système est alors pleinement rétabli dans un état certifié conforme et intègre.
