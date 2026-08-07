# Backend Deployment — Hetzner Cloud + Docker
Containerized the backend and deployed it on a Hetzner Cloud server (Ubuntu) with Nginx reverse proxy and SSL.

## ⚙️ Stack

| Tool | Purpose |
|------|---------|
| ![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat&logo=docker&logoColor=white) | Containerization |
| ![Hetzner](https://img.shields.io/badge/Hetzner-D50C2D?style=flat&logo=hetzner&logoColor=white) | Cloud Server (CPX22, Nuremberg) |
| ![Nginx](https://img.shields.io/badge/Nginx-009639?style=flat&logo=nginx&logoColor=white) | Reverse Proxy |
| ![LetsEncrypt](https://img.shields.io/badge/Let's%20Encrypt-003A70?style=flat&logo=letsencrypt&logoColor=white) | SSL Certificate |
| ![Ubuntu](https://img.shields.io/badge/Ubuntu-E95420?style=flat&logo=ubuntu&logoColor=white) | OS (26.04 LTS) |

## 🐳 Services

| Container | Port |
|-----------|------|
| `devsync-backend` | 8080 |

## 🌐 Live URL

🔗 **https://api1.curiousteamlearning.com**

## 📦 Run Locally

```bash
git clone https://github.com/Akshatsrii/project_codru.git
cd project_codru
git checkout akshatsrii
docker compose up --build -d
```

## 🔄 Update ENV on Server

```bash
nano server/.env
docker compose restart
```

---

> Deployed by [@Akshatsrii](https://github.com/Akshatsrii)
