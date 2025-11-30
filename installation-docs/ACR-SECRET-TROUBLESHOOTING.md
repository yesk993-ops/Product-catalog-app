# ACR Secret Troubleshooting Guide

## 🔍 Problem Identification

### Common Error Messages

If you see any of these errors, you have an ACR authentication issue:

```
ErrImagePull: failed to pull and unpack image "productacr2025.azurecr.io/product-service:50"
failed to resolve reference "productacr2025.azurecr.io/product-service:50"
failed to authorize: failed to fetch anonymous token
unexpected status from GET request to https://productacr2025.azurecr.io/oauth2/token: 401 Unauthorized
```

**Root Cause:** Kubernetes cannot authenticate to Azure Container Registry (ACR) to pull images.

---

## 🚀 Quick Diagnosis

Run these commands to diagnose the issue:

```bash
# 1. Check if secret exists
kubectl get secret acr-secret -n product-catalog

# 2. Check pod status
kubectl get pods -n product-catalog

# 3. Check pod events for errors
kubectl get events -n product-catalog --sort-by='.lastTimestamp'

# 4. Describe a failing pod
kubectl describe pod <pod-name> -n product-catalog

# 5. Check if deployment has imagePullSecrets
kubectl get deployment <deployment-name> -n product-catalog -o yaml | grep -A 5 imagePullSecrets
```

---

## ✅ Solution: Create ACR ImagePullSecret

### Choose Your Method

- **Option A (Direct)**: Use when you already have ACR credentials - simplest one-liner
- **Option B (Azure CLI)**: Use when you want to automatically fetch credentials - most convenient
- **Option C (Service Principal)**: Use for production environments - more secure
- **Option D (Managed Identity)**: Use when AKS has managed identity - best practice

### Prerequisite: Connect to AKS Cluster

**If you get connection errors, connect to your AKS cluster first:**

```bash
# Set your AKS cluster variables
AKS_CLUSTER_NAME="product-catalog-aks"  # Your AKS cluster name
RESOURCE_GROUP="product-catalog-rg"      # Your resource group

# Get AKS credentials (this configures kubectl)
az aks get-credentials \
  --resource-group $RESOURCE_GROUP \
  --name $AKS_CLUSTER_NAME \
  --overwrite-existing

# Verify connection works
kubectl get nodes
```

---

### Option A: Direct Method (Simplest - When You Have Credentials)

**Use this if you already have your ACR credentials:**

```bash
# Simple one-liner - replace with your actual values
kubectl create secret docker-registry acr-secret \
  --namespace product-catalog \
  --docker-server=productacr2025.azurecr.io \
  --docker-username=<your-acr-username> \
  --docker-password=<your-acr-password>

# Example with actual values:
kubectl create secret docker-registry acr-secret \
  --namespace product-catalog \
  --docker-server=productacr2025.azurecr.io \
  --docker-username=productacr2025 \
  --docker-password=AbCdEfGhIjKlMnOpQrStUvWxYz1234567890

# Verify the secret was created
kubectl get secret acr-secret -n product-catalog
```

**To get ACR credentials manually:**
```bash
# Get ACR admin username (usually same as ACR name)
az acr credential show --name productacr2025 --resource-group product-catalog-rg --query username -o tsv

# Get ACR admin password
az acr credential show --name productacr2025 --resource-group product-catalog-rg --query passwords[0].value -o tsv
```

**Using Service Principal with Direct Method:**
```bash
# If you have a service principal, use its App ID and password
kubectl create secret docker-registry acr-secret \
  --namespace product-catalog \
  --docker-server=productacr2025.azurecr.io \
  --docker-username=<service-principal-app-id> \
  --docker-password=<service-principal-password>
```

**Expected Output:**
```
NAME          TYPE                             DATA   AGE
acr-secret    kubernetes.io/dockerconfigjson   1      5s
```

---

### Option B: Using Azure CLI (Automated - Fetches Credentials)

**Complete script to create the secret (automatically fetches credentials):**

