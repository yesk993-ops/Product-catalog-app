# Fix Namespace Mismatch: ArgoCD vs Kubernetes Manifests

## Current Situation

- ✅ **ArgoCD Application** configured to deploy to: `product-catalog` namespace
- ❌ **Kubernetes YAML files** have: `namespace: default`
- ✅ **ACR Secret** created in: `default` namespace
- ✅ **Current running resources** are in: `default` namespace

## What's Happening

When ArgoCD destination namespace (`product-catalog`) doesn't match YAML namespace (`default`):
- ArgoCD will try to deploy to `product-catalog` namespace
- But YAML files specify `default` namespace
- This can cause resources to be created in the wrong namespace or fail to sync

## Impact Analysis

### Current State (Everything in `default`):
- ✅ Resources are running (pods, deployments, services)
- ✅ ACR secret exists in `default` namespace
- ❌ ArgoCD destination namespace doesn't match
- ❌ ArgoCD might show "OutOfSync" or create duplicate resources

### If You Change Everything to `product-catalog`:
- ✅ Matches ArgoCD configuration
- ✅ Better organization (dedicated namespace)
- ✅ Follows best practices
- ❌ Need to move/copy `acr-secret` to `product-catalog`
- ❌ Need to update all YAML files
- ⚠️ Resources in `default` will be orphaned (can delete later)

### If You Change ArgoCD to `default`:
- ✅ No YAML changes needed
- ✅ ACR secret already in correct namespace
- ❌ Using `default` namespace (not best practice)
- ❌ Less organized (mixing with system resources)

## Recommendation: Move Everything to `product-catalog` Namespace

**Why:**
- Matches ArgoCD configuration
- Better organization and isolation
- Follows Kubernetes best practices
- Easier to manage and clean up

---

## Solution: Move to `product-catalog` Namespace

### Step 1: Create ACR Secret in `product-catalog` Namespace

```bash
# Set variables
ACR_NAME="productacr2025"
RESOURCE_GROUP="product-catalog-rg"
NAMESPACE="product-catalog"

# Get ACR credentials
ACR_LOGIN_SERVER=$(az acr show --name $ACR_NAME --resource-group $RESOURCE_GROUP --query loginServer -o tsv)
ACR_USERNAME=$(az acr credential show --name $ACR_NAME --resource-group $RESOURCE_GROUP --query username -o tsv)
ACR_PASSWORD=$(az acr credential show --name $ACR_NAME --resource-group $RESOURCE_GROUP --query passwords[0].value -o tsv)

# Create namespace if it doesn't exist
kubectl create namespace $NAMESPACE

# Create ACR secret in product-catalog namespace
kubectl create secret docker-registry acr-secret \
  --namespace $NAMESPACE \
  --docker-server=$ACR_LOGIN_SERVER \
  --docker-username=$ACR_USERNAME \
  --docker-password=$ACR_PASSWORD \
  --docker-email=your-email@example.com

# Verify secret
kubectl get secret acr-secret -n $NAMESPACE
```

### Step 2: Update All Kubernetes YAML Files

Update namespace in all YAML files from `default` to `product-catalog`:

```bash
# Navigate to kubernetes directory
cd /Users/mac/Documents/DEVOPS-PORTFOLIOS/product-catalog-app/kubernetes

# Update namespace in all YAML files
find . -name "*.yaml" -type f -exec sed -i '' 's/namespace: default/namespace: product-catalog/g' {} \;

# Verify changes
grep -r "namespace:" . | grep -v "product-catalog"
# Should show no results (or only comments)
```

**Files to update:**
- `product-service/deployment.yaml`
- `ratings-service/rating-deployment.yaml`
- `worker-service/worker-deployment.yaml`
- `frontend/frontend-deployment.yaml`
- `mongodb/statefulset.yaml`
- `redis/deployment.yaml`
- `ingress.yaml`

### Step 3: Add imagePullSecrets to All Deployments

Make sure each deployment has `imagePullSecrets`:

```bash
# Check if imagePullSecrets exist
grep -r "imagePullSecrets" product-catalog-app/kubernetes/

# If missing, add to each deployment.yaml:
```

**Example for each deployment:**
```yaml
spec:
  template:
    spec:
      imagePullSecrets:
      - name: acr-secret
      containers:
      - name: product-service
        # ... rest of config
```

### Step 4: Commit and Push to GitOps Repository

```bash
# Commit changes
git add kubernetes/
git commit -m "Update namespace to product-catalog and add imagePullSecrets"
git push origin main
```

### Step 5: ArgoCD Will Auto-Sync

ArgoCD will automatically:
- Create resources in `product-catalog` namespace
- Use the `acr-secret` from `product-catalog` namespace
- Sync all changes

