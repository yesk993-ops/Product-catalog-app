# Fix CORS and Frontend Connection Issues

## Current Issues

1. **CORS Error:** `CORS header 'Access-Control-Allow-Origin' missing` (Status: 403)
2. **Wrong URL:** Frontend trying to connect to `localhost:5000` (won't work in Kubernetes)

## Step 1: Verify Product-Service Has New CORS Code

```bash
# Check if pods restarted with new image (use product-catalog namespace)
kubectl get pods -n product-catalog -l app=product-service

# Check pod logs to see if new code is running
kubectl logs -n product-catalog deployment/product-service --tail=20

# Check when pods were created (should be recent if redeployed)
kubectl get pods -n product-catalog -l app=product-service -o wide

# Force restart to ensure new code is running
kubectl rollout restart deployment/product-service -n product-catalog

# Wait for rollout to complete
kubectl rollout status deployment/product-service -n product-catalog
```

## Step 2: Test CORS Directly in AKS Cluster

Since you're deployed on Azure Kubernetes Service, test directly in the cluster:

```bash
# Test from inside the cluster (best way for AKS)
kubectl run curl-test --image=curlimages/curl:latest --rm -it --restart=Never -n product-catalog -- \
  curl -v -H "Origin: http://4.249.109.224" \
  http://product-service:5000/api/products

# Should see headers like:
# Access-Control-Allow-Origin: *
# Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
# HTTP/1.1 200 OK
```

**Alternative: Test via Port-Forward (if needed)**

```bash
# Port-forward to a different port (avoid 5000 on macOS - AirPlay conflict)
kubectl port-forward svc/product-service -n product-catalog 5001:5000

# In another terminal, test CORS headers
curl -v -H "Origin: http://4.249.109.224" \
     http://localhost:5001/api/products
```

**Check Product-Service Logs:**

```bash
# Check if CORS requests are being received
kubectl logs -n product-catalog deployment/product-service --tail=50 | grep -i cors

# Check all recent logs
kubectl logs -n product-catalog deployment/product-service --tail=50
```

## Step 3: Expose Product-Service Externally (Required for Frontend)

**Recommendation: Use LoadBalancer (Not Ingress)**

Since you have limited Ingress quota and frontend already has LoadBalancer, use LoadBalancer for backend services too:
- ✅ No Ingress quota used
- ✅ Simple and works immediately  
- ✅ No code changes needed
- ✅ Easy to test

**Alternative:** Use Ingress if you want single domain/SSL (uses 1 Ingress quota)

See `EXPOSE-SERVICES-OPTIONS.md` for detailed comparison.

**Important:** Your frontend runs in the browser and needs to connect to an external URL. The frontend cannot use Kubernetes internal service names like `product-service:5000`.

```bash
# Check if LoadBalancer already exists
kubectl get svc product-service-lb -n product-catalog

# If not exists, expose product-service with LoadBalancer
kubectl expose deployment product-service \
  --type=LoadBalancer \
  --port=5000 \
  --target-port=5000 \
  --name=product-service-lb \
  -n product-catalog

# Wait for external IP (takes 2-5 minutes in Azure)
kubectl get svc product-service-lb -n product-catalog -w

# Once you see EXTERNAL-IP assigned, get it:
PRODUCT_IP=$(kubectl get svc product-service-lb -n product-catalog -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
echo "Product Service External IP: $PRODUCT_IP"
echo "Product Service URL: http://$PRODUCT_IP:5000"
echo "Test API: http://$PRODUCT_IP:5000/api/products"
```

**Note:** In Azure, LoadBalancer services get a public IP address that's accessible from the internet.

## Step 4: Test External Endpoint from Your Machine

Once you have the external IP, test from your local machine:

```bash
# Get the external IP (if not already set)
PRODUCT_IP=$(kubectl get svc product-service-lb -n product-catalog -o jsonpath='{.status.loadBalancer.ingress[0].ip}')

# Test health endpoint
curl http://$PRODUCT_IP:5000/health

# Test products API
curl http://$PRODUCT_IP:5000/api/products

# Test CORS headers (important!)
curl -v -H "Origin: http://4.249.109.224" \
     http://$PRODUCT_IP:5000/api/products

# Should see in response headers:
# < Access-Control-Allow-Origin: *
# < Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
```

**Expected Response:**
- Status: `200 OK`
- Headers include: `Access-Control-Allow-Origin: *`
- Body: JSON with products array

If you see CORS headers, the backend is configured correctly!

## Step 5: Rebuild Frontend with External IP (AKS Deployment)

**Critical:** The frontend React app runs in the browser, so it needs the external LoadBalancer IP, not `localhost` or Kubernetes service names.

1. **Get the External IP:**
   ```bash
   PRODUCT_IP=$(kubectl get svc product-service-lb -n product-catalog -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
   RATINGS_IP=$(kubectl get svc ratings-service-lb -n product-catalog -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
   
   echo "Product Service: http://$PRODUCT_IP:5000"
   echo "Ratings Service: http://$RATINGS_IP:5001"
   ```

2. **Update Frontend Pipeline** to use the external IPs:

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
      --build-arg REACT_APP_PRODUCT_SERVICE_URL=http://<PRODUCT_IP>:5000
      --build-arg REACT_APP_RATINGS_SERVICE_URL=http://<RATINGS_IP>:5001
    tags: |
      $(imageTag)
      latest
```

## Step 6: Verify Everything Works

```bash
# Check product-service is accessible
curl http://$PRODUCT_IP:5000/api/products

# Check CORS headers are present
curl -I -H "Origin: http://4.249.109.224" http://$PRODUCT_IP:5000/api/products

# Check frontend can connect (after rebuild)
# Open browser: http://4.249.109.224
# Check browser console - should not see CORS errors
```

## Troubleshooting

### If CORS still fails:

1. **Check product-service logs:**
   ```bash
   kubectl logs -n default deployment/product-service --tail=50 | grep -i cors
   ```

2. **Verify CORS code is in the image:**
   ```bash
   # Check if the server.js in the image has CORS config
   kubectl exec -n default deployment/product-service -- cat /app/src/server.js | grep -A 10 cors
   ```

3. **Test with curl to see actual response:**
   ```bash
   curl -v http://$PRODUCT_IP:5000/api/products 2>&1 | grep -i "access-control"
   ```

### If frontend still uses localhost:

1. **Verify build args were passed:**
   - Check pipeline logs
   - Verify Dockerfile ARG values
   - Check if image was rebuilt

2. **Check frontend pod environment:**
   ```bash
   kubectl exec -n default deployment/frontend -- env | grep REACT_APP
   ```

3. **Force frontend rebuild:**
   - Update image tag
   - Trigger pipeline again
   - Verify new image is pulled