```bash
# Set your variables
ACR_NAME="productacr2025"  # Replace with your ACR name
RESOURCE_GROUP="product-catalog-rg"
NAMESPACE="product-catalog"  # Your application namespace

# Login to Azure (if not already logged in)
az login

# Get ACR login server
ACR_LOGIN_SERVER=$(az acr show --name $ACR_NAME --resource-group $RESOURCE_GROUP --query loginServer -o tsv)
echo "ACR Login Server: $ACR_LOGIN_SERVER"

# Get ACR admin credentials
ACR_USERNAME=$(az acr credential show --name $ACR_NAME --resource-group $RESOURCE_GROUP --query username -o tsv)
ACR_PASSWORD=$(az acr credential show --name $ACR_NAME --resource-group $RESOURCE_GROUP --query passwords[0].value -o tsv)

# Create namespace if it doesn't exist
kubectl create namespace $NAMESPACE 2>/dev/null || echo "Namespace already exists"

# Create the ImagePullSecret
kubectl create secret docker-registry acr-secret \
  --namespace $NAMESPACE \
  --docker-server=$ACR_LOGIN_SERVER \
  --docker-username=$ACR_USERNAME \
  --docker-password=$ACR_PASSWORD \
  --docker-email=your-email@example.com

# Verify the secret was created
kubectl get secret acr-secret -n $NAMESPACE
```

**Expected Output:**
```
NAME          TYPE                             DATA   AGE
acr-secret    kubernetes.io/dockerconfigjson   1      5s
```

---

### Option C: Using Service Principal (For Production)

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

---

### Option D: Using Managed Identity (Best for AKS)

If your AKS cluster has a managed identity with ACR access:

```bash
# Enable ACR integration (if not already done)
az aks update -n product-catalog-aks -g product-catalog-rg --attach-acr productacr2025

# This automatically allows AKS to pull from ACR without secrets
# You may still need to add imagePullSecrets if using specific configurations
```

---

## 🔧 Update Deployments to Use the Secret

After creating the secret, you need to configure your deployments to use it.

### Method 1: Patch Existing Deployments (Quick Fix) ⚡

**Use this for immediate fix (temporary if using ArgoCD with auto-sync):**

```bash
# Patch all deployments to add imagePullSecrets
kubectl patch deployment product-service -n product-catalog \
  -p '{"spec":{"template":{"spec":{"imagePullSecrets":[{"name":"acr-secret"}]}}}}'

kubectl patch deployment ratings-service -n product-catalog \
  -p '{"spec":{"template":{"spec":{"imagePullSecrets":[{"name":"acr-secret"}]}}}}'

kubectl patch deployment worker-service -n product-catalog \
  -p '{"spec":{"template":{"spec":{"imagePullSecrets":[{"name":"acr-secret"}]}}}}'

kubectl patch deployment frontend -n product-catalog \
  -p '{"spec":{"template":{"spec":{"imagePullSecrets":[{"name":"acr-secret"}]}}}}'
```

### Method 2: Update Deployment YAML Files (Permanent Fix) 📝

**Edit your deployment files and add `imagePullSecrets`:**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: product-service
  namespace: product-catalog
spec:
  replicas: 2
  template:
    spec:
      imagePullSecrets:        # ← Add this section
      - name: acr-secret        # ← Add this line
      containers:
      - name: product-service
        image: productacr2025.azurecr.io/product-service:50
        # ... rest of config
```

**Then:**
- If using ArgoCD: Commit and push to your GitOps repository. ArgoCD will automatically sync.
- If using kubectl: Apply the updated files: `kubectl apply -f <deployment-file>`

---

## 🔄 Restart Pods

After updating deployments, restart the pods:

```bash
# Option 1: Delete all pods (they will be recreated automatically)
kubectl delete pods -n product-catalog --all

# Option 2: Restart specific deployments
kubectl rollout restart deployment/product-service -n product-catalog
kubectl rollout restart deployment/ratings-service -n product-catalog
kubectl rollout restart deployment/worker-service -n product-catalog
kubectl rollout restart deployment/frontend -n product-catalog
```

---

## ✅ Verify the Fix

### 1. Check Pod Status

```bash
# Check all pods (should show "Running")
kubectl get pods -n product-catalog

# Watch pods in real-time
kubectl get pods -n product-catalog -w
```

### 2. Check Pod Events

```bash
# Check events (should not show ImagePullBackOff)
kubectl get events -n product-catalog --sort-by='.lastTimestamp'
```

### 3. Describe Pod

```bash
# Get detailed pod information
kubectl describe pod <pod-name> -n product-catalog
```

### 4. Check Pod Logs

```bash
# View pod logs
kubectl logs <pod-name> -n product-catalog

