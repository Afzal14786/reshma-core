# CI/CD Automation (GitHub Actions)

Automate building, testing, and deploying the Reshma‑Core backend to your production server.

> This guide uses **GitHub Actions** – adapt for GitLab CI or Bitbucket Pipelines as needed.

---

## Prerequisites

- GitHub repository with your code
- Production server accessible via SSH (public key authentication)
- Docker and Docker Compose installed on the server
- A `.env.production` file stored securely (see below)

---

## How the Pipeline Works

```mermaid
graph LR
    A[git push to main] --> B[GitHub Actions: Build]
    B --> C[Run tests (optional)]
    C --> D[Build Docker image]
    D --> E[Push to registry (optional)]
    E --> F[SSH to server]
    F --> G[docker-compose pull & up -d]
```  

## 1. Store Secrets in GitHub  

Go to your repository → **Settings** → **Secrets and variables** → **Actions**.  

Add these secrets:  

| Secret Name | Value |
|-------------|-------|
| `SSH_HOST` | Your server IP or domain |
| `SSH_USER` | SSH username (e.g., ubuntu) |
| `SSH_PRIVATE_KEY` | Private SSH key (contents of `~/.ssh/id_rsa`) |
| `PROD_ENV_FILE` | The entire `.env.production` file content (as a multiline secret) |  

To get the private key:  

```bash
cat ~/.ssh/id_rsa   # copy the output
```  

To prepare the `.env.production` secret:  

```bash
cat .env.production | base64   # optional – you can store raw
```  

---  

## 2. GitHub Actions Workflow File  

Create `.github/workflows/deploy.yml`:  

```yaml
name: Deploy to Production

on:
  push:
    branches:
      - main   # or 'master'

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to Docker Hub (optional)
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_PASSWORD }}
        # Skip if you build directly on the server

      - name: Build and tag image
        run: |
          docker build -t reshma-core:latest .

      - name: Save image to tarball (for direct transfer)
        run: |
          docker save reshma-core:latest | gzip > reshma-core.tar.gz

      - name: Copy tarball and compose file to server
        uses: appleboy/scp-action@v0.1.7
        with:
          host: ${{ secrets.SSH_HOST }}
          username: ${{ secrets.SSH_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          source: "reshma-core.tar.gz,docker-compose.prod.yml"
          target: "/home/${{ secrets.SSH_USER }}/reshma-deploy/"

      - name: Execute remote deployment commands
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.SSH_HOST }}
          username: ${{ secrets.SSH_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /home/${{ secrets.SSH_USER }}/reshma-deploy/
            gunzip -f reshma-core.tar.gz
            docker load < reshma-core.tar
            rm reshma-core.tar
            
            # Restore .env.production from secret
            echo "${{ secrets.PROD_ENV_FILE }}" > .env
            
            # Stop old containers, start new ones
            docker-compose -f docker-compose.prod.yml down
            docker-compose -f docker-compose.prod.yml up -d
            
            # Clean up old images
            docker image prune -f
```  

--- 

## 3. Alternative: Direct Git Pull on Server (Simpler)  

If you prefer not to build and transfer the image, you can pull the latest code on the server and rebuild there.  

### Workflow file (simpler):  
```yaml
name: Deploy (Git Pull)

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: SSH and redeploy
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.SSH_HOST }}
          username: ${{ secrets.SSH_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /path/to/reshma-core
            git pull origin main
            docker-compose -f docker-compose.prod.yml up -d --build
            docker image prune -f
```  

This method requires the server to have Git, Docker, and the `.env` file already in place.  

---  

## 4. Environment File Management  

Never store the actual `.env` in Git. Instead:  

- **Option A (recommended):** Keep a `env.production.template` in the repo, and manually copy/update the real `.env` on the server.
- **Option B:** Use GitHub Secrets to write the file during deployment (as shown in the first workflow).  

---  

## 5. Testing Before Deploy  

Add a test step before deployment (optional but recommended):  

```yaml
- name: Run unit tests
  run: |
    npm ci
    npm test
```  

Requires Node.js setup step:  

```yaml
- name: Use Node.js
  uses: actions/setup-node@v4
  with:
    node-version: 20
```  

---  

## 6. Rollback Strategy  

If a deployment fails, revert to the previous image:  

```bash
# On the server
docker-compose -f docker-compose.prod.yml down
docker tag reshma-core:previous reshma-core:latest   # if you tagged previous
docker-compose -f docker-compose.prod.yml up -d
```  

Or simply push the previous commit to trigger a new deployment.  

---  

## 7. Monitoring Deployment Status  

- GitHub Actions shows success/failure in the repo’s **Actions** tab.
- Add a notification step (Slack, Email) on failure:  

```yaml
- name: Notify on failure
  if: failure()
  uses: rtCamp/action-slack-notify@v2
  env:
    SLACK_WEBHOOK: ${{ secrets.SLACK_WEBHOOK }}
    SLACK_MESSAGE: "Deployment failed!"
```  

---  

## Next Steps  
- Set up health check endpoint (GET /health) to verify deployments.
- Configure Blue‑Green deployment for zero downtime (requires load balancer).

--- 

*The Reshma-Core Team*  
