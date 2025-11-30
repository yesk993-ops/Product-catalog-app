# Fix: ImagePullBackOff - 401 Unauthorized Error

## Problem Summary

Your Kubernetes pod cannot pull the image from Azure Container Registry (ACR) because:
- **Error**: `401 Unauthorized` when trying to authenticate to ACR
- **Root Cause**: Kubernetes doesn't have credentials to authenticate with ACR
- **Solution**: Create an ImagePullSecret and configure deployments to use it

---

## Quick Fix (3 Steps)

### Prerequisite: Connect to Your AKS Cluster

**If you get connection errors, first connect to your AKS cluster:**

```bash
# Set your AKS cluster variables
AKS_CLUSTER_NAME="product-catalog-aks"  # Your AKS cluster name
RESOURCE_GROUP="product-catalog-rg"     # Your resource group

# Get AKS credentials (this configures kubectl)
az aks get-credentials \
  --resource-group $RESOURCE_GROUP \
  --name $AKS_CLUSTER_NAME \
  --overwrite-existing

# Verify connection works
kubectl get nodes
```

**Expected Output:** You should see your AKS nodes listed. If this fails, check:
- You're logged into Azure: `az login`
- The cluster name and resource group are correct
- You have permissions to access the cluster

---

### Step 1: Create ACR ImagePullSecret

Run these commands from Azure Cloud Shell or your local terminal (with `az` and `kubectl` configured):

```bash
# Set your variables
ACR_NAME="productacr2025"  # Your ACR name
RESOURCE_GROUP="product-catalog-rg"  # Your resource group
NAMESPACE="product-catalog"  # Your namespace

# Get ACR login server
ACR_LOGIN_SERVER=$(az acr show --name $ACR_NAME --resource-group $RESOURCE_GROUP --query loginServer -o tsv)
echo "ACR Login Server: $ACR_LOGIN_SERVER"

# Get ACR admin credentials
ACR_USERNAME=$(az acr credential show --name $ACR_NAME --resource-group $RESOURCE_GROUP --query username -o tsv)
ACR_PASSWORD=$(az acr credential show --name $ACR_NAME --resource-group $RESOURCE_GROUP --query passwords[0].value -o tsv)

# Create namespace if it doesn't exist (simplified command)
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

### Step 2: Update Deployment to Use the Secret

You have **two options**:

#### Option A: Quick Fix (Patch Existing Deployments) ⚡

This immediately fixes running deployments without editing YAML files:

```bash
# Patch product-service deployment
kubectl patch deployment product-service -n product-catalog \
  -p '{"spec":{"template":{"spec":{"imagePullSecrets":[{"name":"acr-secret"}]}}}}'

# If you have other services, patch them too:
kubectl patch deployment frontend -n product-catalog \
  -p '{"spec":{"template":{"spec":{"imagePullSecrets":[{"name":"acr-secret"}]}}}}'

kubectl patch deployment ratings-service -n product-catalog \
  -p '{"spec":{"template":{"spec":{"imagePullSecrets":[{"name":"acr-secret"}]}}}}'

kubectl patch deployment worker-service -n product-catalog \
  -p '{"spec":{"template":{"spec":{"imagePullSecrets":[{"name":"acr-secret"}]}}}}'
```

#### Option B: Permanent Fix (Update YAML Files) 📝

Edit your deployment YAML files (e.g., `kubernetes/product-service/deployment.yaml`) and add `imagePullSecrets`:

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

Then commit and push to your GitOps repository. ArgoCD will automatically sync the changes.

---

### Step 3: Restart Pods

After patching or updating the deployment, restart the pods:

```bash
# Option 1: Delete all pods (they will be recreated automatically)
kubectl delete pods -n product-catalog --all

# Option 2: Restart specific deployment
kubectl rollout restart deployment/product-service -n product-catalog
```

---

## Verify the Fix

1. **Check pod status** (should show "Running"):
   ```bash
   kubectl get pods -n product-catalog
   ```

2. **Check pod events** (should not show ImagePullBackOff):
   ```bash
   kubectl get events -n product-catalog --sort-by='.lastTimestamp'
   ```

3. **Describe the pod** to see detailed status:
   ```bash
   kubectl describe pod <pod-name> -n product-catalog
   ```

---

## Troubleshooting

### If pods still fail:

1. **Verify secret exists:**
   ```bash
   kubectl get secret acr-secret -n product-catalog
   ```

2. **Check if ACR admin user is enabled:**
   ```bash
   az acr update --name productacr2025 --admin-enabled true
   ```

3. **Verify deployment has imagePullSecrets:**
   ```bash
   kubectl get deployment product-service -n product-catalog -o yaml | grep -A 5 imagePullSecrets
   ```

4. **Check if image exists in ACR:**
   ```bash
   az acr repository list --name productacr2025
   az acr repository show-tags --name productacr2025 --repository product-service
   ```

5. **Test ACR login manually:**
   ```bash
   az acr login --name productacr2025
   docker pull productacr2025.azurecr.io/product-service:50
   ```

---

## Alternative: Use Managed Identity (Best Practice)

If your AKS cluster was created with `--attach-acr`, you can use managed identity instead:

```bash
# Enable ACR integration (if not already done)
az aks update -n <your-aks-cluster-name> -g product-catalog-rg --attach-acr productacr2025
```

This allows AKS to pull from ACR without secrets, but you may still need `imagePullSecrets` in some configurations.

---

## Summary

**The Issue:**
- Kubernetes cannot authenticate to ACR → 401 Unauthorized
- Pods stuck in ImagePullBackOff state

**The Solution:**
1. ✅ Create `acr-secret` with ACR credentials
2. ✅ Add `imagePullSecrets` to deployment
3. ✅ Restart pods

**Time to Fix:** ~5 minutes