# Follow logs in real-time
kubectl logs -f <pod-name> -n product-catalog
```

---

## 🔍 Advanced Troubleshooting

### Issue 1: Secret Exists But Pods Still Fail

**Check if secret is correct:**
```bash
# Verify secret exists
kubectl get secret acr-secret -n product-catalog

# Check secret details (base64 encoded)
kubectl get secret acr-secret -n product-catalog -o yaml
```

**Verify deployment has imagePullSecrets:**
```bash
kubectl get deployment product-service -n product-catalog -o yaml | grep -A 5 imagePullSecrets
```

**If missing, patch the deployment:**
```bash
kubectl patch deployment product-service -n product-catalog \
  -p '{"spec":{"template":{"spec":{"imagePullSecrets":[{"name":"acr-secret"}]}}}}'
```

---

### Issue 2: ACR Admin User Not Enabled

**Enable ACR admin user:**
```bash
az acr update --name productacr2025 --admin-enabled true
```

**Then recreate the secret:**
```bash
# Get new credentials
ACR_USERNAME=$(az acr credential show --name productacr2025 --resource-group product-catalog-rg --query username -o tsv)
ACR_PASSWORD=$(az acr credential show --name productacr2025 --resource-group product-catalog-rg --query passwords[0].value -o tsv)

# Delete old secret
kubectl delete secret acr-secret -n product-catalog

# Create new secret
kubectl create secret docker-registry acr-secret \
  --namespace product-catalog \
  --docker-server=productacr2025.azurecr.io \
  --docker-username=$ACR_USERNAME \
  --docker-password=$ACR_PASSWORD \
  --docker-email=your-email@example.com
```

---

### Issue 3: Image Doesn't Exist in ACR

**Check if image exists:**
```bash
# List all repositories
az acr repository list --name productacr2025

# Check tags for a specific repository
az acr repository show-tags --name productacr2025 --repository product-service

# Check if specific tag exists
az acr repository show-tags --name productacr2025 --repository product-service --query "[?name=='50']"
```

**If image doesn't exist:**
- Check your CI/CD pipeline logs
- Verify the image was pushed to ACR
- Check the image name and tag match your deployment

---

### Issue 4: Test ACR Login Manually

**Test if you can pull from ACR:**
```bash
# Login to ACR
az acr login --name productacr2025

# Try to pull the image
docker pull productacr2025.azurecr.io/product-service:50
```

**If this fails:**
- Check ACR admin credentials are enabled
- Verify you have permissions to access ACR
- Check network connectivity

---

### Issue 5: AKS Cannot Access ACR

**Verify AKS has ACR access:**
```bash
az aks check-acr \
  --name product-catalog-aks \
  --resource-group product-catalog-rg \
  --acr productacr2025
```

**If access is not configured, attach ACR to AKS:**
```bash
az aks update -n product-catalog-aks -g product-catalog-rg --attach-acr productacr2025
```

---

### Issue 6: ArgoCD Overwrites Changes

**If using ArgoCD and it keeps overwriting your patches:**

1. **Update Git repository** (recommended):
   - Edit deployment YAML files in your GitOps repository
   - Add `imagePullSecrets` to each deployment
   - Commit and push
   - ArgoCD will sync automatically

2. **Temporarily disable auto-sync:**
   ```bash
   # Get application name
   kubectl get applications -n argocd
   
   # Disable auto-sync
   argocd app set <app-name> --sync-policy none
   ```

3. **Use ArgoCD ignore differences:**
   ```yaml
   spec:
     syncPolicy:
       syncOptions:
       - RespectIgnoreDifferences=true
     ignoreDifferences:
     - group: apps
       kind: Deployment
       jsonPointers:
       - /spec/template/spec/imagePullSecrets
   ```

---

## 🔄 Configure ArgoCD Image Updater (Automatic Image Updates)

ArgoCD Image Updater automatically detects new images in ACR and updates your deployment manifests in Git, which ArgoCD then syncs to your cluster.

### Step 1: Install ArgoCD Image Updater

```bash
# Install ArgoCD Image Updater
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj-labs/argocd-image-updater/stable/manifests/install.yaml

