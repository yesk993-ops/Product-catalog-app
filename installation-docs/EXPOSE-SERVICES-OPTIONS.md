# Options to Expose Services in AKS

## Current Situation

- ✅ **Frontend**: LoadBalancer with External IP `4.149.12.165` (port 80)
- ❌ **Product-service**: ClusterIP (no external access)
- ❌ **Ratings-service**: ClusterIP (no external access)
- ⚠️ **Limited Ingress quota**: Only 2 Ingress resources available

## Problem

Frontend (running in browser) needs to connect to backend services, but:
- Frontend is at: `http://4.149.12.165`
- Product-service has no external IP
- Browser cannot use Kubernetes internal service names

---

## Option 1: Use LoadBalancer for Each Service (Simplest - Recommended for Your Case)

**Pros:**
- ✅ Simple and straightforward
- ✅ Works immediately
- ✅ No Ingress quota needed
- ✅ Each service gets its own IP
- ✅ Easy to test and debug

**Cons:**
- ❌ Costs more (each LoadBalancer = ~$0.025/hour in Azure)
- ❌ More public IPs to manage
- ❌ Not ideal for production (but works)

**Steps:**

1. **Expose Product-Service:**
   ```bash
   kubectl expose deployment product-service \
     --type=LoadBalancer \
     --port=5000 \
     --target-port=5000 \
     --name=product-service-lb \
     -n product-catalog
   ```

2. **Expose Ratings-Service:**
   ```bash
   kubectl expose deployment ratings-service \
     --type=LoadBalancer \
     --port=5001 \
     --target-port=5001 \
     --name=ratings-service-lb \
     -n product-catalog
   ```

3. **Wait for External IPs (2-5 minutes):**
   ```bash
   kubectl get svc -n product-catalog -w
   ```

4. **Get the IPs:**
   ```bash
   PRODUCT_IP=$(kubectl get svc product-service-lb -n product-catalog -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
   RATINGS_IP=$(kubectl get svc ratings-service-lb -n product-catalog -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
   
   echo "Product Service: http://$PRODUCT_IP:5000"
   echo "Ratings Service: http://$RATINGS_IP:5001"
   ```

5. **Test:**
   ```bash
   curl http://$PRODUCT_IP:5000/api/products
   curl http://$RATINGS_IP:5001/api/ratings
   ```

6. **Update Frontend Pipeline:**
   ```yaml
   arguments: |
     --build-arg REACT_APP_PRODUCT_SERVICE_URL=http://$PRODUCT_IP:5000
     --build-arg REACT_APP_RATINGS_SERVICE_URL=http://$RATINGS_IP:5001
   ```

**Cost:** ~$18/month per LoadBalancer (2 services = ~$36/month)

---

## Option 2: Use Single Ingress with Path-Based Routing (Best Practice)

**Pros:**
- ✅ Uses only 1 Ingress (saves quota)
- ✅ Single domain/IP for everything
- ✅ Clean URLs (`/api/products` instead of different IPs)
- ✅ Better for production
- ✅ Easier to add SSL/TLS later

**Cons:**
- ❌ Requires Ingress Controller (NGINX) installed
- ❌ Slightly more complex setup
- ❌ Need to configure path routing

**Steps:**

1. **Install NGINX Ingress Controller (if not already):**
   ```bash
   kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.2/deploy/static/provider/cloud/deploy.yaml
   
   # Wait for it to be ready
   kubectl wait --namespace ingress-nginx \
     --for=condition=ready pod \
     --selector=app.kubernetes.io/component=controller \
     --timeout=300s
   ```

2. **Create/Update Ingress with Path Routing:**
   
   Create `kubernetes/ingress.yaml`:
   ```yaml
   apiVersion: networking.k8s.io/v1
   kind: Ingress
   metadata:
     name: product-catalog-ingress
     namespace: product-catalog
     annotations:
       nginx.ingress.kubernetes.io/rewrite-target: /
       nginx.ingress.kubernetes.io/ssl-redirect: "false"
       nginx.ingress.kubernetes.io/cors-allow-origin: "*"
       nginx.ingress.kubernetes.io/enable-cors: "true"
   spec:
     ingressClassName: nginx
     rules:
     - http:
         paths:
         # Frontend
         - path: /
           pathType: Prefix
           backend:
             service:
               name: frontend
               port:
                 number: 80
         # Product Service API
         - path: /api/products
           pathType: Prefix
           backend:
             service:
               name: product-service
               port:
                 number: 5000
         # Ratings Service API
         - path: /api/ratings
           pathType: Prefix
           backend:
             service:
               name: ratings-service
               port:
                 number: 5001
   ```

3. **Apply Ingress:**
   ```bash
   kubectl apply -f kubernetes/ingress.yaml
   ```

4. **Get Ingress External IP:**
   ```bash
   # Wait for IP assignment
   kubectl get ingress product-catalog-ingress -n product-catalog -w
   
   # Get the IP
   INGRESS_IP=$(kubectl get ingress product-catalog-ingress -n product-catalog -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
   echo "Ingress IP: http://$INGRESS_IP"
   ```

5. **Update Frontend to Use Relative URLs:**
   
   Update `frontend/Dockerfile`:
   ```dockerfile
   ARG REACT_APP_PRODUCT_SERVICE_URL=/api/products
   ARG REACT_APP_RATINGS_SERVICE_URL=/api/ratings
   ```
   
   **Important:** Update `frontend/src/App.js` to not append `/api/products`:
   ```javascript
   // Change from:
   const response = await fetch(`${PRODUCT_SERVICE_URL}/api/products`);
   
   // To:
   const response = await fetch(PRODUCT_SERVICE_URL);
   ```

