# Deploy Application to AKS

## Current Situation

- ✅ ACR secret (`acr-secret`) is created in `product-catalog` namespace
- ❌ No deployments exist yet
- ⚠️ Deployment files need to be updated before deployment

---

## Step 1: Update Deployment Files

Your deployment files need these changes:
1. Change namespace from `default` to `product-catalog`
2. Add `imagePullSecrets` to use the ACR secret
3. Update image references to use your ACR

### Quick Fix: Update All Files at Once

Run these commands from the `product-catalog-app/kubernetes` directory:

```bash
# Navigate to kubernetes directory
cd /Users/mac/Documents/DEVOPS-PORTFOLIOS/product-catalog-app/kubernetes

# Set your ACR login server
ACR_LOGIN_SERVER="productacr2025.azurecr.io"

# Update namespace in all YAML files (default → product-catalog)
find . -name "*.yaml" -type f -exec sed -i '' 's/namespace: default/namespace: product-catalog/g' {} \;

# Update image references (replace YOUR_DOCKER_USERNAME with ACR)
find . -name "*.yaml" -type f -exec sed -i '' "s|YOUR_DOCKER_USERNAME/product-service|${ACR_LOGIN_SERVER}/product-service|g" {} \;
find . -name "*.yaml" -type f -exec sed -i '' "s|YOUR_DOCKER_USERNAME/ratings-service|${ACR_LOGIN_SERVER}/ratings-service|g" {} \;
find . -name "*.yaml" -type f -exec sed -i '' "s|YOUR_DOCKER_USERNAME/worker-service|${ACR_LOGIN_SERVER}/worker-service|g" {} \;
find . -name "*.yaml" -type f -exec sed -i '' "s|YOUR_DOCKER_USERNAME/frontend|${ACR_LOGIN_SERVER}/frontend|g" {} \;
find . -name "*.yaml" -type f -exec sed -i '' "s|YOUR_DOCKER_USERNAME/product-catalog-frontend|${ACR_LOGIN_SERVER}/product-catalog-frontend|g" {} \;
```

### Manual Fix: Add imagePullSecrets to Each Deployment

You need to add `imagePullSecrets` to each deployment file. Here's the pattern:

**Before:**
```yaml
spec:
  template:
    spec:
      containers:
      - name: product-service
```

**After:**
```yaml
spec:
  template:
    spec:
      imagePullSecrets:
      - name: acr-secret
      containers:
      - name: product-service
```

---

## Step 2: Deploy the Application

### Option A: Deploy All Services at Once

```bash
# Make sure you're in the kubernetes directory
cd /Users/mac/Documents/DEVOPS-PORTFOLIOS/product-catalog-app/kubernetes

# Deploy infrastructure first (MongoDB, Redis)
kubectl apply -f mongodb/
kubectl apply -f redis/

# Wait for infrastructure to be ready (optional)
kubectl wait --for=condition=ready pod -l app=mongodb -n product-catalog --timeout=300s
kubectl wait --for=condition=ready pod -l app=redis -n product-catalog --timeout=300s

# Deploy application services
kubectl apply -f product-service/
kubectl apply -f ratings-service/
kubectl apply -f worker-service/
kubectl apply -f frontend/

# Deploy ingress (optional)
kubectl apply -f ingress.yaml
```

### Option B: Deploy Services One by One

```bash
# 1. Deploy MongoDB
kubectl apply -f mongodb/statefulset.yaml

# 2. Deploy Redis
kubectl apply -f redis/deployment.yaml

# 3. Deploy Product Service
kubectl apply -f product-service/deployment.yaml

# 4. Deploy Ratings Service
kubectl apply -f ratings-service/rating-deployment.yaml

# 5. Deploy Worker Service
kubectl apply -f worker-service/worker-deployment.yaml

# 6. Deploy Frontend
kubectl apply -f frontend/frontend-deployment.yaml
```

---

## Step 3: Verify Deployment

```bash
# Check all resources
kubectl get all -n product-catalog

# Check deployments
kubectl get deployments -n product-catalog

# Check pods
kubectl get pods -n product-catalog

# Check pod status in detail
kubectl get pods -n product-catalog -o wide

# Watch pods (press Ctrl+C to exit)
kubectl get pods -n product-catalog -w
```

