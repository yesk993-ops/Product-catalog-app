# Migrating Your Application to Azure: A Complete Beginner's Guide to Azure DevOps CI/CD with Kubernetes

*Published on Medium | January 2025*

---

## Introduction

If you're new to DevOps and cloud computing, migrating your application to Azure and setting up a complete CI/CD pipeline can feel overwhelming. Terms like "Kubernetes," "Container Registry," and "GitOps" might sound like a foreign language. But don't worry—this guide will walk you through every step of migrating your application to Azure using the Azure Portal's user-friendly interface, no command-line expertise required!

In this blog post, I'll show you how to migrate a real-world application (a Product Catalog App) to Azure using only the web interface. This is a complete migration project that will take you from your existing application to a fully automated Azure-based CI/CD pipeline. By the end, you'll have successfully migrated your application and set up a pipeline that builds, tests, and deploys your application whenever you push code to your repository.

## About the Application We're Migrating

The **Product Catalog & Ratings App** is a microservices-based e-commerce application that demonstrates modern DevOps practices. This application consists of:

- **Product Service** (Port 5000) - Manages product catalog CRUD operations
- **Ratings Service** (Port 5001) - Handles user ratings and publishes events
- **Worker Service** - Processes rating events and updates product averages asynchronously
- **Frontend Service** (Port 3000) - React-based user interface
- **MongoDB** - Single instance with separate databases for products and ratings
- **Redis** - Message queue for asynchronous event processing between services

This microservices architecture is perfect for learning cloud migration because it involves multiple services, containerization, and demonstrates how to handle inter-service communication. Throughout this migration project, we'll containerize each service, set up automated builds, and deploy everything to Azure Kubernetes Service (AKS) with proper CI/CD workflows.

## What You'll Migrate and Build

This migration project will help you move your application to Azure and set up a complete CI/CD infrastructure. By following this guide, you'll migrate your application and create:

- **Azure Container Registry (ACR)**: A private Docker image storage for your migrated application
- **Azure Kubernetes Service (AKS)**: A managed Kubernetes cluster to run your migrated application
- **Azure DevOps Pipelines**: Automated CI/CD workflows for your migrated application
- **Self-Hosted Build Agent**: A virtual machine that runs your builds
- **ArgoCD**: A GitOps tool that automatically deploys your migrated application
- **Complete CI/CD Pipeline**: From code push to production deployment for your migrated application

## Prerequisites: What You Need Before Starting

Before diving in, make sure you have:

1. **An Azure Subscription**: If you don't have one, you can create a free account at [azure.microsoft.com/free](https://azure.microsoft.com/free)
2. **An Azure DevOps Account**: This is free and comes with your Azure account
3. **A Web Browser**: Chrome, Edge, or Firefox work best
4. **Basic Understanding**: Familiarity with web applications and Git (helpful but not required)

**Note**: Some Azure services have costs, but you can use the free tier for learning. Always monitor your usage!

---

## Part 1: Setting Up Your Azure Infrastructure

### Step 1: Create a Resource Group

Think of a resource group as a folder that holds all your related Azure resources. It helps you organize and manage everything together.

**How to do it:**

