# Fix ImagePullBackOff for ArgoCD Deployments

## Current Situation

- ✅ ACR secret (`acr-secret`) is created in `product-catalog` namespace
- ✅ Deployed via ArgoCD
- ❌ Pods failing with ImagePullBackOff (401 Unauthorized)

---

## Step 1: Check ArgoCD Application Status

```bash
# List all ArgoCD applications
kubectl get applications -n argocd

# Or if ArgoCD is in different namespace
kubectl get applications --all-namespaces

# Get detailed status of a specific application
kubectl get application <app-name> -n argocd -o yaml

# Check if deployments exist (they might be in different namespace)
kubectl get deployments --all-namespaces | grep product
```

---

## Step 2: Check Current Deployment Status

```bash
# Check all resources in product-catalog namespace
kubectl get all -n product-catalog

# Check deployments
kubectl get deployments -n product-catalog

# Check pods and their status
kubectl get pods -n product-catalog

# Check pod events for errors
kubectl get events -n product-catalog --sort-by='.lastTimestamp'
```

---

## Step 3: Fix the Issue

Since you're using ArgoCD, you have **two options**:

### Option A: Quick Fix (Patch Deployments) ⚡

**Note:** This is temporary. If ArgoCD has auto-sync enabled, it will overwrite these changes. Use this to get pods running immediately.

```bash
# Patch all deployments to add imagePullSecrets
kubectl patch deployment product-service -n product-catalog \
  -p '{"spec":{"template":{"spec":{"imagePullSecrets":[{"name":"acr-secret"}]}}}}'

# Repeat for other services (adjust names based on your deployments)
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

### Option B: Permanent Fix (Update Git Repository) 📝

**This is the proper way** - update your GitOps repository so ArgoCD syncs the correct configuration.

1. **Find your deployment files in the Git repository** (the one ArgoCD is syncing from)

2. **Add `imagePullSecrets` to each deployment YAML:**

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

3. **Commit and push to your Git repository**

4. **ArgoCD will automatically sync** (if auto-sync is enabled), or manually sync:
   ```bash
   # If you have argocd CLI
   argocd app sync <app-name>
   
   # Or via kubectl
   kubectl patch application <app-name> -n argocd --type merge -p '{"operation":{"sync":{"syncStrategy":{"hook":{}}}}}'
   ```

---

## Step 4: Verify the Fix

```bash
# Check pod status (should show "Running")
kubectl get pods -n product-catalog

# Watch pods in real-time
kubectl get pods -n product-catalog -w

# Check specific pod
kubectl describe pod <pod-name> -n product-catalog

# Check pod logs
kubectl logs <pod-name> -n product-catalog
```

---

## Step 5: Prevent ArgoCD from Overwriting (If Using Option A)

If you patched the deployments but ArgoCD keeps overwriting them:

### Option 1: Disable Auto-Sync Temporarily

```bash
# Get application name
kubectl get applications -n argocd

# Disable auto-sync
argocd app set <app-name> --sync-policy none

# Or via kubectl
kubectl patch application <app-name> -n argocd --type json \
  -p='[{"op": "remove", "path": "/spec/syncPolicy/automated"}]'
```

### Option 2: Use ArgoCD Sync Options

Add sync options to ignore differences in `imagePullSecrets`:

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

**But the best solution is Option B** - update the Git repository properly.

---

## Find Your ArgoCD Application Details

```bash
# List all applications
kubectl get applications -n argocd -o wide

# Get application details (shows Git repo and path)
kubectl get application <app-name> -n argocd -o yaml | grep -A 10 "source:"

# Example output:
# source:
#   repoURL: https://github.com/your-username/your-repo.git
#   targetRevision: main
#   path: kubernetes/product-service
```

This tells you:
- **Which Git repository** ArgoCD is syncing from
- **Which path** contains your deployment files
- **Which branch** it's using

---

## Quick Diagnostic Commands

```bash
# 1. Check ArgoCD applications
kubectl get applications -n argocd

# 2. Check if deployments exist
kubectl get deployments -n product-catalog

# 3. Check pod status
kubectl get pods -n product-catalog

# 4. Check pod errors
kubectl describe pod <pod-name> -n product-catalog

# 5. Check events
kubectl get events -n product-catalog --sort-by='.lastTimestamp'

# 6. Verify secret exists
kubectl get secret acr-secret -n product-catalog
```

---

## Summary

**Quick Fix (Temporary):**
1. Patch deployments with `kubectl patch` to add `imagePullSecrets`
2. Restart pods
3. ⚠️ Will be overwritten if ArgoCD auto-syncs

**Permanent Fix (Recommended):**
1. Find your GitOps repository (from ArgoCD application config)
2. Update deployment YAML files to include `imagePullSecrets`
3. Commit and push to Git
4. ArgoCD will sync automatically

Run `kubectl get applications -n argocd` to see your ArgoCD applications and their Git repository details.