# Verify installation
kubectl get pods -n argocd | grep image-updater
kubectl get deployment argocd-image-updater -n argocd
```

**Expected Output:**
```
NAME                                  READY   STATUS    RESTARTS   AGE
argocd-image-updater-xxxxxxxxx-xxxxx   1/1     Running   0          30s
```

---

### Step 2: Configure ACR Credentials for Image Updater

ArgoCD Image Updater needs credentials to access ACR. You have two options:

#### Option A: Using ACR Admin Credentials (Easiest)

```bash
# Set variables
ACR_NAME="productacr2025"
RESOURCE_GROUP="product-catalog-rg"
NAMESPACE="argocd"  # Image Updater runs in argocd namespace

# Get ACR credentials
ACR_LOGIN_SERVER=$(az acr show --name $ACR_NAME --resource-group $RESOURCE_GROUP --query loginServer -o tsv)
ACR_USERNAME=$(az acr credential show --name $ACR_NAME --resource-group $RESOURCE_GROUP --query username -o tsv)
ACR_PASSWORD=$(az acr credential show --name $ACR_NAME --resource-group $RESOURCE_GROUP --query passwords[0].value -o tsv)

# Create secret for Image Updater
kubectl create secret docker-registry argocd-image-updater-secret \
  --namespace $NAMESPACE \
  --docker-server=$ACR_LOGIN_SERVER \
  --docker-username=$ACR_USERNAME \
  --docker-password=$ACR_PASSWORD \
  --docker-email=your-email@example.com \
  --dry-run=client -o yaml | kubectl apply -f -

# Verify secret
kubectl get secret argocd-image-updater-secret -n argocd
```

#### Option B: Using Service Principal (Recommended for Production)

```bash
# Set variables
ACR_NAME="productacr2025"
RESOURCE_GROUP="product-catalog-rg"
NAMESPACE="argocd"
SERVICE_PRINCIPAL_NAME="argocd-image-updater-sp"

