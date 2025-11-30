# Diagnose: No Pods Found

## Quick Diagnostic Commands

Run these commands to understand the current state:

### 1. Check if Deployments Exist

```bash
# Check deployments in product-catalog namespace
kubectl get deployments -n product-catalog

# Check all resources in the namespace
kubectl get all -n product-catalog
```

### 2. Check Other Namespaces

```bash
# Check if pods are in default namespace
kubectl get pods -n default

# Check all namespaces for pods
kubectl get pods --all-namespaces | grep product

# List all namespaces
kubectl get namespaces
```

### 3. Check ArgoCD Status (if using ArgoCD)

```bash
# Check ArgoCD applications
kubectl get applications -n argocd

# Or if ArgoCD is in different namespace
kubectl get applications --all-namespaces
```

### 4. Check for Failed Pods

```bash
# Check all pods across all namespaces
kubectl get pods --all-namespaces

# Check events in product-catalog namespace
kubectl get events -n product-catalog --sort-by='.lastTimestamp'
```

---

## Next Steps Based on Results

### Scenario A: Deployments Exist but No Pods

If you see deployments but no pods, the pods might be failing. Check:

```bash
# Describe the deployment to see why pods aren't starting
kubectl describe deployment product-service -n product-catalog

# Check replica sets
kubectl get replicasets -n product-catalog

# Check pod events
kubectl get events -n product-catalog --sort-by='.lastTimestamp'
```

**If pods are in ImagePullBackOff**, you need to patch the deployments:

```bash
# Patch product-service deployment
kubectl patch deployment product-service -n product-catalog \
  -p '{"spec":{"template":{"spec":{"imagePullSecrets":[{"name":"acr-secret"}]}}}}'
```

### Scenario B: No Deployments Found

If no deployments exist, you need to deploy them. Options:

1. **If using ArgoCD**: Check ArgoCD sync status and trigger sync
2. **If using kubectl**: Apply your deployment YAML files
3. **If using Helm**: Install your Helm charts

### Scenario C: Pods in Different Namespace

If pods are in `default` namespace or another namespace:

```bash
# Patch deployments in that namespace
kubectl patch deployment product-service -n default \
  -p '{"spec":{"template":{"spec":{"imagePullSecrets":[{"name":"acr-secret"}]}}}}'

# Or create the secret in that namespace
kubectl create secret docker-registry acr-secret \
  --namespace default \
  --docker-server=$ACR_LOGIN_SERVER \
  --docker-username=$ACR_USERNAME \
  --docker-password=$ACR_PASSWORD \
  --docker-email=your-email@example.com
```

---

## Common Commands Reference

```bash
# Set namespace context
kubectl config set-context --current --namespace=product-catalog

# Get all resources in namespace
kubectl get all -n product-catalog

# Watch pods in real-time
kubectl get pods -n product-catalog -w

# Describe a specific resource
kubectl describe deployment product-service -n product-catalog
```