---

## Step 4: Check for Errors

If pods are not running:

```bash
# Check pod events
kubectl get events -n product-catalog --sort-by='.lastTimestamp'

# Describe a specific pod
kubectl describe pod <pod-name> -n product-catalog

# Check pod logs
kubectl logs <pod-name> -n product-catalog
```

---

## Quick Script: Deploy Everything

Save this as `deploy.sh` and run it:

```bash
#!/bin/bash

# Set variables
ACR_LOGIN_SERVER="productacr2025.azurecr.io"
NAMESPACE="product-catalog"
KUBERNETES_DIR="/Users/mac/Documents/DEVOPS-PORTFOLIOS/product-catalog-app/kubernetes"

cd "$KUBERNETES_DIR"

echo "Updating namespaces..."
find . -name "*.yaml" -type f -exec sed -i '' "s/namespace: default/namespace: ${NAMESPACE}/g" {} \;

echo "Updating image references..."
find . -name "*.yaml" -type f -exec sed -i '' "s|YOUR_DOCKER_USERNAME/product-service|${ACR_LOGIN_SERVER}/product-service|g" {} \;
find . -name "*.yaml" -type f -exec sed -i '' "s|YOUR_DOCKER_USERNAME/ratings-service|${ACR_LOGIN_SERVER}/ratings-service|g" {} \;
find . -name "*.yaml" -type f -exec sed -i '' "s|YOUR_DOCKER_USERNAME/worker-service|${ACR_LOGIN_SERVER}/worker-service|g" {} \;
find . -name "*.yaml" -type f -exec sed -i '' "s|YOUR_DOCKER_USERNAME/frontend|${ACR_LOGIN_SERVER}/frontend|g" {} \;

echo "Deploying infrastructure..."
kubectl apply -f mongodb/
kubectl apply -f redis/

echo "Waiting for infrastructure..."
sleep 10

echo "Deploying services..."
kubectl apply -f product-service/
kubectl apply -f ratings-service/
kubectl apply -f worker-service/
kubectl apply -f frontend/

echo "Deployment complete! Check status with:"
echo "kubectl get pods -n ${NAMESPACE}"
```

**Note:** You'll still need to manually add `imagePullSecrets` to each deployment file, or use `kubectl patch` after deployment.

---

## Alternative: Patch Deployments After Deployment

If you deploy first and then patch:

```bash
# Deploy everything
kubectl apply -f product-catalog-app/kubernetes/ -R

# Patch all deployments to add imagePullSecrets
kubectl patch deployment product-service -n product-catalog \
  -p '{"spec":{"template":{"spec":{"imagePullSecrets":[{"name":"acr-secret"}]}}}}'

kubectl patch deployment ratings-service -n product-catalog \
  -p '{"spec":{"template":{"spec":{"imagePullSecrets":[{"name":"acr-secret"}]}}}}'

kubectl patch deployment worker-service -n product-catalog \
  -p '{"spec":{"template":{"spec":{"imagePullSecrets":[{"name":"acr-secret"}]}}}}'

kubectl patch deployment frontend -n product-catalog \
  -p '{"spec":{"template":{"spec":{"imagePullSecrets":[{"name":"acr-secret"}]}}}}'

# Restart pods
kubectl rollout restart deployment/product-service -n product-catalog
kubectl rollout restart deployment/ratings-service -n product-catalog
kubectl rollout restart deployment/worker-service -n product-catalog
kubectl rollout restart deployment/frontend -n product-catalog
```

---

## Important Notes

1. **Image Tags**: Make sure the image tags in your deployment files match the tags of images in ACR. Check with:
   ```bash
   az acr repository show-tags --name productacr2025 --repository product-service
   ```

2. **Image Names**: Verify your ACR repository names match. Check with:
   ```bash
   az acr repository list --name productacr2025
   ```

3. **Namespace**: All resources should be in `product-catalog` namespace (not `default`)

4. **ImagePullSecrets**: Must be added to each deployment's `spec.template.spec` section