1. Go to [portal.azure.com](https://portal.azure.com) and sign in
2. In the left menu, click **"Resource groups"** (or search for it)
3. Click the **"+ Create"** button at the top
4. Fill in the form:
   - **Subscription**: Select your subscription
   - **Resource group name**: Enter `product-catalog-rg` (or any name you prefer)
   - **Region**: Choose a region close to you (e.g., "East US" or "West Europe")
5. Click **"Review + create"**, then **"Create"**
6. Wait for the notification confirming it's created

**Pro Tip**: Always use consistent naming conventions. The `-rg` suffix helps identify resource groups.

### Step 2: Create Azure Container Registry (ACR)

A Container Registry is like a private Docker Hub where you store your application's Docker images. Think of it as a warehouse for your containerized applications.

**How to do it:**

1. In Azure Portal, click **"+ Create a resource"** (top left)
2. Search for **"Container Registry"** and click **"Create"**
3. Configure the settings:
   - **Subscription**: Your subscription
   - **Resource group**: Select `product-catalog-rg` (the one you just created)
   - **Registry name**: Enter something unique like `productacr2025`
     - ⚠️ **Important**: This must be globally unique, lowercase, and alphanumeric only
     - Azure will tell you if the name is available
   - **Location**: Same region as your resource group
   - **SKU**: Select **"Basic"** (perfect for learning and small projects)
   - **Admin user**: Toggle **"Enable admin user"** to **ON**
     - This allows username/password authentication (simpler for beginners)
4. Click **"Review + create"**, then **"Create"**
5. Wait 2-3 minutes for deployment

**Save Your Credentials:**

Once created, click **"Go to resource"**, then:
1. Click **"Access keys"** in the left menu
2. **Write down these three things** (you'll need them later):
   - **Login server**: Something like `productacr2025.azurecr.io`
   - **Username**: The admin username
   - **Password**: Click **"Show"** and copy it

**Why this matters**: These credentials let your pipelines push Docker images to the registry.

### Step 3: Create Azure Kubernetes Service (AKS)

Kubernetes (often called K8s) is a platform for running containerized applications. AKS is Azure's managed version—think of it as a smart system that automatically handles running, scaling, and managing your applications.

**How to do it:**

1. Click **"+ Create a resource"** → Search **"Kubernetes Service"** → **"Create"**

2. **Basics Tab:**
   - **Subscription**: Your subscription
   - **Resource group**: `product-catalog-rg`
   - **Cluster name**: `product-catalog-cluster`
   - **Region**: Same as resource group
   - **Kubernetes version**: Select the latest stable (e.g., `1.28.x`)
   - **Node size**: Click **"Change size"** → Select `Standard_B2s` (2 CPUs, 4 GB RAM)
   - **Scale method**: **"Manual"**
   - **Node count**: `3` (three worker nodes)
   - Click **"Next: Node pools"**

3. **Node Pools Tab:**
   - Leave defaults → Click **"Next: Access"**

4. **Access Tab:**
   - **Authentication method**: **"System-assigned managed identity"**
   - **Authorize with Azure Container Registry**: Toggle **ON**
   - Select your ACR from the dropdown
   - Click **"Next: Networking"**

5. **Networking Tab:**
   - **Network configuration**: **"Azure CNI"** (or **"kubenet"** for simpler setup)
   - Click **"Next: Integrations"**

6. **Integrations Tab:**
   - **Container monitoring**: Enable **"Enable Container insights"** ✅
   - Click **"Next: Tags"**

7. **Tags Tab:**
   - Optional: Add tags like `Environment: Production`, `Project: ProductCatalog`
   - Click **"Next: Review + create"**

8. **Review and Create:**
   - Review everything → Click **"Create"**
   - ⏰ **This takes 10-15 minutes**—grab a coffee!

9. **After Creation:**
   - Click **"Go to resource"**
   - Click **"Connect"** in the left menu
   - Note the cluster name and resource group (you'll need these later)

**What just happened**: You created a Kubernetes cluster with 3 worker nodes. This is where your application will run.

---

## Part 2: Setting Up Your Build Agent

### Step 4: Create a Virtual Machine for Your Build Agent

A build agent is a machine that runs your CI/CD pipelines. Instead of using Microsoft's shared agents, we'll create our own for more control and customization.

**How to do it:**

1. **"+ Create a resource"** → Search **"Virtual machine"** → **"Create"**

2. **Basics Tab:**
   - **Subscription**: Your subscription
   - **Resource group**: `product-catalog-rg`
   - **VM name**: `productagentvm`
   - **Region**: Same as resource group
   - **Image**: **"Ubuntu Server 22.04 LTS"**
   - **Size**: Click **"See all sizes"** → Select `Standard_D2s_v3` (2 CPUs, 8 GB RAM)
   - **Authentication**: **"SSH public key"**
   - **Username**: `azureuser`
   - **SSH key**: **"Generate new key pair"** or use existing
   - **Key pair name**: `devops-agent-key`
   - Click **"Next: Disks"**

3. **Disks Tab:**
   - **OS disk type**: **"Premium SSD"** (or Standard for cost savings)
   - Click **"Next: Networking"**

4. **Networking Tab:**
   - **Public IP**: Ensure **"Create new"** is selected
   - **Public inbound ports**: **"Allow selected ports"**
   - **Select ports**: Check **"SSH (22)"**
   - Click **"Next: Management"**

5. **Management & Monitoring Tabs:**
   - Leave defaults → Click through to **"Review + create"**

6. **Create:**
   - If generating a new key, **download the private key** when prompted
   - Click **"Create"** → Wait 2-3 minutes

7. **Get Connection Info:**
   - Click **"Go to resource"**
   - Note the **Public IP address**

### Step 5: Install Required Software on Your VM

Now you need to connect to your VM and install the tools needed for building your application.

**Connect via SSH:**

```bash
# If you downloaded a new key:
ssh -i ~/Downloads/devops-agent-key.pem azureuser@<VM_PUBLIC_IP>

# Or if using an existing key:
ssh azureuser@<VM_PUBLIC_IP>
```

**Install Docker** (for building container images):

```bash
# Update system
sudo apt-get update && sudo apt-get upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Start Docker
sudo systemctl enable docker
sudo systemctl start docker

# Verify it works
docker --version
docker run hello-world
```

**Install Node.js** (for building your application):

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify
node --version
npm --version
```

**Install Git and Build Tools:**

```bash
sudo apt-get install -y git build-essential
git --version
```

**Optional: Install Azure CLI:**

```bash
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
az --version
```

**What you just did**: Your VM is now ready to build Docker images and run Node.js applications.

---

## Part 3: Setting Up Azure DevOps

### Step 6: Create Your Azure DevOps Project

Azure DevOps is Microsoft's platform for managing code, pipelines, and deployments. It's like GitHub + CI/CD tools combined.

**How to do it:**

1. Go to [dev.azure.com](https://dev.azure.com) and sign in
2. **Create Organization** (if you don't have one):
   - Click **"Create new organization"**
   - Enter a name (e.g., `product-catalog-org`)
   - Select a region
   - Click **"Continue"**

3. **Create Project:**
   - Click **"New project"**
   - **Project name**: `Product-Catalog-App`
   - **Visibility**: **"Private"** (or Public if you prefer)
   - **Version control**: **"Git"**
   - **Work item process**: **"Agile"**
   - Click **"Create"**
   - Wait 30 seconds

4. **Bookmark the project page** for easy access!

### Step 7: Import Your Repository

You need to get your code into Azure Repos (Azure's Git hosting).

**How to do it:**

1. In your project, click **"Repos"** → **"Files"**
2. Click the **"..."** menu (three dots) next to the repository name
3. Select **"Import repository"**
4. In the dialog:
   - **Source type**: **"Git"**
   - **Clone URL**: `https://github.com/fred4impact/Product-catalog-app.git`
   - **Name**: Keep default or change to `Product-catalog-app`
5. Click **"Import"** → Wait 1-2 minutes
6. Verify by browsing the repository structure

### Step 8: Create an Agent Pool

An agent pool is a group of build agents. You'll add your VM to this pool.

**How to do it:**

1. Click **"Project settings"** (gear icon at bottom left)
2. Under **"Pipelines"**, click **"Agent pools"**
3. Click **"+ New agent pool"**
4. **Pool type**: **"Self-hosted"**
5. **Name**: `productagent`
6. **Auto-provision agents**: Leave unchecked
7. Click **"Create"**

### Step 9: Install and Configure the Agent on Your VM

This connects your VM to Azure DevOps so it can run pipeline jobs.

**Get Agent Download Instructions:**

1. In Azure DevOps: **Agent pools** → `productagent` → **"New agent"**
2. Select **"Linux"** tab
3. You'll see download instructions—keep this page open

**On Your VM, Download the Agent:**

```bash
# Create agent directory
mkdir -p ~/myagent && cd ~/myagent

# Download agent (use the latest version URL from Azure DevOps)
curl -o agent.tar.gz https://vstsagentpackage.azureedge.net/agent/3.227.2/vsts-agent-linux-x64-3.227.2.tar.gz

# Extract
tar zxvf agent.tar.gz
```

**Create a Personal Access Token (PAT):**

1. In Azure DevOps, click your profile icon (top right)
2. Click **"Personal access tokens"**
3. Click **"+ New Token"**
4. **Name**: `DevOps Agent Token`
5. **Organization**: Select your organization
6. **Expiration**: 90 days (or your preference)
7. **Scopes**: **"Custom defined"**
   - Under **"Agent Pools"**, check **"Read & manage"**
8. Click **"Create"**
9. **⚠️ Copy the token immediately** (you won't see it again!)

**Configure the Agent:**

Back on your VM:

```bash
./config.sh
```

When prompted, enter:
- **Server URL**: `https://dev.azure.com/{your-org-name}`
- **Authentication type**: `PAT`
- **Personal access token**: Paste your PAT
- **Agent pool**: `productagent`
- **Agent name**: `devops-agent-vm`
- **Work folder**: Press Enter (default)
- **Unzip for tasks**: Press Enter (default: N)
- **Run as service**: `Y`
- **User account**: Press Enter (default: root)
- **Prevent service start**: Press Enter (default: N)

**Verify Installation:**

```bash
# Check status
sudo ./svc.sh status

# View logs
sudo ./svc.sh check
```

**Verify in Azure DevOps:**

1. Go to **Agent pools** → `productagent`
2. You should see your agent listed
3. Status should show **"Online"** (green circle) ✅

**Congratulations!** Your build agent is now connected and ready to run pipelines.

---

## Part 4: Configuring Your CI/CD Pipeline

### Step 10: Create Service Connection for ACR

A service connection lets Azure DevOps securely access your Container Registry.

**How to do it:**

1. **Project settings** → **"Service connections"** (under Pipelines)
2. Click **"+ New service connection"**
3. Select **"Docker Registry"** → Click **"Next"**
4. Configure:
   - **Registry type**: **"Azure Container Registry"**
   - **Azure subscription**: Your subscription
   - **Azure container registry**: Select your ACR
   - **Service connection name**: `ACR-Connection`
   - **Grant access to all pipelines**: ✅ Check this
5. Click **"Save"**
6. Verify it shows as **"Verified"** ✅

### Step 11: Create Variable Group

Variable groups store configuration values that your pipelines can use. This keeps your pipelines clean and makes updates easier.

**How to do it:**

1. **Pipelines** → **"Library"**
2. Click **"+ Variable group"**
3. **Name**: `ProductCatalog-Variables`

4. **Add Variables** (click **"+ Add"** for each):

   | Name | Value | Secret? |
   |------|-------|---------|
   | `ACR_NAME` | `productcatalogacr2024` (your ACR name) | No |
   | `ACR_LOGIN_SERVER` | `productcatalogacr2024.azurecr.io` (your ACR login server) | No |
   | `AKS_CLUSTER_NAME` | `product-catalog-aks` | No |
   | `RESOURCE_GROUP` | `product-catalog-rg` | No |
   | `GITOPS_REPO_URL` | (We'll set this later) | No |
   | `GITOPS_REPO_BRANCH` | `main` | No |
   | `NAMESPACE` | `product-catalog` | No |

5. Click **"Save"**
6. **Allow access to all pipelines**: ✅ Check this
7. Click **"Save"** again

### Step 12: Create Your First Pipeline

Now for the exciting part—creating an automated pipeline that builds and deploys your application!

**How to do it:**

1. **Pipelines** → **"Pipelines"** → **"Create Pipeline"**

2. **Select Source:**
   - **Where is your code?**: **"Azure Repos Git"**
   - Select repository: `Product-catalog-app`
   - Click **"Continue"**

3. **Configure Pipeline:**
   - Click **"Starter pipeline"** (or **"Empty job"**)
   - This opens the YAML editor

4. **Replace YAML Content:**
   - Delete the default YAML
   - Copy and paste your pipeline YAML (from your project documentation)
   - **⚠️ Important**: Ensure it uses `pool: name: productagent` (not `vmImage`)
   - Update the GitOps repository URL if needed

5. **Save Pipeline:**
   - Click **"Save"**
   - **Save as**: `product-service-pipeline`
   - **Commit message**: "Add product service pipeline"
   - **Commit directly to main**: ✅ Select this
   - Click **"Save"**

6. **Repeat for Other Services:**
   - Create pipelines for:
     - `ratings-service-pipeline`
     - `worker-service-pipeline`
     - `frontend-pipeline`

**Grant Permissions:**

When you run a pipeline for the first time, you may see permission prompts. Click **"Permit"** to grant access to:
- Variable group: `ProductCatalog-Variables`
- Service connection: `ACR-Connection`
- Repository: `Product-catalog-app`

---

## Part 5: Setting Up GitOps with ArgoCD

### Step 13: Create GitOps Repository

GitOps means using Git as the "source of truth" for your infrastructure. When you update Kubernetes manifests in Git, ArgoCD automatically applies those changes to your cluster.

**How to do it:**

1. **Repos** → **"Files"**
2. Click the repository dropdown → **"New repository"**
3. **Repository name**: `product-catalog-gitops`
4. **Type**: Git
5. Click **"Create"**

6. **Initialize Repository:**
   - Click **"Initialize"** to add a README
   - Or clone it locally to add your Kubernetes manifests

7. **Upload Kubernetes Manifests:**
   - **Option A**: Upload via web UI (click **"Upload file(s)"**)
   - **Option B**: Clone and push via Git:
     ```bash
     git clone <clone-url>
     # Copy your Kubernetes manifests here
     git add .
     git commit -m "Add Kubernetes manifests"
     git push
     ```

8. **Update Image References:**
   - Edit each deployment YAML file
   - Replace image references with your ACR login server:
     - Example: `productcatalogacr2024.azurecr.io/product-service:latest`

9. **Note Repository URL:**
   - Copy the URL: `https://dev.azure.com/{org}/{project}/_git/product-catalog-gitops`
   - Update `GITOPS_REPO_URL` in your variable group

### Step 14: Install ArgoCD

ArgoCD is a GitOps tool that watches your Git repository and automatically deploys changes to Kubernetes.

**How to do it (using Azure Cloud Shell):**

1. **Open Cloud Shell:**
   - In Azure Portal, click the **Cloud Shell icon** (top right, `>_` symbol)
   - Select **"Bash"** (not PowerShell)
   - Wait for initialization

2. **Connect to AKS:**
   ```bash
   az aks get-credentials --resource-group product-catalog-rg --name product-catalog-aks
   kubectl get nodes  # Verify connection
   ```

3. **Install ArgoCD:**
   ```bash
   # Create namespace
   kubectl create namespace argocd
   
   # Install ArgoCD
   kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
   
   # Wait for pods (2-3 minutes)
   kubectl get pods -n argocd -w
   # Press Ctrl+C when all pods show "Running"
   ```

4. **Expose ArgoCD Server:**
   - In Azure Portal: AKS cluster → **"Services and ingresses"**
   - Click **"argocd-server"** service (in `argocd` namespace)
   - Click **"Edit"**
   - Change **"Service type"** from `ClusterIP` to `LoadBalancer`
   - Click **"Save"**
   - Wait 2-3 minutes for external IP

5. **Get Admin Password:**
   ```bash
   kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d && echo
   ```
   **Copy this password!**

6. **Access ArgoCD UI:**
   - In Azure Portal: **Services and ingresses** → Find `argocd-server`
   - Copy the **External IP**
   - Open browser: `http://<external-ip>`
   - Login:
     - **Username**: `admin`
     - **Password**: (the password you copied)

### Step 15: Configure ArgoCD Application

Now connect ArgoCD to your GitOps repository and create an application.

**Add Repository:**

1. In ArgoCD UI: **Settings** → **"Repositories"**
2. Click **"Connect Repo"**
3. Configure:
   - **Connection method**: **"HTTPS"**
   - **Repository URL**: Your GitOps repo URL
   - **Type**: **"git"**
   - **Username**: Your Azure DevOps username
   - **Password**: A Personal Access Token (PAT)
     - Create PAT: Azure DevOps → User Settings → Personal Access Tokens
     - Scopes: **"Code (read)"**
4. Click **"Connect"**
5. Verify status shows **"Successful"** ✅

**Create Application:**

1. **Applications** → **"+ NEW APP"**

2. **General Settings:**
   - **Application Name**: `product-catalog-app`
   - **Project Name**: `default`
   - **Sync Policy**: **"Automatic"**
   - **Self Heal**: ✅
   - **Prune Resources**: ✅

3. **Source:**
   - **Repository URL**: Select your GitOps repository
   - **Revision**: `main`
   - **Path**: `.` (root)

4. **Destination:**
   - **Cluster URL**: `https://kubernetes.default.svc`
   - **Namespace**: `product-catalog`
   - **Create Namespace**: ✅

5. **Sync Options:**
   - Click **"Edit"**
   - Enable: **"Create Namespace"**, **"Prune Last"**, **"Apply Out of Sync Only"**
   - Click **"Save"**

6. **Create:**
   - Click **"Create"**
   - Watch the application sync automatically!

7. **Monitor:**
   - Click on the application to see sync status
   - Wait for all resources to show **"Synced"** (green) ✅

---

## Part 6: Deploy and Verify

### Step 16: Deploy Infrastructure Services

Your application needs MongoDB and Redis to run.

**Check in ArgoCD:**
- In ArgoCD UI, click on `product-catalog-app`
- Verify MongoDB and Redis are deployed

**Or Deploy Manually (if needed):**
- Use Azure Cloud Shell to apply manifests:
  ```bash
  kubectl apply -f <path-to-manifests> -n product-catalog
  ```

**Verify Pods:**
- Azure Portal → AKS cluster → **"Workloads"**
- Select namespace: `product-catalog`
- Verify all pods are running:
  - `mongodb-*`
  - `redis-*`
  - `product-service-*`
  - `ratings-service-*`
  - `worker-service-*`
  - `frontend-*`

### Step 17: Expose Frontend Service

Make your application accessible from the internet.

**How to do it:**

1. Azure Portal → AKS cluster → **"Services and ingresses"**
2. Click **"+ Create"** → **"Service"**
3. Configure:
   - **Name**: `frontend-lb`
   - **Namespace**: `product-catalog`
   - **Service type**: **"LoadBalancer"**
   - **Port**: `80`
   - **Target port**: `80`
   - **Selector**: `app: frontend`
4. Click **"Create"**
5. Wait 2-3 minutes for external IP
6. **Access your app**: `http://<external-ip>`

### Step 18: Verify Everything Works

**Check ArgoCD:**
- Application status: **"Healthy"** ✅
- Sync status: **"Synced"** ✅
- All resources: Green ✅

**View Logs:**
- Azure Portal → AKS → **"Workloads"**
- Click a deployment → Click a pod → **"View live logs"**

**Test API:**
```bash
# Port forward to test locally
kubectl port-forward svc/product-service -n product-catalog 5000:5000

# In another terminal
curl http://localhost:5000/health
```

**Monitor Pipelines:**
- Azure DevOps → **"Pipelines"**
- Click a pipeline → View recent runs
- Click **"Run pipeline"** to trigger manually

**Verify Images:**
- Azure Portal → ACR → **"Repositories"**
- Verify images are being pushed:
  - `product-service`
  - `ratings-service`
  - `worker-service`
  - `product-catalog-frontend`

---

## Understanding the Complete Flow

Now that everything is set up, here's what happens when you push code:

1. **Developer pushes code** → Azure Repos
2. **Pipeline triggers** → Detects code change
3. **Pipeline runs on agent VM** → Builds and tests code
4. **Pipeline builds Docker image** → Pushes to ACR with build ID tag
5. **Pipeline updates GitOps repo** → Updates image tag in Kubernetes manifests
6. **ArgoCD detects change** → Monitors GitOps repository
7. **ArgoCD syncs to AKS** → Applies updated manifests
8. **Kubernetes pulls new image** → From ACR
9. **Application updates** → Rolling update with zero downtime! 🎉

---

## Common Issues and Solutions

### Issue: Cannot Access ArgoCD UI

**Solution:**
- Check LoadBalancer service in Azure Portal
- Verify external IP is assigned
- Try port-forward: `kubectl port-forward svc/argocd-server -n argocd 8080:443`

### Issue: Pipeline Fails to Push to ACR

**Solution:**
- Verify service connection: Project Settings → Service connections
- Check ACR admin user is enabled: Azure Portal → ACR → Access keys

### Issue: ArgoCD Cannot Access Git Repository

**Solution:**
- Verify repository URL in ArgoCD: Settings → Repositories
- Check PAT permissions: Azure DevOps → User Settings → Personal Access Tokens
- Ensure token has "Code (read)" permission

### Issue: Pods Stuck in ImagePullBackOff

**Solution:**
- Verify ACR secret exists in namespace
- Recreate secret with ACR credentials using Cloud Shell

### Issue: Application Out of Sync in ArgoCD

**Solution:**
- In ArgoCD UI, click on application → Click **"Sync"**
- Monitor sync progress
- Check application logs if issues persist

---

## Quick Reference: Navigation Paths

### Azure Portal
- **Resource Groups**: Home → Resource groups
- **Container Registries**: Home → Container registries
- **Kubernetes Services**: Home → Kubernetes services
- **Cloud Shell**: Top right icon `>_`

### Azure DevOps
- **Projects**: `https://dev.azure.com/{org}`
- **Repos**: Project → Repos → Files
- **Pipelines**: Project → Pipelines → Pipelines
- **Service Connections**: Project → Project Settings → Service connections
- **Variable Groups**: Project → Pipelines → Library

### ArgoCD UI
- **Applications**: Left menu → Applications
- **Repositories**: Left menu → Settings → Repositories
- **Application Details**: Click on application name

---

## What You've Accomplished

Congratulations! You've successfully completed your migration project and set up a complete CI/CD pipeline on Azure. Here's what you migrated and built:

✅ **Migrated Application**: Successfully moved your application to Azure  
✅ **Azure Infrastructure**: Resource group, ACR, AKS cluster, and VM  
✅ **Build Agent**: Self-hosted agent connected to Azure DevOps  
✅ **CI/CD Pipelines**: Automated build, test, and deployment workflows for your migrated application  
✅ **GitOps**: ArgoCD automatically deploying your migrated application from Git  
✅ **Production-Ready Application**: Your migrated application running on Kubernetes with monitoring  

## Next Steps

Now that you have a working pipeline, consider:

1. **Add Monitoring**: Set up Azure Monitor and Application Insights
2. **Configure Alerts**: Get notified when deployments fail
3. **Implement Blue-Green Deployments**: For zero-downtime updates
4. **Set Up Backups**: Backup MongoDB data regularly
5. **Configure SSL/TLS**: Secure your application with HTTPS
6. **Implement Network Policies**: Enhance security
7. **Cost Optimization**: Monitor and optimize Azure costs

## Conclusion

Migrating your application to Azure and setting up a complete CI/CD pipeline might seem daunting at first, but by breaking it down into manageable steps and using Azure's intuitive UI, it becomes much more approachable. Through this migration project, you've learned how to:

- Migrate your application to Azure
- Set up Azure infrastructure through the portal
- Configure build agents and pipelines for your migrated application
- Implement GitOps with ArgoCD
- Deploy your migrated application to Kubernetes

This migration project has given you a solid foundation that will serve you well as you continue your DevOps journey. Remember, every expert was once a beginner—keep experimenting, learning, and building!

---

**About the Author**: This migration guide was created to help beginners understand how to migrate applications to Azure DevOps and Kubernetes. For questions or feedback, feel free to reach out!

**Resources**:
- [Azure Kubernetes Service Documentation](https://docs.microsoft.com/azure/aks/)
- [Azure Container Registry Documentation](https://docs.microsoft.com/azure/container-registry/)
- [Azure Pipelines Documentation](https://docs.microsoft.com/azure/devops/pipelines/)
- [ArgoCD Documentation](https://argo-cd.readthedocs.io/)

---

*Happy Deploying! 🚀*