6. **Test:**
   ```bash
   # Frontend
   curl http://$INGRESS_IP/
   
   # Product API
   curl http://$INGRESS_IP/api/products
   
   # Ratings API
   curl http://$INGRESS_IP/api/ratings
   ```

**Cost:** Uses 1 Ingress (saves quota), but still needs LoadBalancer for Ingress Controller

---

## Option 3: Use Frontend LoadBalancer IP with Ingress for APIs Only

**Hybrid Approach:**
- Keep frontend LoadBalancer (already working)
- Use 1 Ingress only for backend APIs
- Frontend connects to Ingress IP for APIs

**Steps:**

1. **Create Ingress for APIs only:**
   ```yaml
   apiVersion: networking.k8s.io/v1
   kind: Ingress
   metadata:
     name: product-catalog-api-ingress
     namespace: product-catalog
     annotations:
       nginx.ingress.kubernetes.io/rewrite-target: /
       nginx.ingress.kubernetes.io/cors-allow-origin: "*"
       nginx.ingress.kubernetes.io/enable-cors: "true"
   spec:
     ingressClassName: nginx
     rules:
     - http:
         paths:
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

2. **Get Ingress IP:**
   ```bash
   API_INGRESS_IP=$(kubectl get ingress product-catalog-api-ingress -n product-catalog -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
   echo "API Ingress IP: http://$API_INGRESS_IP"
   ```

3. **Update Frontend:**
   ```dockerfile
   ARG REACT_APP_PRODUCT_SERVICE_URL=http://$API_INGRESS_IP/api/products
   ARG REACT_APP_RATINGS_SERVICE_URL=http://$API_INGRESS_IP/api/ratings
   ```

**Cost:** 1 Ingress + 1 LoadBalancer (frontend)

---

## Recommendation for Your Situation

**Given:**
- ✅ Frontend already has LoadBalancer working
- ✅ ArgoCD Server already has LoadBalancer
- ⚠️ Limited Ingress quota (only 2)
- ✅ Need quick solution

**First, Check if Ingress Controller Exists:**
```bash
kubectl get svc -n ingress-nginx
kubectl get pods -n ingress-nginx
```

**If Ingress Controller EXISTS (has LoadBalancer):**
- ✅ **Use Ingress (Option 2)** - Better organization, uses existing infrastructure
- No additional LoadBalancer cost (controller already has one)
- Uses 1 Ingress resource (you have 2 quota)

**If Ingress Controller does NOT exist:**
- ✅ **Use LoadBalancer (Option 1)** - Simplest, fastest
- No Ingress quota used (save for other projects)
- Works immediately

**Recommended: Option 1 (LoadBalancer) if no Ingress Controller**

**Why:**
1. **Simplest** - No Ingress configuration needed
2. **Works immediately** - Just expose services
3. **No code changes** - Frontend can use full URLs
4. **Easy to test** - Each service independently accessible
5. **No Ingress quota used** - Save it for other projects
6. **No need to install Ingress Controller**

**Cost:** ~$36/month for 2 additional LoadBalancers (acceptable for development/staging)

**Total LoadBalancers:** 4 (ArgoCD + Frontend + Product-service + Ratings-service)

**When to Switch to Ingress:**
- When you need SSL/TLS certificates
- When you want a single domain
- When you have more services (cost savings)
- For production environments

---

## Quick Start: LoadBalancer Approach

```bash
# 1. Expose product-service
kubectl expose deployment product-service \
  --type=LoadBalancer \
  --port=5000 \
  --target-port=5000 \
  --name=product-service-lb \
  -n product-catalog

# 2. Expose ratings-service
kubectl expose deployment ratings-service \
  --type=LoadBalancer \
  --port=5001 \
  --target-port=5001 \
  --name=ratings-service-lb \
  -n product-catalog

# 3. Wait for IPs (2-5 minutes)
kubectl get svc -n product-catalog -w

# 4. Get IPs
PRODUCT_IP=$(kubectl get svc product-service-lb -n product-catalog -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
RATINGS_IP=$(kubectl get svc ratings-service-lb -n product-catalog -o jsonpath='{.status.loadBalancer.ingress[0].ip}')

echo "Product Service: http://$PRODUCT_IP:5000"
echo "Ratings Service: http://$RATINGS_IP:5001"

# 5. Test
curl http://$PRODUCT_IP:5000/api/products
curl http://$RATINGS_IP:5001/api/ratings

# 6. Update frontend pipeline with these IPs
```

---

## Comparison Table

| Aspect | LoadBalancer (Option 1) | Ingress (Option 2) | Hybrid (Option 3) |
|--------|-------------------------|-------------------|-------------------|
| **Ingress Quota Used** | 0 | 1 | 1 |
| **Setup Complexity** | ⭐ Easy | ⭐⭐⭐ Medium | ⭐⭐ Medium |
| **Code Changes** | None | Frontend code | None |
| **Cost** | ~$36/month | ~$18/month | ~$18/month |
| **URLs** | Different IPs | Single IP, paths | Mixed |
| **SSL/TLS** | Hard | Easy | Easy |
| **Best For** | Quick setup | Production | Balanced |

---

## Final Recommendation

**For your current situation: Use Option 1 (LoadBalancer)**

1. ✅ Quickest to implement
2. ✅ No code changes needed
3. ✅ Saves Ingress quota for other projects
4. ✅ Easy to test and debug
5. ✅ Can migrate to Ingress later when needed

**Next Steps:**
1. Expose both services with LoadBalancer
2. Get the external IPs
3. Update frontend pipeline with those IPs
4. Rebuild frontend
5. Test in browser

You can always migrate to Ingress later when you need SSL or want to optimize costs!