# Create service principal
SP_PASSWORD=$(az ad sp create-for-rbac --name $SERVICE_PRINCIPAL_NAME --skip-assignment --query password -o tsv)
SP_APP_ID=$(az ad sp show --id http://$SERVICE_PRINCIPAL_NAME --query appId -o tsv)

# Get ACR resource ID
ACR_ID=$(az acr show --name $ACR_NAME --resource-group $RESOURCE_GROUP --query id -o tsv)

# Assign AcrPull role to service principal
az role assignment create --assignee $SP_APP_ID --scope $ACR_ID --role AcrPull

# Create secret using service principal
ACR_LOGIN_SERVER=$(az acr show --name $ACR_NAME --resource-group $RESOURCE_GROUP --query loginServer -o tsv)

kubectl create secret docker-registry argocd-image-updater-secret \
  --namespace $NAMESPACE \
  --docker-server=$ACR_LOGIN_SERVER \
  --docker-username=$SP_APP_ID \
  --docker-password=$SP_PASSWORD \
  --docker-email=your-email@example.com \
  --dry-run=client -o yaml | kubectl apply -f -
```

---

### Step 3: Configure Image Updater to Use ACR Secret

Update the Image Updater ConfigMap to reference the ACR secret:

```bash
# Get current config
kubectl get configmap argocd-image-updater-config -n argocd -o yaml > image-updater-config.yaml

# Edit the config to add ACR registry configuration
# Add this section to the configmap:
```

**Create or update the ConfigMap:**

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: argocd-image-updater-config
  namespace: argocd
data:
  registries.conf: |
    registries:
    - name: Azure Container Registry
      prefix: productacr2025.azurecr.io
      api_url: https://productacr2025.azurecr.io
      credentials: ext:/scripts/acr-creds.sh
      default: true
```

**Create a credentials script:**

```bash
# Create a script that Image Updater can use to authenticate
kubectl create configmap argocd-image-updater-acr-creds \
  --namespace argocd \
  --from-literal=username=$(az acr credential show --name productacr2025 --resource-group product-catalog-rg --query username -o tsv) \
  --from-literal=password=$(az acr credential show --name productacr2025 --resource-group product-catalog-rg --query passwords[0].value -o tsv) \
  --dry-run=client -o yaml | kubectl apply -f -
```

**Or use the simpler approach - configure via environment variables:**

```bash
# Patch the Image Updater deployment to use the secret
kubectl patch deployment argocd-image-updater -n argocd --type json \
  -p='[{"op": "add", "path": "/spec/template/spec/containers/0/env/-", "value": {"name": "ARGOCD_IMAGE_UPDATER_PULLSECRET", "value": "argocd-image-updater-secret"}}]'
```

---

### Step 4: Configure Git Credentials for Write-Back

Image Updater needs Git credentials to update your GitOps repository:

```bash
# Set variables
GIT_REPO_URL="https://dev.azure.com/your-org/your-project/_git/product-catalog-gitops"
GIT_USERNAME="your-username"
GIT_PASSWORD="your-personal-access-token"  # Azure DevOps PAT with write permissions

# Create Git credentials secret
kubectl create secret generic argocd-image-updater-git-creds \
  --namespace argocd \
  --from-literal=username=$GIT_USERNAME \
  --from-literal=password=$GIT_PASSWORD \
  --dry-run=client -o yaml | kubectl apply -f -

# Verify secret
kubectl get secret argocd-image-updater-git-creds -n argocd
```

**For Azure DevOps, create a Personal Access Token (PAT):**
1. Go to Azure DevOps → User Settings → Personal Access Tokens
2. Create new token with:
   - **Code (read & write)** permissions
   - **Expiration** as needed
3. Use the token as `GIT_PASSWORD`

---

### Step 5: Add Annotations to Deployment Manifests

Add ArgoCD Image Updater annotations to your deployment YAML files in your GitOps repository:

**Example: `kubernetes/product-service/deployment.yaml`**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: product-service
  namespace: product-catalog
  annotations:
    # ArgoCD Image Updater configuration
    argocd-image-updater.argoproj.io/image-list: product-service=productacr2025.azurecr.io/product-service
    argocd-image-updater.argoproj.io/write-back-method: git
    argocd-image-updater.argoproj.io/git-branch: main
    argocd-image-updater.argoproj.io/product-service.update-strategy: semver
    argocd-image-updater.argoproj.io/product-service.allow-tags: regexp:^[0-9]+$  # Only numeric tags
spec:
  template:
    metadata:
      annotations:
        # Same annotations here for pod-level tracking
        argocd-image-updater.argoproj.io/image-list: product-service=productacr2025.azurecr.io/product-service
    spec:
      imagePullSecrets:
      - name: acr-secret
      containers:
      - name: product-service
        image: productacr2025.azurecr.io/product-service:latest  # Will be updated automatically
        # ... rest of config
```

**Repeat for all services:**

```yaml
# For ratings-service
argocd-image-updater.argoproj.io/image-list: ratings-service=productacr2025.azurecr.io/ratings-service

# For worker-service
argocd-image-updater.argoproj.io/image-list: worker-service=productacr2025.azurecr.io/worker-service

# For frontend
argocd-image-updater.argoproj.io/image-list: frontend=productacr2025.azurecr.io/frontend
```

**Common Annotation Options:**

```yaml
# Update strategy: semver, latest, name, digest
argocd-image-updater.argoproj.io/<image-name>.update-strategy: semver

# Allow specific tags (regex)
argocd-image-updater.argoproj.io/<image-name>.allow-tags: regexp:^[0-9]+$

# Ignore specific tags
argocd-image-updater.argoproj.io/<image-name>.ignore-tags: regexp:^dev-.*

# Git write-back method
argocd-image-updater.argoproj.io/write-back-method: git

# Git branch to update
argocd-image-updater.argoproj.io/git-branch: main

# Git commit message template
argocd-image-updater.argoproj.io/write-back-commit-message: "chore: update {{.AppName}} image to {{.NewTag}}"
```

---

### Step 6: Configure ArgoCD Application for Image Updater

Ensure your ArgoCD Application allows Image Updater to work:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: product-catalog-app
  namespace: argocd
spec:
  source:
    repoURL: https://dev.azure.com/your-org/your-project/_git/product-catalog-gitops
    targetRevision: main
    path: kubernetes
  destination:
    server: https://kubernetes.default.svc
    namespace: product-catalog
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
  # Image Updater will automatically update the Git repo, and ArgoCD will sync
```

---

### Step 7: Verify Image Updater Configuration

```bash
# Check Image Updater pod status
kubectl get pods -n argocd | grep image-updater

# Check Image Updater logs
kubectl logs -n argocd deployment/argocd-image-updater --tail=50

# Check Image Updater ConfigMap
kubectl get configmap argocd-image-updater-config -n argocd -o yaml

# Check if secrets exist
kubectl get secrets -n argocd | grep image-updater
```

---

### Step 8: Test Image Updater

1. **Push a new image to ACR:**
   ```bash
   # Build and push new image with a new tag
   az acr build --registry productacr2025 --image product-service:51 .
   ```

2. **Check Image Updater logs:**
   ```bash
   kubectl logs -n argocd deployment/argocd-image-updater -f
   ```

3. **Verify Git repository was updated:**
   - Check your GitOps repository
   - Image Updater should have committed a change updating the image tag

4. **Check ArgoCD sync:**
   ```bash
   # ArgoCD should automatically sync the changes
   argocd app get product-catalog-app
   kubectl get pods -n product-catalog
   ```

---

## 🔧 Troubleshooting ArgoCD Image Updater

### Issue 1: Image Updater Cannot Access ACR

**Symptoms:**
- Image Updater logs show authentication errors
- No image updates detected

**Solution:**
```bash
# Verify ACR secret exists
kubectl get secret argocd-image-updater-secret -n argocd

# Check Image Updater logs
kubectl logs -n argocd deployment/argocd-image-updater | grep -i error

# Test ACR access manually
az acr login --name productacr2025
az acr repository list --name productacr2025
```

---

### Issue 2: Image Updater Cannot Write to Git

**Symptoms:**
- Image Updater detects new images but fails to update Git
- Git authentication errors in logs

**Solution:**
```bash
# Verify Git credentials secret
kubectl get secret argocd-image-updater-git-creds -n argocd

# Check Git credentials are correct
kubectl get secret argocd-image-updater-git-creds -n argocd -o jsonpath='{.data.password}' | base64 -d

# Test Git access manually
git clone https://<username>:<token>@dev.azure.com/your-org/your-project/_git/product-catalog-gitops
```

---

### Issue 3: Image Updater Not Detecting New Images

**Symptoms:**
- New images pushed to ACR but Image Updater doesn't detect them

**Solution:**
```bash
# Check Image Updater scan interval (default is 2 minutes)
kubectl get configmap argocd-image-updater-config -n argocd -o yaml | grep scan

# Manually trigger a scan
kubectl patch application product-catalog-app -n argocd --type merge \
  -p '{"metadata":{"annotations":{"argocd-image-updater.argoproj.io/refresh":"hard"}}}'

# Check Image Updater logs for scan results
kubectl logs -n argocd deployment/argocd-image-updater | grep -i scan
```

---

### Issue 4: Image Updater Updates Git But ArgoCD Doesn't Sync

**Symptoms:**
- Git repository updated but ArgoCD application not syncing

**Solution:**
```bash
# Check ArgoCD application sync policy
argocd app get product-catalog-app

# Enable auto-sync if not enabled
argocd app set product-catalog-app --sync-policy automated

# Manually trigger sync
argocd app sync product-catalog-app

# Check sync status
argocd app wait product-catalog-app
```

---

### Issue 5: Wrong Image Tags Being Selected

**Symptoms:**
- Image Updater selects unexpected tags

**Solution:**
```yaml
# Add more specific tag filters in deployment annotations
annotations:
  argocd-image-updater.argoproj.io/product-service.update-strategy: semver
  argocd-image-updater.argoproj.io/product-service.allow-tags: regexp:^[0-9]+\.[0-9]+\.[0-9]+$  # Only semantic versions
  argocd-image-updater.argoproj.io/product-service.ignore-tags: regexp:^dev-.*|^test-.*  # Ignore dev/test tags
```

---

## 📋 Quick Reference: ArgoCD Image Updater

### Installation
```bash
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj-labs/argocd-image-updater/stable/manifests/install.yaml
```

### Create ACR Secret
```bash
ACR_NAME="productacr2025"
RESOURCE_GROUP="product-catalog-rg"

ACR_LOGIN_SERVER=$(az acr show --name $ACR_NAME --resource-group $RESOURCE_GROUP --query loginServer -o tsv)
ACR_USERNAME=$(az acr credential show --name $ACR_NAME --resource-group $RESOURCE_GROUP --query username -o tsv)
ACR_PASSWORD=$(az acr credential show --name $ACR_NAME --resource-group $RESOURCE_GROUP --query passwords[0].value -o tsv)

kubectl create secret docker-registry argocd-image-updater-secret \
  --namespace argocd \
  --docker-server=$ACR_LOGIN_SERVER \
  --docker-username=$ACR_USERNAME \
  --docker-password=$ACR_PASSWORD \
  --docker-email=your-email@example.com
```

### Create Git Credentials
```bash
kubectl create secret generic argocd-image-updater-git-creds \
  --namespace argocd \
  --from-literal=username=<git-username> \
  --from-literal=password=<git-token>
```

### Check Status
```bash
kubectl get pods -n argocd | grep image-updater
kubectl logs -n argocd deployment/argocd-image-updater
kubectl get configmap argocd-image-updater-config -n argocd
```

---

## 📋 Quick Reference Commands

### Create Secret

**Method 1: Direct (Simplest)**
```bash
kubectl create secret docker-registry acr-secret \
  --namespace product-catalog \
  --docker-server=productacr2025.azurecr.io \
  --docker-username=<your-acr-username> \
  --docker-password=<your-acr-password>
```

**Method 2: Using Azure CLI (Automated)**
```bash
ACR_NAME="productacr2025"
RESOURCE_GROUP="product-catalog-rg"
NAMESPACE="product-catalog"

ACR_LOGIN_SERVER=$(az acr show --name $ACR_NAME --resource-group $RESOURCE_GROUP --query loginServer -o tsv)
ACR_USERNAME=$(az acr credential show --name $ACR_NAME --resource-group $RESOURCE_GROUP --query username -o tsv)
ACR_PASSWORD=$(az acr credential show --name $ACR_NAME --resource-group $RESOURCE_GROUP --query passwords[0].value -o tsv)

kubectl create secret docker-registry acr-secret \
  --namespace $NAMESPACE \
  --docker-server=$ACR_LOGIN_SERVER \
  --docker-username=$ACR_USERNAME \
  --docker-password=$ACR_PASSWORD \
  --docker-email=your-email@example.com
```

### Patch Deployment
```bash
kubectl patch deployment <deployment-name> -n product-catalog \
  -p '{"spec":{"template":{"spec":{"imagePullSecrets":[{"name":"acr-secret"}]}}}}'
```

### Restart Deployment
```bash
kubectl rollout restart deployment/<deployment-name> -n product-catalog
```

### Check Status
```bash
kubectl get pods -n product-catalog
kubectl get secret acr-secret -n product-catalog
kubectl get events -n product-catalog --sort-by='.lastTimestamp'
```

---

## 🎯 Summary Checklist

### Basic ACR Secret Setup
- [ ] Connected to AKS cluster (`az aks get-credentials`)
- [ ] ACR admin user is enabled (`az acr update --admin-enabled true`)
- [ ] Created `acr-secret` in the correct namespace
- [ ] Added `imagePullSecrets` to deployment YAML or patched deployments
- [ ] Restarted pods to apply changes
- [ ] Verified pods are in "Running" state
- [ ] Checked pod logs for any errors
- [ ] Verified images exist in ACR

### ArgoCD Image Updater Setup (Optional)
- [ ] Installed ArgoCD Image Updater
- [ ] Created ACR credentials secret for Image Updater (`argocd-image-updater-secret`)
- [ ] Created Git credentials secret for write-back (`argocd-image-updater-git-creds`)
- [ ] Added Image Updater annotations to deployment manifests
- [ ] Committed and pushed updated manifests to GitOps repository
- [ ] Verified Image Updater pod is running
- [ ] Checked Image Updater logs for errors
- [ ] Tested automatic image update by pushing new image to ACR
- [ ] Verified Git repository was updated by Image Updater
- [ ] Confirmed ArgoCD synced the changes automatically

---

## 💡 Best Practices

1. **Use Managed Identity** when possible (Option C) - most secure
2. **Update Git repository** instead of patching if using ArgoCD
3. **Enable ACR admin user** only when needed, use service principals for production
4. **Store secrets securely** - consider using Azure Key Vault for production
5. **Monitor pod events** regularly to catch issues early

---

## 📞 Still Having Issues?

If you've tried all the above and still have problems:

1. **Check ACR connectivity:**
   ```bash
   az acr check-health --name productacr2025
   ```

2. **Verify AKS cluster status:**
   ```bash
   az aks show --name product-catalog-aks --resource-group product-catalog-rg
   ```

3. **Check network policies** that might block ACR access

4. **Review ACR firewall rules** if enabled

5. **Check AKS node logs:**
   ```bash
   kubectl get nodes
   kubectl describe node <node-name>
   ```