### Step 6: Verify New Resources

```bash
# Check resources in product-catalog namespace
kubectl get all -n product-catalog

# Check deployments
kubectl get deployments -n product-catalog

# Check pods
kubectl get pods -n product-catalog

# Check services
kubectl get svc -n product-catalog
```

### Step 7: Clean Up Old Resources (Optional)

After verifying everything works in `product-catalog` namespace:

```bash
# Delete old resources from default namespace (if you want)
kubectl delete deployment frontend product-service ratings-service worker-service redis -n default
kubectl delete svc frontend product-service ratings-service worker-service redis -n default

# Keep mongodb in default if you want, or move it too
```

---

## Alternative: Keep Everything in `default` Namespace

If you prefer to keep everything in `default` namespace:

### Step 1: Update ArgoCD Application

```bash
# Get current ArgoCD application
kubectl get application <app-name> -n argocd -o yaml > argocd-app.yaml

# Edit the file, change:
# destination.namespace: product-catalog → default

# Apply changes
kubectl apply -f argocd-app.yaml
```

**Or via ArgoCD UI:**
1. Go to ArgoCD UI
2. Click on your application
3. Click "Edit" → "Spec"
4. Change `destination.namespace` from `product-catalog` to `default`
5. Save

### Step 2: Verify

```bash
# ArgoCD will sync to default namespace
# Check ArgoCD application status
argocd app get <app-name>
```

---

## Comparison Table

| Aspect | Keep `default` | Move to `product-catalog` |
|--------|---------------|---------------------------|
| **YAML Changes** | ❌ None needed | ✅ Update all files |
| **ArgoCD Changes** | ✅ Update destination | ❌ Already correct |
| **ACR Secret** | ✅ Already exists | ✅ Need to create |
| **Organization** | ❌ Mixed with system | ✅ Isolated namespace |
| **Best Practice** | ❌ Not recommended | ✅ Recommended |
| **Cleanup** | ❌ Harder | ✅ Easy (delete namespace) |
| **RBAC** | ❌ Harder to manage | ✅ Easier to manage |

---

## Recommendation

**Move to `product-catalog` namespace** because:
1. ✅ Matches ArgoCD configuration (no conflicts)
2. ✅ Better organization and isolation
3. ✅ Follows Kubernetes best practices
4. ✅ Easier to manage permissions (RBAC)
5. ✅ Easier to clean up (delete namespace)
6. ✅ Prevents conflicts with system resources

---

## Quick Script: Complete Migration

```bash
#!/bin/bash

# Set variables
ACR_NAME="productacr2025"
RESOURCE_GROUP="product-catalog-rg"
NAMESPACE="product-catalog"
KUBERNETES_DIR="/Users/mac/Documents/DEVOPS-PORTFOLIOS/product-catalog-app/kubernetes"

# Step 1: Create namespace
kubectl create namespace $NAMESPACE

# Step 2: Create ACR secret in product-catalog namespace
ACR_LOGIN_SERVER=$(az acr show --name $ACR_NAME --resource-group $RESOURCE_GROUP --query loginServer -o tsv)
ACR_USERNAME=$(az acr credential show --name $ACR_NAME --resource-group $RESOURCE_GROUP --query username -o tsv)
ACR_PASSWORD=$(az acr credential show --name $ACR_NAME --resource-group $RESOURCE_GROUP --query passwords[0].value -o tsv)

kubectl create secret docker-registry acr-secret \
  --namespace $NAMESPACE \
  --docker-server=$ACR_LOGIN_SERVER \
  --docker-username=$ACR_USERNAME \
  --docker-password=$ACR_PASSWORD \
  --docker-email=your-email@example.com \
  --dry-run=client -o yaml | kubectl apply -f -

# Step 3: Update namespace in all YAML files
cd $KUBERNETES_DIR
find . -name "*.yaml" -type f -exec sed -i '' 's/namespace: default/namespace: product-catalog/g' {} \;

echo "✅ Namespace updated to product-catalog"
echo "✅ ACR secret created in product-catalog namespace"
echo "📝 Next: Commit and push changes to GitOps repository"
echo "🔄 ArgoCD will automatically sync to product-catalog namespace"
```

---

## Verification Checklist

After migration:

- [ ] ACR secret exists in `product-catalog` namespace
- [ ] All YAML files have `namespace: product-catalog`
- [ ] All deployments have `imagePullSecrets: - name: acr-secret`
- [ ] Changes committed and pushed to GitOps repo
- [ ] ArgoCD application shows "Synced" status
- [ ] Pods running in `product-catalog` namespace
- [ ] Services accessible
- [ ] Old resources in `default` namespace cleaned up (optional)

