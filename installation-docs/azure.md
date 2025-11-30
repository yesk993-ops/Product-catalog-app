# Azure Migration Guide: Product Catalog App

This document provides step-by-step instructions for migrating the Product Catalog App (https://github.com/fred4impact/Product-catalog-app.git) to Azure using Azure Pipelines, Azure Container Registry (ACR), Azure Kubernetes Service (AKS), and ArgoCD for GitOps.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Azure Infrastructure Setup](#azure-infrastructure-setup)
3. [Azure Container Registry Setup](#azure-container-registry-setup)
4. [Azure Kubernetes Service (AKS) Setup](#azure-kubernetes-service-aks-setup)
5. [ArgoCD Installation and Configuration](#argocd-installation-and-configuration)
6. [Azure Repos Setup](#azure-repos-setup)
7. [Azure Pipeline Configuration](#azure-pipeline-configuration)
8. [Kubernetes Manifests Update for GitOps](#kubernetes-manifests-update-for-gitops)
9. [ArgoCD Application Configuration](#argocd-application-configuration)
10. [Deployment and Verification](#deployment-and-verification)
11. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Azure Resources
- Azure Subscription with appropriate permissions
- Azure CLI installed and configured
- kubectl installed
- Docker installed
- Git installed
- Azure DevOps account (for Azure Repos and Pipelines)

### Required Permissions
- Owner or Contributor role on Azure Subscription
- Ability to create Resource Groups, AKS clusters, ACR registries
- Azure DevOps Project Admin permissions

### Install Required Tools

```bash
# Install Azure CLI (if not installed)
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash

# Login to Azure
az login

# Set subscription
az account set --subscription "YOUR_SUBSCRIPTION_ID"

# Install kubectl
az aks install-cli

# Install ArgoCD CLI
curl -sSL -o /usr/local/bin/argocd https://github.com/argoproj/argo-cd/releases/latest/download/argocd-linux-amd64
chmod +x /usr/local/bin/argocd
```

---

## Azure Infrastructure Setup

### Step 1: Create Resource Group

```bash
# Set variables
RESOURCE_GROUP="product-catalog-rg"
LOCATION="eastus"  # Change to your preferred region

# Create resource group
az group create \
  --name $RESOURCE_GROUP \
  --location $LOCATION
```

### Step 2: Create Azure Container Registry (ACR)

```bash
# Set ACR variables
ACR_NAME="productcatalogacr"  # Must be globally unique, lowercase, alphanumeric only
SKU="Basic"  # Options: Basic, Standard, Premium

# Create ACR
az acr create \
  --resource-group $RESOURCE_GROUP \
  --name $ACR_NAME \
  --sku $SKU \
  --admin-enabled true

# Get ACR login server
ACR_LOGIN_SERVER=$(az acr show --name $ACR_NAME --resource-group $RESOURCE_GROUP --query loginServer --output tsv)
echo "ACR Login Server: $ACR_LOGIN_SERVER"

# Get ACR credentials
ACR_USERNAME=$(az acr credential show --name $ACR_NAME --resource-group $RESOURCE_GROUP --query username --output tsv)
ACR_PASSWORD=$(az acr credential show --name $ACR_NAME --resource-group $RESOURCE_GROUP --query passwords[0].value --output tsv)
```

**Note:** Save the ACR credentials securely. You'll need them for Azure Pipelines.

---

## Azure Kubernetes Service (AKS) Setup

### Step 3: Create AKS Cluster

```bash
# Set AKS variables
AKS_CLUSTER_NAME="product-catalog-aks"
NODE_COUNT=3
NODE_VM_SIZE="Standard_B2s"  # Adjust based on your needs
KUBERNETES_VERSION="1.28"  # Use latest stable version

# Create AKS cluster
az aks create \
  --resource-group $RESOURCE_GROUP \
  --name $AKS_CLUSTER_NAME \
  --node-count $NODE_COUNT \
  --node-vm-size $NODE_VM_SIZE \
  --kubernetes-version $KUBERNETES_VERSION \
  --generate-ssh-keys \
  --enable-managed-identity \
  --attach-acr $ACR_NAME \
  --enable-addons monitoring \
  --network-plugin azure

# Get AKS credentials
az aks get-credentials \
  --resource-group $RESOURCE_GROUP \
  --name $AKS_CLUSTER_NAME \
  --overwrite-existing

# Verify cluster connection
kubectl get nodes
```

### Step 4: Create Namespace for Application

```bash
# Create namespace
kubectl create namespace product-catalog

# Set as default namespace (optional)
kubectl config set-context --current --namespace=product-catalog
```

---

## ArgoCD Installation and Configuration

### Step 5: Install ArgoCD on AKS

```bash
# Create ArgoCD namespace
kubectl create namespace argocd

# Install ArgoCD
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Wait for ArgoCD pods to be ready
kubectl wait --for=condition=available --timeout=300s deployment/argocd-server -n argocd
kubectl wait --for=condition=available --timeout=300s deployment/argocd-repo-server -n argocd
kubectl wait --for=condition=available --timeout=300s deployment/argocd-applicationset-controller -n argocd

# Check ArgoCD pods status
kubectl get pods -n argocd
```

### Step 6: Expose ArgoCD Server

#### Option A: Using LoadBalancer (Recommended for Production)

```bash
# Patch ArgoCD server service to use LoadBalancer
kubectl patch svc argocd-server -n argocd -p '{"spec": {"type": "LoadBalancer"}}'

# Wait for external IP
kubectl get svc argocd-server -n argocd

# Get ArgoCD server URL
ARGOCD_SERVER=$(kubectl get svc argocd-server -n argocd -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
echo "ArgoCD Server URL: http://$ARGOCD_SERVER"
```

#### Option B: Using Port Forwarding (For Testing)

```bash
# Port forward ArgoCD server
kubectl port-forward svc/argocd-server -n argocd 8080:443
# Access at: https://localhost:8080
```

### Step 7: Get ArgoCD Admin Password

```bash
# Get initial admin password
ARGOCD_PASSWORD=$(kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d)
echo "ArgoCD Admin Password: $ARGOCD_PASSWORD"

# Login to ArgoCD CLI
argocd login $ARGOCD_SERVER --username admin --password $ARGOCD_PASSWORD --insecure

# Update admin password (optional but recommended)
argocd account update-password --account admin --current-password $ARGOCD_PASSWORD --new-password YOUR_NEW_PASSWORD
```

### Step 8: Configure ArgoCD to Access Azure Container Registry

```bash
# Create ACR secret in ArgoCD namespace
kubectl create secret docker-registry acr-secret \
  --docker-server=$ACR_LOGIN_SERVER \
  --docker-username=$ACR_USERNAME \
  --docker-password=$ACR_PASSWORD \
  --namespace=argocd

# Create ACR secret in application namespace
kubectl create secret docker-registry acr-secret \
  --docker-server=$ACR_LOGIN_SERVER \
  --docker-username=$ACR_USERNAME \
  --docker-password=$ACR_PASSWORD \
  --namespace=product-catalog
```

---

## Azure Repos Setup

### Step 9: Create Azure DevOps Project and Repository

1. **Navigate to Azure DevOps**
   - Go to https://dev.azure.com
   - Sign in with your Azure account

2. **Create New Project**
   - Click "New project"
   - Project name: `Product-Catalog-App`
   - Visibility: Private (or Public)
   - Version control: Git
   - Work item process: Agile
   - Click "Create"

3. **Import Repository**
   ```bash
   # Get your Azure DevOps organization URL
   # Format: https://dev.azure.com/{organization}/{project}/_git/{repository}
   
   # Clone the original repository
   git clone https://github.com/fred4impact/Product-catalog-app.git
   cd Product-catalog-app
   
   # Add Azure Repos as remote
   # Replace {org}, {project}, {repo} with your values
   git remote add azure https://{org}@dev.azure.com/{org}/{project}/_git/{repo}
   
   # Push to Azure Repos
   git push azure main
   ```

4. **Create GitOps Repository (for Kubernetes Manifests)**
   - In Azure DevOps, create a new repository: `product-catalog-gitops`
   - This will store Kubernetes manifests that ArgoCD will sync
   - Initialize with README

---

## Azure VM Self-Hosted Agent Setup

### Step 10: Create Azure VM for Self-Hosted Agent

```bash
# Set variables
VM_NAME="devops-agent-vm"
VM_SIZE="Standard_D2s_v3"  # 2 vCPUs, 8 GB RAM
ADMIN_USERNAME="azureuser"
RESOURCE_GROUP="product-catalog-rg"
LOCATION="eastus"

# Create VM
az vm create \
  --resource-group $RESOURCE_GROUP \
  --name $VM_NAME \
  --image Ubuntu2204 \
  --size $VM_SIZE \
  --admin-username $ADMIN_USERNAME \
  --generate-ssh-keys \
  --public-ip-sku Standard \
  --location $LOCATION

# Get VM public IP
VM_IP=$(az vm show -d -g $RESOURCE_GROUP -n $VM_NAME --query publicIps -o tsv)
echo "VM Public IP: $VM_IP"

# Open port 22 for SSH (if not already open)
az vm open-port --port 22 --resource-group $RESOURCE_GROUP --name $VM_NAME --priority 1000
```

### Step 11: Install Required Software on VM

```bash
# SSH into the VM
ssh $ADMIN_USERNAME@$VM_IP

# Update system
sudo apt-get update && sudo apt-get upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Git
sudo apt-get install -y git

# Install Azure CLI (optional, for ACR access)
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash

# Install kubectl (optional)
az aks install-cli

# Install build tools
sudo apt-get install -y build-essential

# Verify installations
docker --version
node --version
npm --version
git --version
```

### Step 12: Configure Azure DevOps Agent Pool

1. **In Azure DevOps**
   - Go to your project
   - Click **"Project settings"** (gear icon)
   - Under **"Pipelines"**, click **"Agent pools"**
   - Click **"+ New agent pool"**
   - **Pool type**: Select **"Self-hosted"**
   - **Name**: Enter `productagent`
   - **Auto-provision agents**: Unchecked (manual setup)
   - Click **"Create"**

### Step 13: Install and Configure Agent on VM

1. **Get Agent Download URL**
   - In Azure DevOps, go to **Agent pools**
   - Click on `productagent` pool
   - Click **"New agent"**
   - Select **"Linux"** tab
   - Copy the download command (looks like: `curl -o agent.tar.gz https://vstsagentpackage.azureedge.net/agent/...`)

2. **On the VM, Install Agent**
   ```bash
   # Create agent directory
   mkdir -p ~/myagent && cd ~/myagent
   
   # Download agent (use the URL from Azure DevOps)
   curl -o agent.tar.gz https://vstsagentpackage.azureedge.net/agent/3.227.2/vsts-agent-linux-x64-3.227.2.tar.gz
   
   # Extract
   tar zxvf agent.tar.gz
   
   # Configure agent
   ./config.sh
   ```
   
   During configuration, you'll be prompted for:
   - **Server URL**: `https://dev.azure.com/{your-org}`
   - **Authentication type**: `PAT` (Personal Access Token)
   - **Personal Access Token**: Create one in Azure DevOps (User Settings → Personal Access Tokens)
     - Scopes needed: **Agent Pools (Read & manage)**
   - **Agent pool**: `productagent`
   - **Agent name**: `devops-agent-vm` (or any name)
   - **Work folder**: `_work` (default)

3. **Install Agent as Service**
   ```bash
   # Install as systemd service
   sudo ./svc.sh install
   
   # Start the service
   sudo ./svc.sh start
   
   # Check status
   sudo ./svc.sh status
   ```

4. **Verify Agent in Azure DevOps**
   - Go to **Agent pools** → `productagent`
   - You should see your agent listed with status **"Online"** (green)

### Step 14: Configure VM for Docker Builds

```bash
# On the VM, ensure Docker daemon is running
sudo systemctl enable docker
sudo systemctl start docker

# Test Docker
docker run hello-world

# Configure Docker to work with ACR (if needed)
az acr login --name YOUR_ACR_NAME
```

---

## Azure Pipeline Configuration

### Step 15: Create Service Connection for ACR

1. **In Azure DevOps Project**
   - Go to Project Settings → Service connections
   - Click "New service connection"
   - Select "Docker Registry"
   - Registry type: "Azure Container Registry"
   - Select your subscription and ACR
   - Service connection name: `ACR-Connection`
   - Click "Save"

### Step 16: Create Azure Pipeline Variables

1. **Go to Pipelines → Library**
2. **Create Variable Group: `ProductCatalog-Variables`**
   - `ACR_NAME`: Your ACR name (e.g., `productcatalogacr`)
   - `ACR_LOGIN_SERVER`: Your ACR login server
   - `AKS_CLUSTER_NAME`: Your AKS cluster name
   - `RESOURCE_GROUP`: Your resource group name
   - `GITOPS_REPO_URL`: URL of your GitOps repository
   - `GITOPS_REPO_BRANCH`: `main` or `master`
   - `NAMESPACE`: `product-catalog`

### Step 17: Create Azure Pipeline YAML Files

Create pipeline files for each service in `.azure-pipelines/` directory:

#### Product Service Pipeline (`.azure-pipelines/product-service-pipeline.yml`)

```yaml
trigger:
  branches:
    include:
      - main
      - develop
  paths:
    include:
      - product-service/*
      - .azure-pipelines/product-service-pipeline.yml

pool:
  name: productagent

variables:
  - group: ProductCatalog-Variables
  - name: serviceName
    value: 'product-service'
  - name: dockerfilePath
    value: 'product-service/Dockerfile'
  - name: imageTag
    value: '$(Build.BuildId)'

stages:
  - stage: Build
    displayName: 'Build and Test'
    jobs:
      - job: BuildJob
        displayName: 'Build Docker Image'
        steps:
          - task: NodeTool@0
            inputs:
              versionSpec: '18.x'
            displayName: 'Install Node.js'

          - script: |
              cd product-service
              npm ci
              npm run lint || true
              npm test || true
            displayName: 'Run Tests'

          - task: Docker@2
            displayName: 'Build and Push to ACR'
            inputs:
              containerRegistry: 'ACR-Connection'
              repository: '$(serviceName)'
              command: 'buildAndPush'
              Dockerfile: '$(dockerfilePath)'
              tags: |
                $(imageTag)
                latest

  - stage: UpdateGitOps
    displayName: 'Update GitOps Repository'
    dependsOn: Build
    condition: succeeded()
    jobs:
      - job: UpdateManifests
        displayName: 'Update Kubernetes Manifests'
        steps:
          - checkout: self
          
          - script: |
              git clone https://$(System.AccessToken)@dev.azure.com/$(System.TeamFoundationCollectionUri | replace('https://', '') | replace('http://', ''))/$(System.TeamProject)/_git/product-catalog-gitops
              cd product-catalog-gitops
              
              # Update image tag in deployment.yaml
              sed -i "s|image:.*$(serviceName).*|image: $(ACR_LOGIN_SERVER)/$(serviceName):$(imageTag)|g" product-service/deployment.yaml
              
              # Commit and push
              git config user.email "azure-pipelines@devops.com"
              git config user.name "Azure Pipelines"
              git add .
              git commit -m "Update $(serviceName) image to $(imageTag) [skip ci]"
              git push origin main
            displayName: 'Update and Push Manifests'
            env:
              GIT_TERMINAL_PROMPT: 0
```

#### Ratings Service Pipeline (`.azure-pipelines/ratings-service-pipeline.yml`)

```yaml
trigger:
  branches:
    include:
      - main
      - develop
  paths:
    include:
      - ratings-service/*
      - .azure-pipelines/ratings-service-pipeline.yml

pool:
  name: productagent

variables:
  - group: ProductCatalog-Variables
  - name: serviceName
    value: 'ratings-service'
  - name: dockerfilePath
    value: 'ratings-service/Dockerfile'
  - name: imageTag
    value: '$(Build.BuildId)'

stages:
  - stage: Build
    displayName: 'Build and Test'
    jobs:
      - job: BuildJob
        displayName: 'Build Docker Image'
        steps:
          - task: NodeTool@0
            inputs:
              versionSpec: '18.x'
            displayName: 'Install Node.js'

          - script: |
              cd ratings-service
              npm ci
              npm run lint || true
              npm test || true
            displayName: 'Run Tests'

          - task: Docker@2
            displayName: 'Build and Push to ACR'
            inputs:
              containerRegistry: 'ACR-Connection'
              repository: '$(serviceName)'
              command: 'buildAndPush'
              Dockerfile: '$(dockerfilePath)'
              tags: |
                $(imageTag)
                latest

  - stage: UpdateGitOps
    displayName: 'Update GitOps Repository'
    dependsOn: Build
    condition: succeeded()
    jobs:
      - job: UpdateManifests
        displayName: 'Update Kubernetes Manifests'
        steps:
          - checkout: self
          
          - script: |
              git clone https://$(System.AccessToken)@dev.azure.com/$(System.TeamFoundationCollectionUri | replace('https://', '') | replace('http://', ''))/$(System.TeamProject)/_git/product-catalog-gitops
              cd product-catalog-gitops
              
              # Update image tag in deployment.yaml
              sed -i "s|image:.*$(serviceName).*|image: $(ACR_LOGIN_SERVER)/$(serviceName):$(imageTag)|g" ratings-service/deployment.yaml
              
              # Commit and push
              git config user.email "azure-pipelines@devops.com"
              git config user.name "Azure Pipelines"
              git add .
              git commit -m "Update $(serviceName) image to $(imageTag) [skip ci]"
              git push origin main
            displayName: 'Update and Push Manifests'
            env:
              GIT_TERMINAL_PROMPT: 0
```

#### Worker Service Pipeline (`.azure-pipelines/worker-service-pipeline.yml`)

```yaml
trigger:
  branches:
    include:
      - main
      - develop
  paths:
    include:
      - worker-service/*
      - .azure-pipelines/worker-service-pipeline.yml

pool:
  name: productagent

variables:
  - group: ProductCatalog-Variables
  - name: serviceName
    value: 'worker-service'
  - name: dockerfilePath
    value: 'worker-service/Dockerfile'
  - name: imageTag
    value: '$(Build.BuildId)'

stages:
  - stage: Build
    displayName: 'Build and Test'
    jobs:
      - job: BuildJob
        displayName: 'Build Docker Image'
        steps:
          - task: NodeTool@0
            inputs:
              versionSpec: '18.x'
            displayName: 'Install Node.js'

          - script: |
              cd worker-service
              npm ci
              npm test || true
            displayName: 'Run Tests'

          - task: Docker@2
            displayName: 'Build and Push to ACR'
            inputs:
              containerRegistry: 'ACR-Connection'
              repository: '$(serviceName)'
              command: 'buildAndPush'
              Dockerfile: '$(dockerfilePath)'
              tags: |
                $(imageTag)
                latest

  - stage: UpdateGitOps
    displayName: 'Update GitOps Repository'
    dependsOn: Build
    condition: succeeded()
    jobs:
      - job: UpdateManifests
        displayName: 'Update Kubernetes Manifests'
        steps:
          - checkout: self
          
          - script: |
              git clone https://$(System.AccessToken)@devops.azure.com/$(System.TeamFoundationCollectionUri | replace('https://', '') | replace('http://', ''))/$(System.TeamProject)/_git/product-catalog-gitops
              cd product-catalog-gitops
              
              # Update image tag in deployment.yaml
              sed -i "s|image:.*$(serviceName).*|image: $(ACR_LOGIN_SERVER)/$(serviceName):$(imageTag)|g" worker-service/deployment.yaml
              
              # Commit and push
              git config user.email "azure-pipelines@devops.com"
              git config user.name "Azure Pipelines"
              git add .
              git commit -m "Update $(serviceName) image to $(imageTag) [skip ci]"
              git push origin main
            displayName: 'Update and Push Manifests'
            env:
              GIT_TERMINAL_PROMPT: 0
```

#### Frontend Pipeline (`.azure-pipelines/frontend-pipeline.yml`)

```yaml
trigger:
  branches:
    include:
      - main
      - develop
  paths:
    include:
      - frontend/*
      - .azure-pipelines/frontend-pipeline.yml

pool:
  name: productagent

variables:
  - group: ProductCatalog-Variables
  - name: serviceName
    value: 'product-catalog-frontend'
  - name: dockerfilePath
    value: 'frontend/Dockerfile'
  - name: imageTag
    value: '$(Build.BuildId)'

stages:
  - stage: Build
    displayName: 'Build and Test'
    jobs:
      - job: BuildJob
        displayName: 'Build Docker Image'
        steps:
          - task: NodeTool@0
            inputs:
              versionSpec: '18.x'
            displayName: 'Install Node.js'

          - script: |
              cd frontend
              npm ci
              npm test || true
            displayName: 'Run Tests'

          - task: Docker@2
            displayName: 'Build and Push to ACR'
            inputs:
              containerRegistry: 'ACR-Connection'
              repository: '$(serviceName)'
              command: 'buildAndPush'
              Dockerfile: '$(dockerfilePath)'
              tags: |
                $(imageTag)
                latest

  - stage: UpdateGitOps
    displayName: 'Update GitOps Repository'
    dependsOn: Build
    condition: succeeded()
    jobs:
      - job: UpdateManifests
        displayName: 'Update Kubernetes Manifests'
        steps:
          - checkout: self
          
          - script: |
              git clone https://$(System.AccessToken)@dev.azure.com/$(System.TeamFoundationCollectionUri | replace('https://', '') | replace('http://', ''))/$(System.TeamProject)/_git/product-catalog-gitops
              cd product-catalog-gitops
              
              # Update image tag in deployment.yaml
              sed -i "s|image:.*frontend.*|image: $(ACR_LOGIN_SERVER)/$(serviceName):$(imageTag)|g" frontend/deployment.yaml
              
              # Commit and push
              git config user.email "azure-pipelines@devops.com"
              git config user.name "Azure Pipelines"
              git add .
              git commit -m "Update $(serviceName) image to $(imageTag) [skip ci]"
              git push origin main
            displayName: 'Update and Push Manifests'
            env:
              GIT_TERMINAL_PROMPT: 0
```

### Step 13: Create Pipelines in Azure DevOps

1. **For each pipeline file:**
   - Go to Pipelines → New Pipeline
   - Select "Azure Repos Git"
   - Select your repository
   - Select "Existing Azure Pipelines YAML file"
   - Choose the appropriate pipeline file
   - Click "Run"

2. **Grant Permissions:**
   - When prompted, authorize the pipeline to access the repository
   - Grant access to the variable group

---

## Kubernetes Manifests Update for GitOps

### Step 14: Prepare GitOps Repository Structure

In your `product-catalog-gitops` repository, create the following structure:

```
product-catalog-gitops/
├── base/
│   ├── mongodb/
│   │   ├── statefulset.yaml
│   │   └── service.yaml
│   ├── redis/
│   │   ├── deployment.yaml
│   │   └── service.yaml
│   ├── product-service/
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   └── configmap.yaml
│   ├── ratings-service/
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   └── configmap.yaml
│   ├── worker-service/
│   │   ├── deployment.yaml
│   │   └── configmap.yaml
│   └── frontend/
│       ├── deployment.yaml
│       └── service.yaml
└── kustomization.yaml
```

### Step 15: Update Kubernetes Manifests for ACR

Update all deployment files to use ACR image references:

**Example: `product-service/deployment.yaml`**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: product-service
  namespace: product-catalog
spec:
  replicas: 2
  selector:
    matchLabels:
      app: product-service
  template:
    metadata:
      labels:
        app: product-service
    spec:
      imagePullSecrets:
      - name: acr-secret
      containers:
      - name: product-service
        image: YOUR_ACR_LOGIN_SERVER/product-service:latest  # This will be updated by pipeline
        imagePullPolicy: Always
        ports:
        - containerPort: 5000
        env:
        - name: PORT
          value: "5000"
        - name: NODE_ENV
          value: "production"
        - name: MONGO_URI
          value: "mongodb://mongodb:27017/products"
        - name: LOG_LEVEL
          value: "info"
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 5000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 5000
          initialDelaySeconds: 10
          periodSeconds: 5
```

**Important:** Replace `YOUR_ACR_LOGIN_SERVER` with your actual ACR login server (e.g., `productcatalogacr.azurecr.io`).

### Step 16: Create Kustomization File

Create `kustomization.yaml` in the GitOps repository root:

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: product-catalog

resources:
  - base/mongodb/statefulset.yaml
  - base/mongodb/service.yaml
  - base/redis/deployment.yaml
  - base/redis/service.yaml
  - base/product-service/deployment.yaml
  - base/product-service/service.yaml
  - base/product-service/configmap.yaml
  - base/ratings-service/deployment.yaml
  - base/ratings-service/service.yaml
  - base/ratings-service/configmap.yaml
  - base/worker-service/deployment.yaml
  - base/worker-service/configmap.yaml
  - base/frontend/deployment.yaml
  - base/frontend/service.yaml

images:
  - name: YOUR_ACR_LOGIN_SERVER/product-service
    newTag: latest
  - name: YOUR_ACR_LOGIN_SERVER/ratings-service
    newTag: latest
  - name: YOUR_ACR_LOGIN_SERVER/worker-service
    newTag: latest
  - name: YOUR_ACR_LOGIN_SERVER/product-catalog-frontend
    newTag: latest
```

---

## ArgoCD Application Configuration

### Step 17: Configure ArgoCD Repository Access

```bash
# Add GitOps repository to ArgoCD
argocd repo add https://dev.azure.com/{org}/{project}/_git/product-catalog-gitops \
  --type git \
  --username {username} \
  --password {PAT} \
  --name product-catalog-gitops

# Or use SSH (if configured)
# argocd repo add git@ssh.dev.azure.com:v3/{org}/{project}/product-catalog-gitops \
#   --name product-catalog-gitops
```

**Note:** Create a Personal Access Token (PAT) in Azure DevOps with "Code (read)" permissions.

### Step 18: Create ArgoCD Application

#### Option A: Using ArgoCD CLI

```bash
# Create ArgoCD application
argocd app create product-catalog-app \
  --repo https://dev.azure.com/{org}/{project}/_git/product-catalog-gitops \
  --path . \
  --dest-server https://kubernetes.default.svc \
  --dest-namespace product-catalog \
  --sync-policy automated \
  --auto-prune \
  --self-heal \
  --revision main
```

#### Option B: Using YAML Manifest

Create `argocd-application.yaml`:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: product-catalog-app
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: default
  source:
    repoURL: https://dev.azure.com/{org}/{project}/_git/product-catalog-gitops
    targetRevision: main
    path: .
    # If using private repo, add credentials
    # helm:
    #   valueFiles:
    #     - values.yaml
  destination:
    server: https://kubernetes.default.svc
    namespace: product-catalog
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
      allowEmpty: false
    syncOptions:
      - CreateNamespace=true
    retry:
      limit: 5
      backoff:
        duration: 5s
        factor: 2
        maxDuration: 3m
```

Apply the manifest:

```bash
kubectl apply -f argocd-application.yaml
```

### Step 19: Configure ArgoCD Image Updater (Optional but Recommended)

ArgoCD Image Updater automatically updates image tags when new images are pushed to ACR.

```bash
# Install ArgoCD Image Updater
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj-labs/argocd-image-updater/stable/manifests/install.yaml

# Create annotation in deployment manifests for auto-update
# Add to each deployment:
# annotations:
#   argocd-image-updater.argoproj.io/image-list: product-service=YOUR_ACR/product-service
#   argocd-image-updater.argoproj.io/write-back-method: git
#   argocd-image-updater.argoproj.io/git-branch: main
```

---

## Deployment and Verification

### Step 20: Deploy Infrastructure Services (MongoDB and Redis)

```bash
# Deploy MongoDB
kubectl apply -f base/mongodb/statefulset.yaml
kubectl apply -f base/mongodb/service.yaml

# Deploy Redis
kubectl apply -f base/redis/deployment.yaml
kubectl apply -f base/redis/service.yaml

# Wait for services to be ready
kubectl wait --for=condition=ready pod -l app=mongodb -n product-catalog --timeout=300s
kubectl wait --for=condition=ready pod -l app=redis -n product-catalog --timeout=300s
```

### Step 21: Sync ArgoCD Application

```bash
# Check application status
argocd app get product-catalog-app

# Sync application manually (if not automated)
argocd app sync product-catalog-app

# Watch sync progress
argocd app wait product-catalog-app
```

### Step 22: Verify Deployment

```bash
# Check all pods
kubectl get pods -n product-catalog

# Check services
kubectl get svc -n product-catalog

# Check deployments
kubectl get deployments -n product-catalog

# View logs
kubectl logs -f deployment/product-service -n product-catalog
kubectl logs -f deployment/ratings-service -n product-catalog
kubectl logs -f deployment/worker-service -n product-catalog
kubectl logs -f deployment/frontend -n product-catalog
```

### Step 23: Expose Frontend Service

```bash
# Create LoadBalancer service for frontend
kubectl expose deployment frontend \
  --type=LoadBalancer \
  --port=80 \
  --target-port=80 \
  --name=frontend-lb \
  -n product-catalog

# Get external IP
kubectl get svc frontend-lb -n product-catalog

# Or create Ingress
kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: product-catalog-ingress
  namespace: product-catalog
  annotations:
    kubernetes.io/ingress.class: nginx
spec:
  rules:
  - host: product-catalog.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: frontend
            port:
              number: 80
EOF
```

### Step 24: Access the Application

1. **Get Frontend URL:**
   ```bash
   FRONTEND_IP=$(kubectl get svc frontend-lb -n product-catalog -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
   echo "Frontend URL: http://$FRONTEND_IP"
   ```

2. **Access ArgoCD UI:**
   ```bash
   ARGOCD_IP=$(kubectl get svc argocd-server -n argocd -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
   echo "ArgoCD UI: http://$ARGOCD_IP"
   ```

3. **Test API Endpoints:**
   ```bash
   # Get product service IP
   PRODUCT_SVC=$(kubectl get svc product-service -n product-catalog -o jsonpath='{.spec.clusterIP}')
   
   # Test health endpoint
   kubectl run curl-test --image=curlimages/curl --rm -it --restart=Never -- \
     curl http://$PRODUCT_SVC:5000/health
   ```

---

## Troubleshooting

### Common Issues and Solutions

#### 1. Pipeline Fails to Push to ACR

**Issue:** Authentication errors when pushing to ACR

**Solution:**
```bash
# Verify service connection in Azure DevOps
# Check ACR admin credentials are enabled
az acr update --name $ACR_NAME --admin-enabled true
```

#### 2. ArgoCD Cannot Access Git Repository

**Issue:** ArgoCD shows "repository not accessible"

**Solution:**
```bash
# Verify repository URL and credentials
argocd repo list

# Test repository access
argocd repo get product-catalog-gitops

# Update credentials if needed
argocd repo update product-catalog-gitops \
  --username {username} \
  --password {PAT}
```

#### 3. Pods Stuck in ImagePullBackOff

**Issue:** Pods cannot pull images from ACR

**Solution:**
```bash
# Verify ACR secret exists
kubectl get secret acr-secret -n product-catalog

# Recreate secret if needed
kubectl create secret docker-registry acr-secret \
  --docker-server=$ACR_LOGIN_SERVER \
  --docker-username=$ACR_USERNAME \
  --docker-password=$ACR_PASSWORD \
  --namespace=product-catalog \
  --dry-run=client -o yaml | kubectl apply -f -

# Verify AKS has ACR access
az aks check-acr \
  --name $AKS_CLUSTER_NAME \
  --resource-group $RESOURCE_GROUP \
  --acr $ACR_NAME
```

#### 4. ArgoCD Application Out of Sync

**Issue:** Application shows as "OutOfSync"

**Solution:**
```bash
# Check application details
argocd app get product-catalog-app

# View diff
argocd app diff product-catalog-app

# Force sync
argocd app sync product-catalog-app --force
```

#### 5. Services Cannot Connect to MongoDB/Redis

**Issue:** Connection refused errors

**Solution:**
```bash
# Verify services are running
kubectl get pods -n product-catalog

# Check service endpoints
kubectl get endpoints -n product-catalog

# Verify DNS resolution
kubectl run dns-test --image=busybox --rm -it --restart=Never -- \
  nslookup mongodb.product-catalog.svc.cluster.local
```

#### 6. Pipeline Cannot Update GitOps Repository

**Issue:** Git push fails in pipeline

**Solution:**
- Ensure pipeline has "Contribute" permission on GitOps repository
- Verify System.AccessToken is available
- Check branch protection rules

#### 7. Self-Hosted Agent Not Picking Up Jobs

**Issue:** Agent shows as online but pipelines don't run on it

**Solution:**
```bash
# On the VM, check agent service status
sudo ~/myagent/svc.sh status

# Restart agent service
sudo ~/myagent/svc.sh stop
sudo ~/myagent/svc.sh start

# Check agent logs
sudo ~/myagent/svc.sh check

# Verify agent is in correct pool
# In Azure DevOps: Agent pools → productagent → verify agent is listed
```

**Verify Pipeline Configuration:**
- Ensure pipeline YAML has: `pool: name: productagent`
- Not: `pool: vmImage: 'ubuntu-latest'`

#### 8. Docker Build Fails on Self-Hosted Agent

**Issue:** Docker commands fail in pipeline

**Solution:**
```bash
# On the VM, verify Docker is running
sudo systemctl status docker

# Ensure user is in docker group
sudo usermod -aG docker $USER
# Log out and back in for group change to take effect

# Test Docker
docker run hello-world

# Verify Docker daemon socket permissions
ls -la /var/run/docker.sock
```

#### 9. Agent Goes Offline

**Issue:** Agent shows as offline in Azure DevOps

**Solution:**
```bash
# On the VM, check agent service
sudo ~/myagent/svc.sh status

# If stopped, restart it
sudo ~/myagent/svc.sh start

# Check network connectivity
ping dev.azure.com

# Verify agent configuration
cd ~/myagent
./config.sh --help
# Re-run config if needed: ./config.sh --remove, then ./config.sh
```

---

## Summary Workflow

### Complete CI/CD Flow

1. **Developer pushes code** to Azure Repos
2. **Azure Pipeline triggers** on code change
3. **Pipeline runs tests** on agent VM
4. **Pipeline builds Docker image** and pushes to ACR with build ID tag
5. **Pipeline updates GitOps repository** with new image tag
6. **ArgoCD detects change** in GitOps repository
7. **ArgoCD syncs** Kubernetes manifests to AKS
8. **Kubernetes pulls new image** from ACR
9. **Application updates** with zero downtime (rolling update)

### Key Commands Reference

```bash
# View ArgoCD applications
argocd app list

# Sync application
argocd app sync product-catalog-app

# View application status
argocd app get product-catalog-app

# View application logs
argocd app logs product-catalog-app

# Rollback application
argocd app rollback product-catalog-app <revision>

# View ACR images
az acr repository list --name $ACR_NAME
az acr repository show-tags --name $ACR_NAME --repository product-service

# View AKS cluster info
az aks show --name $AKS_CLUSTER_NAME --resource-group $RESOURCE_GROUP

# Scale deployment
kubectl scale deployment product-service --replicas=5 -n product-catalog
```

---

## Next Steps

1. **Set up monitoring** with Azure Monitor
2. **Configure alerts** for application health
3. **Implement blue-green deployments** for zero-downtime
4. **Set up backup** for MongoDB
5. **Configure SSL/TLS** certificates
6. **Implement network policies** for security
7. **Set up cost monitoring** and optimization

---

## Additional Resources

- [Azure Kubernetes Service Documentation](https://docs.microsoft.com/azure/aks/)
- [Azure Container Registry Documentation](https://docs.microsoft.com/azure/container-registry/)
- [Azure Pipelines Documentation](https://docs.microsoft.com/azure/devops/pipelines/)
- [ArgoCD Documentation](https://argo-cd.readthedocs.io/)
- [Kubernetes Documentation](https://kubernetes.io/docs/)






---
## ••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••
## ••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••

# Azure Migration Guide: UI-Based Setup (Azure Portal & Azure DevOps)

## ••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••
## ••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••





This section provides step-by-step instructions for migrating the Product Catalog App to Azure using the **Azure Portal UI** and **Azure DevOps web interface** instead of command-line tools.

---

## Table of Contents (UI Version)

1. [Prerequisites](#prerequisites-ui)
2. [Azure Resource Group Setup (Portal)](#azure-resource-group-setup-portal)
3. [Azure Container Registry Setup (Portal)](#azure-container-registry-setup-portal)
4. [Azure Kubernetes Service Setup (Portal)](#azure-kubernetes-service-setup-portal)
5. [Azure VM Self-Hosted Agent Setup (Portal)](#azure-vm-self-hosted-agent-setup-portal)
6. [Azure DevOps Project Setup](#azure-devops-project-setup)
7. [Import Repository to Azure Repos](#import-repository-to-azure-repos)
8. [Create Service Connection for ACR](#create-service-connection-for-acr)
9. [Create Variable Groups](#create-variable-groups)
10. [Create Azure Pipelines (UI)](#create-azure-pipelines-ui)
11. [Set Up GitOps Repository](#set-up-gitops-repository)
12. [Install ArgoCD via UI](#install-argocd-via-ui)
13. [Configure ArgoCD Application (UI)](#configure-argocd-application-ui)
14. [Deploy and Verify (UI)](#deploy-and-verify-ui)

---

## Prerequisites (UI)

### Required Access
- Azure Subscription with Owner or Contributor role
- Azure DevOps organization access
- Web browser (Chrome, Edge, or Firefox recommended)

### Required Information to Note
- Your Azure subscription ID
- Desired resource group name (e.g., `product-catalog-rg`)
- Desired ACR name (must be globally unique, lowercase, alphanumeric)
- Desired AKS cluster name
- Azure region (e.g., `East US`, `West Europe`)

---

## Azure Resource Group Setup (Portal)

### Step 1: Create Resource Group via Azure Portal

1. **Navigate to Azure Portal**
   - Go to https://portal.azure.com
   - Sign in with your Azure account

2. **Create Resource Group**
   - Click on **"Resource groups"** in the left navigation menu (or search for it)
   - Click **"+ Create"** button at the top
   - Fill in the form:
     - **Subscription**: Select your subscription
     - **Resource group**: Enter `product-catalog-rg` (or your preferred name)
     - **Region**: Select your preferred region (e.g., `East US`)
   - Click **"Review + create"**
   - Review the settings and click **"Create"**
   - Wait for the deployment to complete (notification will appear)

3. **Verify Resource Group**
   - Navigate to **Resource groups**
   - Click on your newly created resource group
   - Note the resource group name for future steps

---

## Azure Container Registry Setup (Portal)

### Step 2: Create Azure Container Registry via Portal

1. **Navigate to Container Registries**
   - In the Azure Portal, click **"+ Create a resource"** (top left)
   - Search for **"Container Registry"**
   - Click **"Create"**

2. **Configure ACR Settings**
   - **Subscription**: Select your subscription
   - **Resource group**: Select `product-catalog-rg` (created in Step 1)
   - **Registry name**: Enter a globally unique name (e.g., `productacr2025`)
     - Must be lowercase, alphanumeric only
     - Must be globally unique across all Azure
   - **Location**: Select same region as resource group
   - **SKU**: Select **"Basic"** (or Standard/Premium based on needs)
   - **Admin user**: Enable **"Enable admin user"** (toggle ON)
     - This allows username/password authentication

3. **Review and Create**
   - Click **"Review + create"**
   - Review all settings
   - Click **"Create"**
   - Wait for deployment to complete (2-3 minutes)

4. **Get ACR Credentials**
   - Once deployment completes, click **"Go to resource"**
   - In the left menu, click **"Access keys"**
   - **Note down the following:**
     - **Login server**: (e.g., `productcatalogacr2024.azurecr.io`)
     - **Username**: (admin username)
     - **Password**: Click **"Show"** next to password and copy it
   - Save these credentials securely (you'll need them later)

---

## Azure Kubernetes Service Setup (Portal)

### Step 3: Create AKS Cluster via Portal

1. **Navigate to Kubernetes Services**
   - In Azure Portal, click **"+ Create a resource"**
   - Search for **"Kubernetes Service"**
   - Click **"Create"**

2. **Configure Basics Tab**
   - **Subscription**: Select your subscription
   - **Resource group**: Select `product-catalog-rg`
   - **Kubernetes cluster name**: Enter `product-catalog-cluster`
   - **Region**: Select same region as resource group
   - **Kubernetes version**: Select latest stable version (e.g., `1.28.x`)
   - **Node size**: Click **"Change size"** and select:
     - **Size**: `Standard_B2s` (2 vCPUs, 4 GB RAM) or larger
     - Click **"Select"**
   - **Scale method**: Select **"Manual"**
   - **Node count**: Set to `3`
   - Click **"Next: Node pools"**

3. **Configure Node Pools Tab**
   - Leave default settings or customize as needed
   - Click **"Next: Access"**

4. **Configure Access Tab**
   - **Authentication method**: Select **"System-assigned managed identity"**
   - **Authorize with Azure Container Registry**: 
     - Toggle **"ON"**
     - Select your ACR from dropdown (e.g., `productcatalogacr2024`)
   - Click **"Next: Networking"**

5. **Configure Networking Tab**
   - **Network configuration**: Select **"Azure CNI"** (or **"kubenet"** for simpler setup)
   - Leave other settings as default
   - Click **"Next: Integrations"**

6. **Configure Integrations Tab**
   - **Container monitoring**: Enable **"Enable Container insights"** (recommended)
   - Click **"Next: Tags"**

7. **Configure Tags Tab (Optional)**
   - Add tags if needed (e.g., `Environment: Production`, `Project: ProductCatalog`)
   - Click **"Next: Review + create"**

8. **Review and Create**
   - Review all settings
   - Click **"Create"**
   - Wait for deployment (10-15 minutes)
   - You'll see a notification when complete

9. **Get AKS Credentials**
   - Once deployment completes, click **"Go to resource"**
   - In the left menu, click **"Connect"**
   - You'll see commands to connect - we'll use these later
   - **Note the cluster name and resource group**

---

## Azure VM Self-Hosted Agent Setup (Portal)

### Step 5: Create Azure VM for Self-Hosted Agent via Portal

1. **Navigate to Virtual Machines**
   - In Azure Portal, click **"+ Create a resource"**
   - Search for **"Virtual machine"**
   - Click **"Create"**

2. **Configure Basics Tab**
   - **Subscription**: Select your subscription
   - **Resource group**: Select `product-catalog-rg`
   - **Virtual machine name**: Enter `productagentvm`
   - **Region**: Select same region as resource group
   - **Availability options**: Select **"No infrastructure redundancy required"**
   - **Image**: Select **"Ubuntu Server 22.04 LTS"**
   - **Size**: Click **"See all sizes"** and select:
     - **Size**: `Standard_D2s_v3` (2 vCPUs, 8 GB RAM)
     - Click **"Select"**
   - **Authentication type**: Select **"SSH public key"**
   - **Username**: Enter `azureuser` (or your preferred username)
   - **SSH public key source**: Select **"Generate new key pair"** or **"Use existing key stored in Azure"**
   - **Key pair name**: Enter `devops-agent-key` (if generating new)
   - Click **"Next: Disks"**

3. **Configure Disks Tab**
   - **OS disk type**: Select **"Premium SSD"** (or Standard SSD for cost savings)
   - **Disk size**: Keep default (64 GB) or increase if needed
   - Click **"Next: Networking"**

4. **Configure Networking Tab**
   - **Virtual network**: Create new or use existing
   - **Subnet**: Use default
   - **Public IP**: Ensure **"Create new"** is selected
   - **NIC network security group**: Select **"Basic"**
   - **Public inbound ports**: Select **"Allow selected ports"**
   - **Select inbound ports**: Check **"SSH (22)"**
   - Click **"Next: Management"**

5. **Configure Management Tab**
   - **Boot diagnostics**: Enable (recommended)
   - **OS guest diagnostics**: Optional
   - Click **"Next: Monitoring"**

6. **Configure Monitoring Tab**
   - Leave defaults or configure as needed
   - Click **"Next: Advanced"**

7. **Configure Advanced Tab**
   - Leave defaults
   - Click **"Next: Tags"**

8. **Configure Tags Tab (Optional)**
   - Add tags if needed (e.g., `Purpose: productagent`, `Environment: Production`)
   - Click **"Next: Review + create"**

9. **Review and Create**
   - Review all settings
   - If you selected "Generate new key pair", **download the private key** when prompted
   - Click **"Create"**
   - Wait for deployment (2-3 minutes)

10. **Get VM Connection Details**
    - Once deployment completes, click **"Go to resource"**
    - Note the **Public IP address**
    - Note the **Private IP address** (for internal use)

### Step 6: Connect to VM and Install Required Software

1. **Connect via SSH**
   ```bash
   # If you generated a new key, use the downloaded private key
   ssh -i ~/Downloads/devops-agent-key.pem azureuser@<VM_PUBLIC_IP>
   
   # Or if using existing key
   ssh azureuser@<VM_PUBLIC_IP>
   ```

2. **Install Docker**
   ```bash
   # Update system
   sudo apt-get update && sudo apt-get upgrade -y
   
   # Install Docker
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   sudo usermod -aG docker $USER
   
   # Start Docker service
   sudo systemctl enable docker
   sudo systemctl start docker
   
   # Verify Docker
   docker --version
   docker run hello-world
   ```

3. **Install Node.js 18.x**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   
   # Verify installation
   node --version
   npm --version
   ```

4. **Install Git and Build Tools**
   ```bash
   sudo apt-get install -y git build-essential
   
   # Verify
   git --version
   ```

5. **Install Azure CLI (Optional)**
   ```bash
   curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
   az --version
   ```
   
6. Install Trivy 
```
wget https://github.com/aquasecurity/trivy/releases/download/v0.67.2/trivy_0.67.2_Linux-64bit.deb
sudo dpkg -i trivy_0.67.2_Linux-64bit.deb

```

# *********************************************
### Step 7: Create Agent Pool in Azure DevOps

1. **Navigate to Agent Pools**
   - In Azure DevOps, go to your project
   - Click **"Project settings"** (gear icon at bottom left)
   - Under **"Pipelines"**, click **"Agent pools"**

2. **Create New Agent Pool**
   - Click **"+ New agent pool"**
   - **Pool type**: Select **"Self-hosted"**
   - **Name**: Enter `productagent`
   - **Auto-provision agents in Azure Pipelines**: Leave unchecked
   - Click **"Create"**

### Step 8: Install and Configure Agent on VM

1. **Get Agent Download Instructions**
   - In Azure DevOps, go to **Agent pools** → `productagent`
   - Click **"New agent"**
   - Select **"Linux"** tab
   - You'll see download and configuration instructions

2. **On the VM, Download Agent**
   ```bash
   # Create agent directory
   mkdir -p ~/myagent && cd ~/myagent
   
   # Download agent (use the latest version URL from Azure DevOps)
   # Example URL (check Azure DevOps for latest version):
   curl -o agent.tar.gz https://vstsagentpackage.azureedge.net/agent/3.227.2/vsts-agent-linux-x64-3.227.2.tar.gz
   
   # Extract
   tar zxvf agent.tar.gz
   ```

3. **Create Personal Access Token (PAT)**
   - In Azure DevOps, click your profile icon (top right)
   - Click **"Personal access tokens"**
   - Click **"+ New Token"**
   - **Name**: `DevOps Agent Token`
   - **Organization**: Select your organization
   - **Expiration**: Set appropriate expiration (e.g., 90 days)
   - **Scopes**: Select **"Custom defined"**
     - Under **"Agent Pools"**, check **"Read & manage"**
   - Click **"Create"**
   - **Copy the token** (you won't see it again!)

4. **Configure Agent on VM**
   ```bash
   # Run configuration script
   ./config.sh
   ```
   
   When prompted, enter:
   - **Enter server URL**: `https://dev.azure.com/fredrsam`
   - **Enter authentication type**: Type `PAT` and press Enter
   - **Enter personal access token**: Paste the PAT you created
   - **Enter agent pool**: Type `productagent` and press Enter
   - **Enter agent name**: Type `productagentvm` (or any name)
   - **Enter work folder**: Press Enter for default (`_work`)
   - **Enter Perform an unzip for tasks for each step**: Press Enter for default (N)
   - **Enter run agent as service**: Type `Y` and press Enter
   - **Enter User account to use for the service**: Press Enter for default (root)
   - **Enter whether to prevent service starting immediately after configuration**: Press Enter for default (N)

5. **Verify Agent Installation**
   - The agent should start automatically
   - Check status:
     ```bash
     sudo ./svc.sh status
     ```
   - View logs:
     ```bash
     sudo ./svc.sh check
     ```

6. **Verify Agent in Azure DevOps**
   - Go back to Azure DevOps → **Agent pools** → `productagent`
   - You should see your agent listed
   - Status should show **"Online"** (green circle)
   - If offline, check the VM logs and ensure the service is running

### Step 9: Configure VM for ACR Access (Optional)

If you need the agent to push to ACR:

```bash
# Login to Azure (if Azure CLI installed)
az login

# Login to ACR
az acr login --name productacr2025 YOUR_ACR_NAME  #  productacr2025

# Or configure Docker to use ACR credentials
# (ACR credentials will be provided by pipeline service connection)
```

---

**********************************************
# Create CI/CD  PIPELINE on Azure Devops 
**********************************************
## Azure DevOps Project Setup

### Step 10: Create Azure DevOps Organization and Project

1. **Navigate to Azure DevOps**
   - Go to https://dev.azure.com
   - Sign in with your Azure account

2. **Create Organization (if needed)**
   - If you don't have an organization, click **"Create new organization"**
   - Enter organization name (e.g., `product-catalog-org`)
   - Select region
   - Click **"Continue"**

3. **Create Project**
   - Click **"New project"** (or **"+ New project"**)
   - Fill in the form:
     - **Project name**: `product-catalog-project`
     - **Visibility**: Select **"Private"** (or **"Public"**)
     - **Version control**: Select **"Git"**
     - **Work item process**: Select **"Agile"**
   - Click **"Create"**
   - Wait for project creation (30 seconds)

4. **Navigate to Project**
   - Once created, you'll be redirected to the project dashboard
   - Bookmark this page for easy access

---

## Import Repository to Azure Repos

### Step 11: Import GitHub Repository to Azure Repos

1. **Navigate to Repos**
   - In your Azure DevOps project, click **"Repos"** in the left menu
   - Click **"Files"**

2. **Import Repository**
   - Click the **"..."** menu (three dots) next to the repository name
   - Select **"Import repository"**
   - In the import dialog:
     - **Source type**: Select **"Git"**
     - **Clone URL**: Enter `https://github.com/fred4impact/Product-catalog-app.git`
     - **Name**: Keep default or change to `Product-catalog-app`
   - Click **"Import"**
   - Wait for import to complete (1-2 minutes)

3. **Verify Import**
   - Once complete, you should see all files from the GitHub repository
   - Browse the repository structure to verify

---

## Create Service Connection for ACR

### Step 12: Create Docker Registry Service Connection

1. **Navigate to Service Connections**
   - In Azure DevOps project, click **"Project settings"** (gear icon at bottom left)
   - Under **"Pipelines"**, click **"Service connections"**
   - Click **"+ New service connection"**

2. **Select Docker Registry**
   - In the service connection type list, select **"Docker Registry"**
   - Click **"Next"**

3. **Configure Docker Registry**
   - **Registry type**: Select **"Azure Container Registry"**
   - **Azure subscription**: Select your subscription
   - **Azure container registry**: Select your ACR (e.g., `productcatalogacr2024`)
   - **Service connection name**: Enter `ACR-Connection`
   - **Description**: (Optional) Enter description
   - **Grant access permission to all pipelines**: Check this box
   - Click **"Save"**

4. **Verify Service Connection**
   - You should see `ACR-Connection` in the service connections list
   - Status should show as **"Verified"**

---

## Create Variable Groups

### Step 13: Create Variable Group for Pipelines

1. **Navigate to Library**
   - In Azure DevOps project, click **"Pipelines"** in left menu
   - Click **"Library"**

2. **Create Variable Group**
   - Click **"+ Variable group"**
   - **Variable group name**: Enter `ProductCatalog-Variables`

3. **Add Variables**
   - Click **"+ Add"** for each variable:
   
   **Variable 1:**
   - **Name**: `ACR_NAME`
   - **Value**: Your ACR name (e.g., `productcatalogacr2024`)
   - **Keep this value secret**: Unchecked
   
   **Variable 2:**
   - **Name**: `ACR_LOGIN_SERVER`
   - **Value**: Your ACR login server (e.g., `productcatalogacr2024.azurecr.io`)
   - **Keep this value secret**: Unchecked
   
   **Variable 3:**
   - **Name**: `AKS_CLUSTER_NAME`
   - **Value**: `product-catalog-aks`
   - **Keep this value secret**: Unchecked
   
   **Variable 4:**
   - **Name**: `RESOURCE_GROUP`
   - **Value**: `product-catalog-rg`
   - **Keep this value secret**: Unchecked
   
   **Variable 5:**
   - **Name**: `GITOPS_REPO_URL`
   - **Value**: (We'll set this after creating GitOps repo)
   - **Keep this value secret**: Unchecked
   
   **Variable 6:**
   - **Name**: `GITOPS_REPO_BRANCH`
   - **Value**: `main`
   - **Keep this value secret**: Unchecked
   
   **Variable 7:**
   - **Name**: `NAMESPACE`
   - **Value**: `product-catalog`
   - **Keep this value secret**: Unchecked

4. **Save Variable Group**
   - Click **"Save"** at the top
   - **Allow access to all pipelines**: Check this box
   - Click **"Save"** again

---

## Create Azure Pipelines (UI)

### Step 14: Create Pipeline for Product Service

**Important**: When creating pipelines, ensure they use the `productagent` pool instead of Microsoft-hosted agents.

1. **Navigate to Pipelines**
   - In Azure DevOps project, click **"Pipelines"** in left menu
   - Click **"Pipelines"**

2. **Create New Pipeline**
   - Click **"Create Pipeline"** (or **"New pipeline"**)

3. **Select Source**
   - **Where is your code?**: Select **"Azure Repos Git"**
   - Select your repository: `Product-catalog-app`
   - Click **"Continue"**

4. **Configure Pipeline**
   - **Select a template**: Click **"Starter pipeline"** (or **"Empty job"**)
   - This opens the YAML editor

5. **Replace YAML Content**
   - Delete the default YAML
   - Copy and paste the Product Service pipeline YAML from the CLI section (Step 17)
   - **Important**: Ensure the pipeline uses `pool: name: productagent` (not `vmImage: 'ubuntu-latest'`)
   - **Important**: Update the GitOps repository URL in the pipeline YAML
   - Click **"Save"**

6. **Save Pipeline**
   - Click **"Save"** button
   - **Save as**: Enter `product-service-pipeline`
   - **Commit message**: "Add product service pipeline"
   - **Commit directly to main branch**: Select this
   - Click **"Save"**

7. **Repeat for Other Services**
   - Repeat steps 1-6 for:
     - **Ratings Service** → `ratings-service-pipeline`
     - **Worker Service** → `worker-service-pipeline`
     - **Frontend** → `frontend-pipeline`

### Step 15: Configure Pipeline Permissions

1. **Grant Permissions**
   - When you run a pipeline for the first time, you may see a permission prompt
   - Click **"View"** or **"Permit"** to grant access
   - Grant access to:
     - Variable group: `ProductCatalog-Variables`
     - Service connection: `ACR-Connection`
     - Repository: `Product-catalog-app`

---

## Set Up GitOps Repository

### Step 16: Create GitOps Repository in Azure Repos

1. **Create New Repository**
   - In Azure DevOps project, click **"Repos"** → **"Files"**
   - Click the repository dropdown (shows current repo name)
   - Click **"New repository"**
   - **Repository name**: `product-catalog-gitops`
   - **Type**: Git
   - Click **"Create"**

2. **Initialize Repository**
   - Click **"Initialize"** to add a README
   - Or click **"Clone"** to clone it locally

3. **Upload Kubernetes Manifests**
   - You can either:
     - **Option A**: Upload files via web UI
       - Click **"Upload file(s)"**
       - Upload your Kubernetes manifest files
     - **Option B**: Clone and push via Git
       - Copy the clone URL
       - Clone locally: `git clone <clone-url>`
       - Copy Kubernetes manifests from your project
       - Commit and push

4. **Update Image References**
   - Edit each deployment YAML file
   - Replace `YOUR_DOCKER_USERNAME/product-service:latest` with:
     - `YOUR_ACR_LOGIN_SERVER/product-service:latest`
   - Example: `productcatalogacr2024.azurecr.io/product-service:latest`
   - Commit changes

5. **Note Repository URL**
   - Copy the repository URL (you'll need it for ArgoCD)
   - Format: `https://dev.azure.com/{org}/{project}/_git/product-catalog-gitops`
   - Update the `GITOPS_REPO_URL` variable in your variable group

---

## Install ArgoCD via UI

You can install ArgoCD using either **Azure Cloud Shell** or your **VM** (productagentvm). Both methods work the same way.

### Option 1: Using Azure Cloud Shell

1. **Open Azure Cloud Shell**
   - In Azure Portal, click the **Cloud Shell icon** (top right, `>_` symbol)
   - If prompted, select **"Bash"** (not PowerShell)
   - Wait for Cloud Shell to initialize

2. **Connect to AKS Cluster**
   - In Cloud Shell, run:
     ```bash
     az aks get-credentials --resource-group product-catalog-rg --name product-catalog-cluster 
     ```
   - Verify connection:
     ```bash
     kubectl get nodes
     ```

3. **Install ArgoCD**
   - Create namespace:
     ```bash
     kubectl create namespace argocd
     ```
   - Install ArgoCD:
     ```bash
     kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
     ```
   - Wait for pods (this takes 2-3 minutes):
     ```bash
     kubectl get pods -n argocd -w
     ```
   - Press `Ctrl+C` when all pods show `Running`

4. **Expose ArgoCD Server**
   
   **Option A: Using Azure Portal**
   - In Azure Portal, navigate to your AKS cluster
   - Click **"Services and ingresses"** in left menu
   - Click **"argocd-server"** service (in `argocd` namespace)
   - Click **"Edit"**
   - Change **"Service type"** from `ClusterIP` to `LoadBalancer`
   - Click **"Save"**
   - Wait 2-3 minutes for external IP to be assigned
   
   **Option B: Using kubectl Command Line**
   ```bash
   # Patch the service to LoadBalancer
   kubectl patch svc argocd-server -n argocd -p '{"spec": {"type": "LoadBalancer"}}'
   
   # Wait for external IP (watch until EXTERNAL-IP shows an IP, not <pending>)
   kubectl get svc argocd-server -n argocd -w
   # Press Ctrl+C when IP is assigned (takes 2-3 minutes)
   
   # Get the external IP address
   kubectl get svc argocd-server -n argocd -o jsonpath='{.status.loadBalancer.ingress[0].ip}'
   echo
   ```

5. **Get ArgoCD Admin Password**
   - In Cloud Shell, run:
     ```bash
     kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d && echo
     ```
   - **Copy this password** - you'll need it to login

6. **Access ArgoCD UI**
   - In Azure Portal, go to **Services and ingresses**
   - Find `argocd-server` service
   - Copy the **External IP** address
   - Open browser: `http://<external-ip>`
   - Login with:
     - **Username**: `admin`
     - **Password**: (the password you copied)

---

### Option 2: Using Your VM (productagentvm)

**Yes, you can perform all these steps on your VM!** Since your VM already has `kubectl` and Azure CLI installed, you can SSH into it and run the same commands.

1. **SSH into Your VM**
   ```bash
   # Get your VM's public IP from Azure Portal
   # Navigate to: Virtual machines → productagentvm → Overview → Public IP address
   
   ssh azureuser@<VM_PUBLIC_IP>
   # Or if you used a different username, use that instead
   ```

2. **Login to Azure (if not already logged in)**
   ```bash
   az login
   # This will open a browser window for authentication
   # Or use: az login --use-device-code
   ```

3. **Connect to AKS Cluster**
   ```bash
   az aks get-credentials --resource-group product-catalog-rg --name product-catalog-cluster 
   ```
   - Verify connection:
     ```bash
     kubectl get nodes
     ```
   - You should see your AKS nodes listed

4. **Install ArgoCD**
   - Create namespace:
     ```bash
     kubectl create namespace argocd
     ```
   - Install ArgoCD:
     ```bash
     kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
     ```
   - Wait for pods (this takes 2-3 minutes):
     ```bash
     kubectl get pods -n argocd -w
     ```
   - Press `Ctrl+C` when all pods show `Running`

5. **Expose ArgoCD Server**

   **Option A: Using Azure Portal (Easier)**
   - In Azure Portal, navigate to your AKS cluster
   - Click **"Services and ingresses"** in left menu
   - Click **"argocd-server"** service (in `argocd` namespace)
   - Click **"Edit"**
   - Change **"Service type"** from `ClusterIP` to `LoadBalancer`
   - Click **"Save"**
   - Wait 2-3 minutes for external IP to be assigned
   
   **Option B: Using kubectl Command Line (Recommended)**
   
   Follow these steps to change the service type using command line:
   
   **Step 1: Check current service type**
   ```bash
   kubectl get svc argocd-server -n argocd
   ```
   You should see `TYPE: ClusterIP` (or `ClusterIP` in the output)
   
   **Step 2: Patch the service to LoadBalancer**
   ```bash
   kubectl patch svc argocd-server -n argocd -p '{"spec": {"type": "LoadBalancer"}}'
   ```
   Expected output: `service/argocd-server patched`
   
   **Step 3: Verify the change**
   ```bash
   kubectl get svc argocd-server -n argocd
   ```
   You should now see `TYPE: LoadBalancer` in the output
   
   **Step 4: Wait for external IP assignment**
   ```bash
   # Watch the service until EXTERNAL-IP is assigned (not <pending>)
   kubectl get svc argocd-server -n argocd -w
   ```
   - Press `Ctrl+C` when you see an IP address (not `<pending>`)
   - This typically takes 2-3 minutes
   
   **Step 5: Get the external IP address**
   ```bash
   # Get just the external IP
   kubectl get svc argocd-server -n argocd -o jsonpath='{.status.loadBalancer.ingress[0].ip}'
   echo
   ```
   # A HERE NOW 
   Or view full service details:
   ```bash
   kubectl get svc argocd-server -n argocd
   ```
   Copy the **EXTERNAL-IP** value from the output

6. **Get ArgoCD Admin Password**
   - On your VM, run:
     ```bash
     kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d && echo
     ```
   - **Copy this password** - you'll need it to login

7. **Access ArgoCD UI** 
   - Get the external IP (from Azure Portal or kubectl):
     ```bash
     kubectl get svc argocd-server -n argocd
     ```
   - Copy the **EXTERNAL-IP** address
   - Open browser on your local machine: `http://4.249.91.213`
   - Login with:
     - **Username**: `admin`
     - **Password**: (the password you copied)

**Note:** If you prefer to stay on the VM, you can also use port-forwarding to access ArgoCD UI:
```bash
# On your VM, run:
kubectl port-forward svc/argocd-server -n argocd 8080:443

# Then on your local machine, access: http://<VM_PUBLIC_IP>:8080
# (You may need to open port 8080 in VM's NSG for this to work)
```

---

## Configure ArgoCD Application (UI)

### Step 18: Configure ArgoCD Repository Access

1. **Login to ArgoCD UI**
   - Open ArgoCD UI (from Step 11)
   - Login with admin credentials

2. **Add Repository**
   - Click **"Settings"** (gear icon) in left menu
   - Click **"Repositories"**
   - Click **"Connect Repo"** (or **"+ CONNECT REPO"**)

3. **Configure Repository Connection**
   - **Connection method**: Select **"HTTPS"**
   - **Repository URL**: Enter your GitOps repository URL
     - Format: `https://fredrsam@dev.azure.com/fredrsam/product-catalog-project/_git/product-catalog-project`
   - **Type**: Select **"git"**
   - **Username**: Enter your Azure DevOps username
   - **Password**: Enter a **Personal Access Token (PAT)**
     - To create PAT: Azure DevOps → User Settings → Personal Access Tokens
     - Create token with **"Code (read)"** permission
   - Click **"Connect"**

4. **Verify Repository**
   - You should see the repository in the list
   - Status should show as **"Successful"**

### Step 19: Create ArgoCD Application via UI

1. **Navigate to Applications**
   - In ArgoCD UI, click **"Applications"** in left menu
   - Click **"+ NEW APP"** (or **"Create Application"**)

2. **Configure General Settings**
   - **Application Name**: `product-catalog-app`
   - **Project Name**: `default`
   - **Sync Policy**: Select **"Automatic"**
   - **Self Heal**: Check this box
   - **Prune Resources**: Check this box

3. **Configure Source**

   **Your Repository Structure:**
   ```
   product-catalog-project/
   └── kubernetes/              # (or root directory)
       ├── frontend/
       │   └── deployment.yml
       ├── product-service/
       │   └── deployment.yml
       ├── ratings-service/
       │   └── deployment.yml
       └── worker-service/
           └── deployment.yml
   ```

   **Choose ONE of the following options:**

   **Option A: Single Application (All Services Together) - Recommended for Start**
   - **Repository URL**: Select your GitOps repository from dropdown
   - **Revision**: Enter `main` (or your branch name)
   - **Path**: Enter `kubernetes` (or `.` if manifests are in root)
   - **Directory Recurse**: ✅ **Check this box** (enables recursive scanning)
   - This will deploy all services from all subdirectories in one application

   **Option B: Multiple Applications (One Per Service) - Better for Granular Control**
   
   Create separate applications for each service:
   
   **For Frontend:**
   - **Application Name**: `product-catalog-frontend`
   - **Repository URL**: Select your GitOps repository
   - **Revision**: `main`
   - **Path**: `kubernetes/frontend` (or `frontend` if in root)
   - **Directory Recurse**: Unchecked
   
   **For Product Service:**
   - **Application Name**: `product-catalog-product-service`
   - **Repository URL**: Select your GitOps repository
   - **Revision**: `main`
   - **Path**: `kubernetes/product-service` (or `product-service` if in root)
   - **Directory Recurse**: Unchecked
   
   **For Ratings Service:**
   - **Application Name**: `product-catalog-ratings-service`
   - **Repository URL**: Select your GitOps repository
   - **Revision**: `main`
   - **Path**: `kubernetes/ratings-service` (or `ratings-service` if in root)
   - **Directory Recurse**: Unchecked
   
   **For Worker Service:**
   - **Application Name**: `product-catalog-worker-service`
   - **Repository URL**: Select your GitOps repository
   - **Revision**: `main`
   - **Path**: `kubernetes/worker-service` (or `worker-service` if in root)
   - **Directory Recurse**: Unchecked

   **Option C: Using Kustomize (If you have kustomization.yaml)**
   - **Repository URL**: Select your GitOps repository
   - **Revision**: `main`
   - **Path**: `kubernetes` (path to directory containing kustomization.yaml)
   - **Directory Recurse**: Unchecked
   - **Helm**: Unchecked
   - **Kustomize**: ✅ **Check this box**

4. **Configure Destination**
   - **Cluster URL**: Select **"https://kubernetes.default.svc"**
   - **Namespace**: Enter `product-catalog`
   - **Namespace should be created automatically**: Check this box

5. **Configure Sync Options**
   - Click **"Edit"** next to Sync Options
   - Enable:
     - **"Create Namespace"**
     - **"Prune Last"**
     - **"Apply Out of Sync Only"**
   - Click **"Save"**

6. **Create Application**
   - Click **"Create"** at the top
   - The application will start syncing automatically

7. **Monitor Sync**
   - You'll see the application appear in the Applications list
   - Click on the application to see sync status
   - Wait for all resources to show as **"Synced"** (green)

---

### Step 19.5: Fix Namespace Mismatch (Important!)

**Problem:** ArgoCD is configured to deploy to `product-catalog` namespace, but your YAML files have `namespace: default`.

**Impact:**
- ArgoCD tries to deploy to `product-catalog` but YAML specifies `default`
- Resources might be created in wrong namespace
- ACR secret might be in different namespace than resources
- Can cause sync issues and confusion

**Solution: Choose One Approach**

**Option A: Move Everything to `product-catalog` Namespace (Recommended)**

1. **Create ACR Secret in `product-catalog` namespace:**
   ```bash
   ACR_NAME="productacr2025"
   RESOURCE_GROUP="product-catalog-rg"
   NAMESPACE="product-catalog"
   
   ACR_LOGIN_SERVER=$(az acr show --name $ACR_NAME --resource-group $RESOURCE_GROUP --query loginServer -o tsv)
   ACR_USERNAME=$(az acr credential show --name $ACR_NAME --resource-group $RESOURCE_GROUP --query username -o tsv)
   ACR_PASSWORD=$(az acr credential show --name $ACR_NAME --resource-group $RESOURCE_GROUP --query passwords[0].value -o tsv)
   
   kubectl create namespace $NAMESPACE
   kubectl create secret docker-registry acr-secret \
     --namespace $NAMESPACE \
     --docker-server=$ACR_LOGIN_SERVER \
     --docker-username=$ACR_USERNAME \
     --docker-password=$ACR_PASSWORD \
     --docker-email=your-email@example.com
   ```

2. **Update All YAML Files:**
   ```bash
   cd product-catalog-app/kubernetes
   find . -name "*.yaml" -type f -exec sed -i '' 's/namespace: default/namespace: product-catalog/g' {} \;
   ```

3. **Commit and Push:**
   ```bash
   git add kubernetes/
   git commit -m "Update namespace to product-catalog"
   git push origin main
   ```

4. **ArgoCD will auto-sync** to `product-catalog` namespace

**Option B: Change ArgoCD to Use `default` Namespace**

1. **Update ArgoCD Application:**
   - ArgoCD UI → Your Application → Edit → Change `destination.namespace` to `default`
   - OR via CLI:
     ```bash
     kubectl patch application <app-name> -n argocd --type merge \
       -p '{"spec":{"destination":{"namespace":"default"}}}'
     ```

2. **Keep ACR secret in `default` namespace** (already there)

**Recommendation:** Use Option A (move to `product-catalog`) - better organization and matches ArgoCD config.

See `NAMESPACE-MISMATCH-FIX.md` for detailed guide.

---

### Step 20: Configure ACR ImagePullSecret (Fix Image Pull Errors)

**Problem:** If you see errors like:
```
ErrImagePull: failed to pull and unpack image "productacr2025.azurecr.io/frontend:43": 
failed to resolve reference "productacr2025.azurecr.io/frontend:43": 
failed to authorize: failed to fetch anonymous token: 
unexpected status from GET request to https://productacr2025.azurecr.io/oauth2/token: 401 Unauthorized
```

This means Kubernetes cannot authenticate to Azure Container Registry (ACR) to pull images. You need to create an ImagePullSecret.

**Solution: Create ACR Credentials Secret in Kubernetes**

#### Option A: Using Azure CLI (Recommended - Easiest)

**From your VM or Cloud Shell:**

1. **Login to Azure (if not already logged in)**
   ```bash
   az login
   ```

2. **Get ACR credentials and create secret**
   ```bash
   # Set your variables
   ACR_NAME="productacr2025"  # Replace with your ACR name
   RESOURCE_GROUP="product-catalog-rg"
   NAMESPACE="product-catalog"  # Your application namespace
   
AKS_CLUSTER_NAME="product-catalog-cluster"   
RESOURCE_GROUP="product-catalog-rg" 

az aks get-credentials \
  --resource-group $RESOURCE_GROUP \
  --name $AKS_CLUSTER_NAME \
  --overwrite-existing

 # Set your variables
ACR_NAME="productacr2025"
RESOURCE_GROUP="product-catalog-rg"
NAMESPACE="product-catalog"

# Get ACR credentials
ACR_LOGIN_SERVER=$(az acr show --name $ACR_NAME --resource-group $RESOURCE_GROUP --query loginServer -o tsv)
ACR_USERNAME=$(az acr credential show --name $ACR_NAME --resource-group $RESOURCE_GROUP --query username -o tsv)
ACR_PASSWORD=$(az acr credential show --name $ACR_NAME --resource-group $RESOURCE_GROUP --query passwords[0].value -o tsv)

# Create the ImagePullSecret
kubectl create secret docker-registry acr-secret \
  --namespace $NAMESPACE \
  --docker-server=$ACR_LOGIN_SERVER \
  --docker-username=$ACR_USERNAME \
  --docker-password=$ACR_PASSWORD \
  --docker-email=your-fredrsam@gmail.com 

# Simple namespace creation (will error if exists, but that's okay)
kubectl create namespace product-catalog 2>/dev/null || echo "Namespace already exists"

   # Get ACR login server
   ACR_LOGIN_SERVER=$(az acr show --name $ACR_NAME --resource-group $RESOURCE_GROUP --query loginServer -o tsv)
   echo "ACR Login Server: $ACR_LOGIN_SERVER"
   
   # Get ACR admin credentials
   ACR_USERNAME=$(az acr credential show --name $ACR_NAME --resource-group $RESOURCE_GROUP --query username -o tsv)
   ACR_PASSWORD=$(az acr credential show --name $ACR_NAME --resource-group $RESOURCE_GROUP --query passwords[0].value -o tsv)
   
   # Create namespace if it doesn't exist
   kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -
   
   # Create the ImagePullSecret
   kubectl create secret docker-registry acr-secret \
     --namespace $NAMESPACE \
     --docker-server=$ACR_LOGIN_SERVER \
     --docker-username=$ACR_USERNAME \
     --docker-password=$ACR_PASSWORD \
     --docker-email=fredrsam@gmail.com
   ```

3. **Verify the secret was created**
   ```bash
   kubectl get secret acr-secret -n $NAMESPACE
   ```

4. **Update your deployments to use the secret**

   You have two options:

   **Option 1: Add to each deployment YAML (Recommended)**
   
   Edit your deployment files (e.g., `kubernetes/frontend/deployment.yaml`) and add `imagePullSecrets`:
   
   ```yaml
   apiVersion: apps/v1
   kind: Deployment
   metadata:
     name: frontend
     namespace: product-catalog
   spec:
     replicas: 2
     template:
       spec:
         imagePullSecrets:
         - name: acr-secret  # Add this
         containers:
         - name: frontend
           image: productacr2025.azurecr.io/frontend:43
           # ... rest of config
   ```
   
   Then commit and push to your GitOps repository. ArgoCD will automatically sync the changes.

   **Option 2: Patch existing deployments (Quick fix)**
   
   ```bash
   # Patch frontend deployment
   kubectl patch deployment frontend -n product-catalog -p '{"spec":{"template":{"spec":{"imagePullSecrets":[{"name":"acr-secret"}]}}}}'
   
   # Patch product-service deployment
   kubectl patch deployment product-service -n product-catalog -p '{"spec":{"template":{"spec":{"imagePullSecrets":[{"name":"acr-secret"}]}}}}'
   
   # Patch ratings-service deployment
   kubectl patch deployment ratings-service -n product-catalog -p '{"spec":{"template":{"spec":{"imagePullSecrets":[{"name":"acr-secret"}]}}}}'
   
   # Patch worker-service deployment
   kubectl patch deployment worker-service -n product-catalog -p '{"spec":{"template":{"spec":{"imagePullSecrets":[{"name":"acr-secret"}]}}}}'
   ```

5. **Restart pods to use the new secret**
   ```bash
   # Delete pods to force recreation with new secret
   kubectl delete pods -n product-catalog --all
   
   # Or restart specific deployment
   kubectl rollout restart deployment/frontend -n product-catalog
   kubectl rollout restart deployment/product-service -n product-catalog
   kubectl rollout restart deployment/ratings-service -n product-catalog
   kubectl rollout restart deployment/worker-service -n product-catalog
   ```

6. **Verify pods are running**
   ```bash
   kubectl get pods -n product-catalog
   # Wait for all pods to show "Running" status
   ```

#### Option B: Using Service Principal (For Production)

If you're using a service principal instead of admin credentials:

```bash
# Set variables
ACR_NAME="productacr2025"
RESOURCE_GROUP="product-catalog-rg"
NAMESPACE="product-catalog"
SERVICE_PRINCIPAL_NAME="acr-service-principal"

# Create service principal (if not exists)
SP_PASSWORD=$(az ad sp create-for-rbac --name $SERVICE_PRINCIPAL_NAME --skip-assignment --query password -o tsv)
SP_APP_ID=$(az ad sp show --id http://$SERVICE_PRINCIPAL_NAME --query appId -o tsv)

# Get ACR resource ID
ACR_ID=$(az acr show --name $ACR_NAME --resource-group $RESOURCE_GROUP --query id -o tsv)

# Assign AcrPull role to service principal
az role assignment create --assignee $SP_APP_ID --scope $ACR_ID --role AcrPull

# Create secret using service principal
ACR_LOGIN_SERVER=$(az acr show --name $ACR_NAME --resource-group $RESOURCE_GROUP --query loginServer -o tsv)

kubectl create secret docker-registry acr-secret \
  --namespace $NAMESPACE \
  --docker-server=$ACR_LOGIN_SERVER \
  --docker-username=$SP_APP_ID \
  --docker-password=$SP_PASSWORD \
  --docker-email=your-email@example.com
```

#### Option C: Using Managed Identity (Best for AKS)

If your AKS cluster has a managed identity with ACR access:

```bash
# Enable ACR integration (if not already done)
az aks update -n product-catalog-cluster -g product-catalog-rg --attach-acr productacr2025

# This automatically allows AKS to pull from ACR without secrets
# You may still need to add imagePullSecrets if using specific configurations
```

#### Verify the Fix

1. **Check pod status**
   ```bash
   kubectl get pods -n product-catalog
   kubectl describe pod <pod-name> -n product-catalog
   ```

2. **Check pod events**
   ```bash
   kubectl get events -n product-catalog --sort-by='.lastTimestamp'
   ```

3. **Verify image pull**
   ```bash
   # Check if pods are in Running state
   kubectl get pods -n product-catalog -o wide
   ```

#### Troubleshooting

**If pods still fail to pull images:**

1. **Verify secret exists and is correct**
   ```bash
   kubectl get secret acr-secret -n product-catalog -o yaml
   ```

2. **Test ACR login manually**
   ```bash
   az acr login --name productacr2025
   docker pull productacr2025.azurecr.io/frontend:43
   ```

3. **Check if image exists in ACR**
   ```bash
   az acr repository list --name productacr2025
   az acr repository show-tags --name productacr2025 --repository frontend
   ```

4. **Verify deployment has imagePullSecrets**
   ```bash
   kubectl get deployment frontend -n product-catalog -o yaml | grep -A 5 imagePullSecrets
   ```

5. **Check ACR admin user is enabled**
   ```bash
   az acr update --name productacr2025 --admin-enabled true
   ```

---

### Understanding the Path Configuration

**If your repository structure is:**
```
product-catalog-project/
└── kubernetes/
    ├── frontend/
    │   ├── deployment.yaml
    │   └── service.yaml
    ├── product-service/
    │   ├── deployment.yaml
    │   └── service.yaml
    └── ratings-service/
        ├── deployment.yaml
        └── service.yaml
```

**For Option A (Single Application with Directory Recurse):**
- **Path**: `kubernetes`
- **Directory Recurse**: ✅ Enabled
- ArgoCD will scan all subdirectories and deploy all YAML files it finds

**For Option B (Multiple Applications):**
- **Frontend Path**: `kubernetes/frontend`
- **Product Service Path**: `kubernetes/product-service`
- **Ratings Service Path**: `kubernetes/ratings-service`
- Each application only syncs its specific directory

**If your manifests are in the root (not in a `kubernetes` folder):**
- Use paths like: `frontend`, `product-service`, etc. (without `kubernetes/` prefix)

---

### Creating Multiple Applications via Command Line (Alternative)

If you prefer using `kubectl` or `argocd` CLI instead of the UI:

**1. Create Frontend Application:**
```bash
argocd app create product-catalog-frontend \
  --repo https://fredrsam@dev.azure.com/fredrsam/product-catalog-project/_git/product-catalog-project \
  --path kubernetes/frontend \
  --dest-server https://kubernetes.default.svc \
  --dest-namespace product-catalog \
  --sync-policy automated \
  --self-heal \
  --auto-prune
```

**2. Create Product Service Application:**
```bash
argocd app create product-catalog-product-service \
  --repo https://fredrsam@dev.azure.com/fredrsam/product-catalog-project/_git/product-catalog-project \
  --path kubernetes/product-service \
  --dest-server https://kubernetes.default.svc \
  --dest-namespace product-catalog \
  --sync-policy automated \
  --self-heal \
  --auto-prune
```

**3. Create Ratings Service Application:**
```bash
argocd app create product-catalog-ratings-service \
  --repo https://fredrsam@dev.azure.com/fredrsam/product-catalog-project/_git/product-catalog-project \
  --path kubernetes/ratings-service \
  --dest-server https://kubernetes.default.svc \
  --dest-namespace product-catalog \
  --sync-policy automated \
  --self-heal \
  --auto-prune
```

**4. Create Worker Service Application:**
```bash
argocd app create product-catalog-worker-service \
  --repo https://fredrsam@dev.azure.com/fredrsam/product-catalog-project/_git/product-catalog-project \
  --path kubernetes/worker-service \
  --dest-server https://kubernetes.default.svc \
  --dest-namespace product-catalog \
  --sync-policy automated \
  --self-heal \
  --auto-prune
```

**Or create using YAML manifests:**

Create `argocd-apps.yaml`:
```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: product-catalog-frontend
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://fredrsam@dev.azure.com/fredrsam/product-catalog-project/_git/product-catalog-project
    targetRevision: main
    path: kubernetes/frontend
  destination:
    server: https://kubernetes.default.svc
    namespace: product-catalog
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
---
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: product-catalog-product-service
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://fredrsam@dev.azure.com/fredrsam/product-catalog-project/_git/product-catalog-project
    targetRevision: main
    path: kubernetes/product-service
  destination:
    server: https://kubernetes.default.svc
    namespace: product-catalog
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
---
# Add similar blocks for ratings-service and worker-service
```

Then apply:
```bash
kubectl apply -f argocd-apps.yaml
```

---

### Recommendation

- **Start with Option A** (Single Application with Directory Recurse) - simpler to set up
- **Move to Option B** (Multiple Applications) if you need:
  - Independent sync policies per service
  - Different deployment schedules
  - Better visibility into individual service status
  - Ability to sync/rollback services independently

---

## Deploy and Verify (UI)

### Step 21: Deploy Infrastructure Services

1. **Check MongoDB and Redis**
   - In ArgoCD UI, click on `product-catalog-app`
   - Verify MongoDB and Redis are deployed
   - If not in GitOps repo, deploy manually:
     - In Azure Portal Cloud Shell, apply manifests:
       ```bash
       kubectl apply -f <path-to-mongodb-manifests> -n product-catalog
       kubectl apply -f <path-to-redis-manifests> -n product-catalog
       ```

2. **Verify Pods in Azure Portal**
   - Navigate to your AKS cluster in Azure Portal
   - Click **"Workloads"** in left menu
   - Select namespace: `product-catalog`
   - Verify all pods are running:
     - `mongodb-*`
     - `redis-*`
     - `product-service-*`
     - `ratings-service-*`
     - `worker-service-*`
     - `frontend-*`

### Step 22: Expose Frontend Service

1. **Create LoadBalancer Service**
   - In Azure Portal, navigate to AKS cluster
   - Click **"Services and ingresses"**
   - Click **"+ Create"** → **"Service"**
   - **Name**: `frontend-lb`
   - **Namespace**: `product-catalog`
   - **Service type**: Select **"LoadBalancer"**
   - **Port**: `80`
   - **Target port**: `80`
   - **Selector**: 
     - **app**: `frontend`
   - Click **"Create"**
   - Wait 2-3 minutes for external IP

2. **Get Frontend URL**
   - Once LoadBalancer is created, note the **External IP**
   - Access frontend at: `http://<external-ip>`
   http://10.244.0.214:80

### Step 23: Verify Application

1. **Check Application Status in ArgoCD**
   - In ArgoCD UI, verify `product-catalog-app` shows:
     - **Status**: `Healthy`
     - **Sync Status**: `Synced`
     - All resources should be green

2. **View Logs in Azure Portal**
   - Navigate to AKS cluster → **"Workloads"**
   - Click on a deployment (e.g., `product-service`)
   - Click on a pod
   - Click **"View live logs"** to see real-time logs

3. **Test API Endpoints**
   - Use Azure Portal Cloud Shell or your local terminal:
     ```bash
     # Port forward to test locally
     kubectl port-forward svc/product-service -n product-catalog 5000:5000
     # In another terminal
     curl http://localhost:5000/health
     ```

4. **Access Frontend**
   - Open browser: `http://<frontend-external-ip>`
   - Verify the application loads correctly

---

### Step 24: Fix Frontend Connection Issue (Error: "Error connecting to product service")

**Problem:** Frontend shows "Error connecting to product service" and "No products found" because:
- Frontend is trying to connect to `http://localhost:5000` (default)
- **Important:** Since React runs in the browser (client-side), it cannot use Kubernetes internal service names like `product-service:5000`
- The browser makes requests from the user's machine, not from inside the Kubernetes cluster
- React environment variables are baked into the build at build-time, not runtime

**For AKS/Azure Kubernetes Service:**
- You need to expose backend services externally (LoadBalancer or Ingress)
- OR use relative URLs if using Ingress with path-based routing
- OR use the same external IP/domain for both frontend and backend services

**Diagnosis:**
```bash
# Check frontend pod logs (for default namespace)
kubectl logs -n default deployment/frontend --tail=50

# Note: If you see PHP exploit attempts in logs, those are bot/scanner traffic (ignore them)
# Look for actual application errors or connection failures

# Check if product-service is accessible
kubectl get svc product-service -n default

# Test product-service directly
kubectl port-forward svc/product-service -n default 5000:5000
# In another terminal: curl http://localhost:5000/api/products

# Check product-service logs for incoming requests
kubectl logs -n default deployment/product-service --tail=50

# Check if frontend is making requests (check browser console or network tab)
# The frontend React app runs in the browser, so errors appear in browser console, not pod logs
```

**Understanding Frontend Logs:**
- Frontend pod logs show nginx access logs (HTTP requests)
- Bot/scanner traffic (PHP exploits) is normal - ignore it
- **Real errors appear in browser console**, not pod logs
- To see frontend connection errors, check browser DevTools (F12) → Console tab

**Common Browser Console Errors:**

1. **Connection Refused:**
   ```
   GET http://localhost:5000/api/products net::ERR_CONNECTION_REFUSED
   ```
   - Frontend is using `localhost` which doesn't work in Kubernetes
   - Build args weren't passed during Docker build
   - **Fix:** Rebuild with correct build arguments

2. **CORS Error:**
   ```
   Cross-Origin Request Blocked: CORS header 'Access-Control-Allow-Origin' missing
   ```
   - Product-service CORS not configured properly
   - Helmet middleware might be blocking CORS
   - **Fix:** Update product-service CORS configuration (see below)

**Note: If `kubectl get deployments` shows nothing but pods are running:**

ArgoCD creates the same Kubernetes resources as `kubectl apply` would. If deployments aren't showing:

1. **Check the correct namespace:**
   ```bash
   # List deployments in product-catalog namespace
   kubectl get deployments -n product-catalog
   
   # List all deployments across all namespaces
   kubectl get deployments --all-namespaces
   
   # Check which namespace your pods are in
   kubectl get pods --all-namespaces | grep frontend
   ```

2. **Verify ArgoCD created the resources:**
   ```bash
   # List ArgoCD applications
   kubectl get applications -n argocd
   
   # Get ArgoCD application details
   kubectl get application <app-name> -n argocd -o yaml
   
   # Check ArgoCD application resources
   argocd app get <app-name>
   ```

3. **Check if resources exist but with different names:**
   ```bash
   # List all resources in namespace
   kubectl get all -n product-catalog
   
   # List deployments specifically
   kubectl get deployments -n product-catalog
   
   # Describe a pod to see which deployment created it
   kubectl describe pod frontend-67bbc4c779-2gkn5 -n product-catalog | grep -i "controlled by"
   ```

4. **If deployments truly don't exist (unlikely if pods are running):**
   - ArgoCD might be using different resource types
   - Check ArgoCD UI to see what resources it created
   - Verify the Git repository has deployment YAML files

**Solution 1: Expose Backend Services and Use External URLs (Recommended for AKS)**

Since the frontend runs in the browser, it needs external URLs. You have three options:

**Option 1A: Use Ingress with Relative URLs (Best for Production)**

If you're using Ingress with path-based routing (e.g., `/api/products` → product-service), use relative URLs:

1. **Update Frontend Pipeline** (`.azure-pipelines/frontend-pipeline.yml`)

   ```yaml
   - task: Docker@2
     displayName: 'Build and Push Frontend to ACR'
     inputs:
       containerRegistry: 'ACR-Connection'
       repository: '$(serviceName)'
       command: 'buildAndPush'
       Dockerfile: '$(dockerfilePath)'
       buildContext: '$(Build.SourcesDirectory)/frontend'
       arguments: |
         --build-arg REACT_APP_PRODUCT_SERVICE_URL=/api/products
         --build-arg REACT_APP_RATINGS_SERVICE_URL=/api/ratings
       tags: |
         $(imageTag)
         latest
   ```

   **Note:** This works if your Ingress routes `/api/products` to product-service and `/api/ratings` to ratings-service.

**Option 1B: Expose Backend Services via LoadBalancer (Simpler for Testing)**

Expose product-service and ratings-service with LoadBalancer services, then use their external IPs:

1. **Expose Product Service:**

   ```bash
   # Create LoadBalancer for product-service
   kubectl expose deployment product-service \
     --type=LoadBalancer \
     --port=5000 \
     --target-port=5000 \
     --name=product-service-lb \
     -n product-catalog
   
   # Get external IP
   PRODUCT_SERVICE_IP=$(kubectl get svc product-service-lb -n product-catalog -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
   echo "Product Service URL: http://$PRODUCT_SERVICE_IP:5000"
   ```

2. **Expose Ratings Service:**

   ```bash
   # Create LoadBalancer for ratings-service
   kubectl expose deployment ratings-service \
     --type=LoadBalancer \
     --port=5001 \
     --target-port=5001 \
     --name=ratings-service-lb \
     -n product-catalog
   
   # Get external IP
   RATINGS_SERVICE_IP=$(kubectl get svc ratings-service-lb -n product-catalog -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
   echo "Ratings Service URL: http://$RATINGS_SERVICE_IP:5001"
   ```

3. **Update Frontend Pipeline** with the external IPs:

   ```yaml
   - task: Docker@2
     displayName: 'Build and Push Frontend to ACR'
     inputs:
       containerRegistry: 'ACR-Connection'
       repository: '$(serviceName)'
       command: 'buildAndPush'
       Dockerfile: '$(dockerfilePath)'
       buildContext: '$(Build.SourcesDirectory)/frontend'
       arguments: |
         --build-arg REACT_APP_PRODUCT_SERVICE_URL=http://$(PRODUCT_SERVICE_IP):5000
         --build-arg REACT_APP_RATINGS_SERVICE_URL=http://$(RATINGS_SERVICE_IP):5001
       tags: |
         $(imageTag)
         latest
   ```

   **Note:** You'll need to set `PRODUCT_SERVICE_IP` and `RATINGS_SERVICE_IP` as pipeline variables after creating the LoadBalancers.

**Option 1C: Use Same Domain with Ingress (Best Practice)**

If using Ingress with a domain name, configure it to route both frontend and APIs:

1. **Create/Update Ingress** (`kubernetes/ingress.yaml`):

   ```yaml
   apiVersion: networking.k8s.io/v1
   kind: Ingress
   metadata:
     name: product-catalog-ingress
     namespace: product-catalog
     annotations:
       nginx.ingress.kubernetes.io/rewrite-target: /
   spec:
     ingressClassName: nginx
     rules:
     - host: your-domain.com  # Or use * for any domain
       http:
         paths:
         - path: /
           pathType: Prefix
           backend:
             service:
               name: frontend
               port:
                 number: 80
         - path: /api/products
           pathType: Prefix
           backend:
             service:
               name: product-service
               port:
                 number: 5000
         - path: /api/ratings
           pathType: Prefix
           backend:
             service:
               name: ratings-service
               port:
                 number: 5001
   ```

2. **Update Frontend Pipeline** to use relative URLs:

   ```yaml
   - task: Docker@2
     displayName: 'Build and Push Frontend to ACR'
     inputs:
       containerRegistry: 'ACR-Connection'
       repository: '$(serviceName)'
       command: 'buildAndPush'
       Dockerfile: '$(dockerfilePath)'
       buildContext: '$(Build.SourcesDirectory)/frontend'
       arguments: |
         --build-arg REACT_APP_PRODUCT_SERVICE_URL=/api/products
         --build-arg REACT_APP_RATINGS_SERVICE_URL=/api/ratings
       tags: |
         $(imageTag)
         latest
   ```

   **Note:** Relative URLs work because the browser will make requests to the same domain as the frontend.

   **OR if using a separate build step:**

   ```yaml
   - task: Docker@2
     displayName: 'Build Frontend Image'
     inputs:
       containerRegistry: 'ACR-Connection'
       repository: '$(serviceName)'
       command: 'build'
       Dockerfile: '$(dockerfilePath)'
       buildContext: '$(Build.SourcesDirectory)/frontend'
       arguments: |
         --build-arg REACT_APP_PRODUCT_SERVICE_URL=/api/products
         --build-arg REACT_APP_RATINGS_SERVICE_URL=/api/ratings
       tags: |
         $(imageTag)
         latest
   
   - task: Docker@2
     displayName: 'Push Frontend Image'
     inputs:
       containerRegistry: 'ACR-Connection'
       repository: '$(serviceName)'
       command: 'push'
       tags: |
         $(imageTag)
         latest
   ```

2. **Verify Dockerfile Accepts Build Args**

   Your `frontend/Dockerfile` should already have (verify it does):
   ```dockerfile
   ARG REACT_APP_PRODUCT_SERVICE_URL=http://localhost:5002
   ARG REACT_APP_RATINGS_SERVICE_URL=http://localhost:5003
   
   ENV REACT_APP_PRODUCT_SERVICE_URL=$REACT_APP_PRODUCT_SERVICE_URL
   ENV REACT_APP_RATINGS_SERVICE_URL=$REACT_APP_RATINGS_SERVICE_URL
   ```

3. **Choose Your Approach:**

   - **Option 1A (Relative URLs)**: Best if using Ingress with path routing - no external IPs needed
   - **Option 1B (LoadBalancer)**: Simplest for testing - each service gets its own external IP
   - **Option 1C (Ingress Domain)**: Best for production - single domain, clean URLs

4. **Trigger Frontend Pipeline**

   - Go to Azure DevOps → Pipelines
   - Run the `frontend-pipeline`
   - Wait for build to complete
   - New image will be pushed to ACR with correct URLs

5. **Update Deployment to Use New Image**

   - ArgoCD will automatically sync if using Image Updater
   - OR manually update deployment YAML with new image tag
   - OR restart deployment to pull latest image:
     ```bash
     kubectl rollout restart deployment/frontend -n product-catalog
     ```

6. **Verify Fix**

   ```bash
   # Check frontend pod is using new image
   kubectl get pods -n product-catalog -l app=frontend -o jsonpath='{.items[0].spec.containers[0].image}'
   
   # Check frontend logs (should not show connection errors)
   kubectl logs -n product-catalog deployment/frontend --tail=20
   
   # Check backend services are accessible
   kubectl get svc -n product-catalog
   
   # Test product-service directly (if using LoadBalancer)
   curl http://<product-service-external-ip>:5000/api/products
   
   # Access frontend in browser
   # Should now show products instead of error
   ```

**Important Notes for AKS:**
- ✅ **Relative URLs** (`/api/products`) work when using Ingress - browser makes requests to same domain
- ❌ **Kubernetes service names** (`product-service:5000`) don't work - browser can't resolve internal DNS
- ✅ **External IPs** work - but each service needs its own LoadBalancer (costs more)
- ✅ **Ingress with domain** is best practice - single entry point, path-based routing

---

**Solution 2: Use Runtime Configuration with Nginx (More Flexible - No Rebuild Needed)**

This approach uses nginx to inject environment variables at runtime, so you don't need to rebuild the image.

**Important for AKS:** Use external URLs or relative paths, not Kubernetes service names.

1. **Create ConfigMap for Frontend Environment Variables**

   **Option A: Using Relative URLs (if using Ingress):**
   ```bash
   # Create ConfigMap with relative URLs
   kubectl create configmap frontend-config \
     --namespace product-catalog \
     --from-literal=REACT_APP_PRODUCT_SERVICE_URL=/api/products \
     --from-literal=REACT_APP_RATINGS_SERVICE_URL=/api/ratings \
     --dry-run=client -o yaml | kubectl apply -f -
   ```

   **Option B: Using External IPs (if using LoadBalancer):**
   ```bash
   # Get external IPs first
   PRODUCT_IP=$(kubectl get svc product-service-lb -n product-catalog -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
   RATINGS_IP=$(kubectl get svc ratings-service-lb -n product-catalog -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
   
   # Create ConfigMap with external URLs
   kubectl create configmap frontend-config \
     --namespace product-catalog \
     --from-literal=REACT_APP_PRODUCT_SERVICE_URL=http://${PRODUCT_IP}:5000 \
     --from-literal=REACT_APP_RATINGS_SERVICE_URL=http://${RATINGS_IP}:5001 \
     --dry-run=client -o yaml | kubectl apply -f -
   ```

2. **Create nginx Configuration Script**

   Create a file `frontend/nginx-runtime-config.sh`:

   ```bash
   #!/bin/sh
   # Replace environment variables in built React app at runtime
   
   # Read environment variables from ConfigMap (mounted as files)
   PRODUCT_SERVICE_URL=${REACT_APP_PRODUCT_SERVICE_URL:-http://product-service:5000}
   RATINGS_SERVICE_URL=${REACT_APP_RATINGS_SERVICE_URL:-http://ratings-service:5001}
   
   # Find and replace in built JavaScript files
   find /usr/share/nginx/html/static/js -name "*.js" -type f -exec sed -i "s|http://localhost:5000|${PRODUCT_SERVICE_URL}|g" {} \;
   find /usr/share/nginx/html/static/js -name "*.js" -type f -exec sed -i "s|http://localhost:5001|${RATINGS_SERVICE_URL}|g" {} \;
   find /usr/share/nginx/html/static/js -name "*.js" -type f -exec sed -i "s|http://localhost:5002|${PRODUCT_SERVICE_URL}|g" {} \;
   find /usr/share/nginx/html/static/js -name "*.js" -type f -exec sed -i "s|http://localhost:5003|${RATINGS_SERVICE_URL}|g" {} \;
   
   # Start nginx
   exec nginx -g "daemon off;"
   ```

3. **Update Frontend Dockerfile** (if using this approach)

   Modify `frontend/Dockerfile` to use the runtime script:

   ```dockerfile
   # Production stage
   FROM nginx:alpine
   
   # Copy built files from builder
   COPY --from=builder /app/build /usr/share/nginx/html
   
   # Copy nginx configuration
   COPY nginx.conf /etc/nginx/conf.d/default.conf
   
   # Copy runtime configuration script
   COPY nginx-runtime-config.sh /docker-entrypoint.d/99-runtime-config.sh
   RUN chmod +x /docker-entrypoint.d/99-runtime-config.sh
   
   # Expose port
   EXPOSE 80
   
   # Start nginx (script will run automatically via docker-entrypoint)
   CMD ["nginx", "-g", "daemon off;"]
   ```

4. **Update Frontend Deployment to Mount ConfigMap**

   Edit `kubernetes/frontend/deployment.yaml`:

   ```yaml
   apiVersion: apps/v1
   kind: Deployment
   metadata:
     name: frontend
     namespace: product-catalog
   spec:
     template:
       spec:
         containers:
         - name: frontend
           image: productacr2025.azurecr.io/product-catalog-frontend:latest
           envFrom:
           - configMapRef:
               name: frontend-config
           # ... rest of config
   ```

5. **Apply Changes**

   ```bash
   # Apply updated deployment
   kubectl apply -f kubernetes/frontend/deployment.yaml
   
   # Or if using ArgoCD, commit and push to GitOps repo
   # ArgoCD will sync automatically
   ```

6. **Restart Frontend Pods**

   ```bash
   kubectl rollout restart deployment/frontend -n product-catalog
   ```

7. **Verify Fix**

   ```bash
   # Check ConfigMap exists
   kubectl get configmap frontend-config -n product-catalog
   
   # Check pod has environment variables
   kubectl exec -n product-catalog deployment/frontend -- env | grep REACT_APP
   
   # Check frontend logs
   kubectl logs -n product-catalog deployment/frontend --tail=20
   ```

---

**IMMEDIATE FIX: Expose Product Service Externally (Quick Solution)**

Since your frontend is trying to connect to `http://localhost:5002/api/products` and getting `ERR_CONNECTION_REFUSED`, you need to expose the product-service externally:

1. **Expose Product Service with LoadBalancer:**
   ```bash
   # Expose product-service
   kubectl expose deployment product-service \
     --type=LoadBalancer \
     --port=5000 \
     --target-port=5000 \
     --name=product-service-lb \
     -n default
   
   # Wait for external IP (takes 2-3 minutes)
   kubectl get svc product-service-lb -n default -w
   ```

2. **Get External IP:**
   ```bash
   PRODUCT_IP=$(kubectl get svc product-service-lb -n default -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
   echo "Product Service URL: http://$PRODUCT_IP:5000"
   ```

3. **Test the External Endpoint:**
   ```bash
   # Test from your local machine
   curl http://$PRODUCT_IP:5000/api/products
   curl http://$PRODUCT_IP:5000/health
   ```

4. **Temporary Fix: Update Frontend to Use External IP (Runtime Config)**
   
   Since rebuilding takes time, you can temporarily patch the frontend to use the external IP:
   
   **Option A: Use ConfigMap with runtime replacement (if you have the nginx script)**
   
   **Option B: Rebuild frontend with correct URL (permanent fix - see Solution 1 below)**

5. **For Permanent Fix:** Rebuild frontend image with the external IP or use Ingress (see Solution 1 below)

---

**Quick Fix: Verify Product Service is Running and Seeded**

Before applying the above solutions, verify the backend is working (for default namespace):

```bash
# Check product-service pod status
kubectl get pods -n default -l app=product-service

# Check product-service logs for seeding
kubectl logs -n default deployment/product-service | grep -i seed

# Test product-service API directly
kubectl port-forward svc/product-service -n default 5000:5000
# In another terminal:
curl http://localhost:5000/api/products

# Check MongoDB connection
kubectl logs -n default deployment/product-service | grep -i mongo

# Check product-service health endpoint
curl http://localhost:5000/health
```

**Check Browser Console for Frontend Errors:**

Since the frontend is a React app running in the browser:
1. Open your frontend URL in browser: `http://<frontend-external-ip>`
2. Press **F12** to open DevTools
3. Go to **Console** tab - look for errors like:
   - `Failed to fetch`
   - `NetworkError`
   - `CORS error`
   - `Error connecting to product service`
4. Go to **Network** tab - check if requests to `/api/products` are:
   - Failing (red)
   - Going to wrong URL (e.g., `localhost:5000`)
   - Getting CORS errors

**Expected Output from Product Service:**
- Should see: `✅ Successfully seeded X new default products` or `✅ All 5 default products already exist`
- API should return products: `{"success": true, "data": [...]}`

---

**Recommendation:**
- **Use Solution 1 Option 1C (Ingress with Relative URLs)** for production - single domain, clean URLs, no external IPs needed
- **Use Solution 1 Option 1B (LoadBalancer)** for quick testing - each service gets external IP
- **Use Solution 2** if you need flexibility to change URLs without rebuilding images
- **Solution 1 Option 1C is best practice** for production AKS deployments

**Key Points for AKS:**
- ❌ **Cannot use:** `http://product-service:5000` (Kubernetes internal DNS - browser can't resolve)
- ✅ **Can use:** `/api/products` (relative URL - works with Ingress path routing)
- ✅ **Can use:** `http://<external-ip>:5000` (external LoadBalancer IP)
- ✅ **Can use:** `http://your-domain.com/api/products` (Ingress with domain)
- 🔑 **Remember:** React apps run in the browser, so they need URLs accessible from the internet, not internal cluster DNS

---

### Step 25: Troubleshoot "No Deployments Found" with ArgoCD

**Problem:** `kubectl get deployments` shows nothing, but pods are running (deployed via ArgoCD)

**Why This Happens:**
- You might be checking the wrong namespace
- ArgoCD creates the same Kubernetes resources as `kubectl apply` would
- Deployments exist if pods are running (pods are created by deployments)

**Solution:**

1. **Check the Correct Namespace:**
   ```bash
   # Your pods show they're running - check which namespace
   kubectl get pods --all-namespaces | grep frontend
   
   # List deployments in the correct namespace (likely product-catalog)
   kubectl get deployments -n product-catalog
   
   # If that doesn't work, try default namespace
   kubectl get deployments -n default
   
   # List all deployments across all namespaces
   kubectl get deployments --all-namespaces
   ```

2. **Verify Resources via ArgoCD:**
   ```bash
   # List ArgoCD applications
   kubectl get applications -n argocd
   
   # Or if ArgoCD is in different namespace
   kubectl get applications --all-namespaces
   
   # Get detailed application info
   kubectl get application <app-name> -n argocd -o yaml
   
   # Check what resources ArgoCD created
   argocd app get <app-name>
   argocd app resources <app-name>
   ```

3. **Check All Resources in Namespace:**
   ```bash
   # List all resources (includes deployments, services, pods, etc.)
   kubectl get all -n product-catalog
   
   # List only deployments
   kubectl get deployments -n product-catalog
   
   # List with more details
   kubectl get deployments -n product-catalog -o wide
   ```

4. **Find Which Deployment Created Your Pods:**
   ```bash
   # Describe a pod to see its owner (deployment)
   kubectl describe pod frontend-67bbc4c779-2gkn5 -n product-catalog | grep -A 5 "Controlled By"
   
   # Or check pod labels to find deployment
   kubectl get pod frontend-67bbc4c779-2gkn5 -n product-catalog --show-labels
   
   # Find deployment by label selector
   kubectl get deployments -n product-catalog -l app=frontend
   ```

5. **Check ArgoCD UI:**
   - Access ArgoCD UI (port-forward or LoadBalancer)
   - Navigate to your application
   - Click on the application to see all resources it created
   - You'll see deployments, services, pods, etc. listed there

6. **Verify Git Repository Has Deployment Files:**
   ```bash
   # Check what ArgoCD is syncing from
   kubectl get application <app-name> -n argocd -o jsonpath='{.spec.source}'
   
   # The deployment YAML files should be in your GitOps repository
   # ArgoCD reads from Git and creates the same resources
   ```

**Common Issues:**

- **Wrong Namespace:** Most likely - check both `product-catalog` and `default` namespaces
  - ArgoCD might deploy to `default` namespace if not specified
  - Your deployments are in `default` namespace (as shown above)
  - Use `-n default` instead of `-n product-catalog` for your current setup
- **ArgoCD Sync Not Complete:** Resources might still be syncing
- **Different Resource Names:** Deployments might have different names than expected

**Your Current Setup:**
Based on your output, your deployments are in the `default` namespace:
- `frontend` - 2/2 ready
- `product-service` - 2/2 ready
- `ratings-service` - 2/2 ready
- `redis` - 1/1 ready
- `worker-service` - 2/2 ready

**To work with your deployments, use:**
```bash
# List deployments in default namespace
kubectl get deployments -n default

# Check specific deployment
kubectl get deployment frontend -n default
kubectl get deployment product-service -n default

# View deployment details
kubectl describe deployment frontend -n default

# Check pods (they're also in default namespace)
kubectl get pods -n default

# Check services
kubectl get svc -n default
```

**Quick Verification:**
```bash
# If pods are running, deployments MUST exist
# Find the namespace first
kubectl get pods frontend-67bbc4c779-2gkn5 --all-namespaces -o jsonpath='{.metadata.namespace}'

# Then check deployments in that namespace
kubectl get deployments -n <namespace-from-above>

# For your setup, use default namespace:
kubectl get deployments -n default
kubectl get pods -n default
kubectl get svc -n default
```

**Note:** If you want to move resources to `product-catalog` namespace:
1. Update your ArgoCD application destination namespace to `product-catalog`
2. Or update your GitOps repository YAML files to use `namespace: product-catalog`
3. ArgoCD will automatically move resources on next sync

---

### Step 26: Monitor Pipeline Runs

1. **View Pipeline Runs**
   - In Azure DevOps, go to **"Pipelines"**
   - Click on a pipeline (e.g., `product-service-pipeline`)
   - View recent runs and their status

2. **Trigger Pipeline Manually**
   - Click **"Run pipeline"**
   - Select branch: `main`
   - Click **"Run"**
   - Monitor the pipeline execution

3. **Verify Image Push**
   - In Azure Portal, navigate to your ACR
   - Click **"Repositories"** in left menu
   - Verify images are being pushed:
     - `product-service`
     - `ratings-service`
     - `worker-service`
     - `product-catalog-frontend`

4. **Verify GitOps Update**
   - In Azure DevOps, go to **"Repos"** → `product-catalog-gitops`
   - Check commit history
   - Verify image tags are being updated by pipelines

---

## UI-Based Troubleshooting

### Issue: Cannot Access ArgoCD UI

**Solution:**
1. Check LoadBalancer service in Azure Portal
2. Verify external IP is assigned
3. Check network security groups (NSG) if using custom networking
4. Try accessing via port-forward:
   ```bash
   kubectl port-forward svc/argocd-server -n argocd 8080:443
   # Access at: https://localhost:8080
   ```

### Issue: Pipeline Fails to Push to ACR

**Solution:**
1. Verify service connection in Azure DevOps:
   - Project Settings → Service connections
   - Check `ACR-Connection` status
   - Re-authenticate if needed
2. Verify ACR admin user is enabled:
   - Azure Portal → ACR → Access keys
   - Ensure "Admin user" is enabled

### Issue: ArgoCD Cannot Access Git Repository

**Solution:**
1. Verify repository URL in ArgoCD:
   - Settings → Repositories
   - Check repository status
2. Verify PAT permissions:
   - Azure DevOps → User Settings → Personal Access Tokens
   - Ensure token has "Code (read)" permission
3. Test repository access:
   - Try cloning repository manually with same credentials

### Issue: Pods Stuck in ImagePullBackOff

**Solution:**
1. Verify ACR secret exists:
   - Azure Portal → AKS → Workloads
   - Check secrets in namespace
2. Recreate secret if needed:
   - Use Cloud Shell to create secret with ACR credentials

### Issue: Application Out of Sync in ArgoCD

**Solution:**
1. In ArgoCD UI, click on application
2. Click **"Sync"** button
3. Select **"Synchronize"**
4. Monitor sync progress
5. If issues persist, check application logs in ArgoCD UI

---

## Quick Reference: UI Navigation Paths

### Azure Portal
- **Resource Groups**: `Home` → `Resource groups`
- **Container Registries**: `Home` → `Container registries`
- **Kubernetes Services**: `Home` → `Kubernetes services`
- **Cloud Shell**: Top right icon `>_`

### Azure DevOps
- **Projects**: `https://dev.azure.com/{org}`
- **Repos**: Project → `Repos` → `Files`
- **Pipelines**: Project → `Pipelines` → `Pipelines`
- **Service Connections**: Project → `Project Settings` → `Service connections`
- **Variable Groups**: Project → `Pipelines` → `Library`

### ArgoCD UI
- **Applications**: Left menu → `Applications`
- **Repositories**: Left menu → `Settings` → `Repositories`
- **Application Details**: Click on application name

---

## Summary: UI Workflow

### Complete Setup Flow (UI Version)

1. ✅ **Azure Portal**: Create Resource Group
2. ✅ **Azure Portal**: Create ACR (note credentials)
3. ✅ **Azure Portal**: Create AKS cluster
4. ✅ **Azure Portal**: Create VM for self-hosted agent
5. ✅ **VM**: Install Docker, Node.js, and required tools
6. ✅ **Azure DevOps**: Create agent pool (`cicdagent`)
7. ✅ **VM**: Install and configure Azure DevOps agent
8. ✅ **Azure DevOps**: Create project
9. ✅ **Azure DevOps**: Import repository
10. ✅ **Azure DevOps**: Create service connection for ACR
11. ✅ **Azure DevOps**: Create variable group
12. ✅ **Azure DevOps**: Create pipelines (4 pipelines) using `productagent` pool
13. ✅ **Azure DevOps**: Create GitOps repository
14. ✅ **Azure Portal Cloud Shell**: Install ArgoCD
15. ✅ **Azure Portal**: Expose ArgoCD via LoadBalancer
16. ✅ **ArgoCD UI**: Add repository
17. ✅ **ArgoCD UI**: Create application
18. ✅ **Azure Portal**: Verify deployments
19. ✅ **Azure Portal**: Expose frontend service
20. ✅ **Browser**: Access application

### Key Differences from CLI Version

- **No command-line tools required** (except Cloud Shell for ArgoCD)
- **Visual interface** for all configurations
- **Point-and-click** setup process
- **Built-in validation** in UI forms
- **Visual monitoring** of resources and pipelines

---

**Last Updated:** 2025-01-27
**Project:** Product Catalog App Migration to Azure (UI Version)
**Repository:** https://github.com/fred4impact/Product-catalog-app.git



# Installing Argocd Image updter
kubectl apply -f https://raw.githubusercontent.com/argoproj-labs/argocd-image-updater/stable/config/install.yaml

# Steps:2 
kubectl get pods -n argocd | grep updater

# Step:3
az acr credential show --name <acr_name>

# Create secre inside argocd namespaxe 
kubectl create secret generic acr-creds \
  -n argocd \
  --from-literal=username=<USERNAME> \
  --from-literal=password=<PASSWORD>

# Step:4 create Configmap for ImageUpdate 

```
apiVersion: v1
kind: ConfigMap
metadata:
  name: argocd-image-updater-config
  namespace: argocd
data:
  registries.conf: |
    registries:
      - name: acr
        api_url:ACR_RESGISTRY
        prefix: REGSITRY_URL
        default: true
        credentials: secret:argocd/acr-creds


```
# Step:5 Apply the configMap
```
kubectl apply -f argocd-image-updater-config.yaml
```

# Add Annotations to Your Existing ArgoCD App

# Patch the app with Image Updater annotations:

Replace product-service with your actual name:

```
kubectl patch application product-service -n argocd --type merge -p '{
  "metadata": {
    "annotations": {
      "argocd-image-updater.argoproj.io/image-list": "product-service=productacr2025.azurecr.io/product-service",
      "argocd-image-updater.argoproj.io/write-back-method": "git",
      "argocd-image-updater.argoproj.io/git-branch": "master"
    }
  }
}'

```
# Check Points
ArgoCD Image Updater will:

detect new tag in ACR

update your Git repo (commit new image version)

ArgoCD syncs automatically

AKS deploys the new pods

The image is pulled using your existing acr-secret

✔️ No manual updates
✔️ No pipeline changes required
✔️ Full GitOps automation