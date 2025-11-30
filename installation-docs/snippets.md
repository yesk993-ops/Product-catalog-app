# Azure Pipeline Snippets

## Alternative UpdateGitOps Stage - Same Repository Approach

This version updates Kubernetes manifests that are located in the same repository (in the `kubernetes/` directory) instead of a separate GitOps repository.

### For Product Service

```yaml
- stage: UpdateGitOps
  displayName: 'Update GitOps Repository'
  dependsOn: Build
  condition: succeeded()
  jobs:
    - job: UpdateManifests
      displayName: 'Update Kubernetes Manifests'
      steps:
        - checkout: self
          persistCredentials: true
          
        - script: |
            # Navigate to the kubernetes directory
            cd kubernetes/product-service
            
            # Update image tag in deployment.yaml
            # Replace the image line with new ACR image and tag
            sed -i "s|image:.*product-service.*|image: $(ACR_LOGIN_SERVER)/product-service:$(imageTag)|g" deployment.yaml
            
            # Verify the change
            echo "Updated deployment.yaml:"
            grep "image:" deployment.yaml
            
            # Configure git
            git config user.email "azure-pipelines@devops.com"
            git config user.name "Azure Pipelines"
            
            # Commit and push
            git add kubernetes/product-service/deployment.yaml
            git commit -m "Update product-service image to $(imageTag) [skip ci]"
            git push origin $(Build.SourceBranch)
          displayName: 'Update and Push Manifests'
          env:
            GIT_TERMINAL_PROMPT: 0
```

### For Ratings Service

```yaml
- stage: UpdateGitOps
  displayName: 'Update GitOps Repository'
  dependsOn: Build
  condition: succeeded()
  jobs:
    - job: UpdateManifests
      displayName: 'Update Kubernetes Manifests'
      steps:
        - checkout: self
          persistCredentials: true
          
        - script: |
            # Navigate to the kubernetes directory
            cd kubernetes/ratings-service
            
            # Update image tag in rating-deployment.yaml
            sed -i "s|image:.*ratings-service.*|image: $(ACR_LOGIN_SERVER)/ratings-service:$(imageTag)|g" rating-deployment.yaml
            
            # Verify the change
            echo "Updated rating-deployment.yaml:"
            grep "image:" rating-deployment.yaml
            
            # Configure git
            git config user.email "azure-pipelines@devops.com"
            git config user.name "Azure Pipelines"
            
            # Commit and push
            git add kubernetes/ratings-service/rating-deployment.yaml
            git commit -m "Update ratings-service image to $(imageTag) [skip ci]"
            git push origin $(Build.SourceBranch)
          displayName: 'Update and Push Manifests'
          env:
            GIT_TERMINAL_PROMPT: 0
```

### For Worker Service

```yaml
- stage: UpdateGitOps
  displayName: 'Update GitOps Repository'
  dependsOn: Build
  condition: succeeded()
  jobs:
    - job: UpdateManifests
      displayName: 'Update Kubernetes Manifests'
      steps:
        - checkout: self
          persistCredentials: true
          
        - script: |
            # Navigate to the kubernetes directory
            cd kubernetes/worker-service
            
            # Update image tag in worker-deployment.yaml
            sed -i "s|image:.*worker-service.*|image: $(ACR_LOGIN_SERVER)/worker-service:$(imageTag)|g" worker-deployment.yaml
            
            # Verify the change
            echo "Updated worker-deployment.yaml:"
            grep "image:" worker-deployment.yaml
            
            # Configure git
            git config user.email "azure-pipelines@devops.com"
            git config user.name "Azure Pipelines"
            
            # Commit and push
            git add kubernetes/worker-service/worker-deployment.yaml
            git commit -m "Update worker-service image to $(imageTag) [skip ci]"
            git push origin $(Build.SourceBranch)
          displayName: 'Update and Push Manifests'
          env:
            GIT_TERMINAL_PROMPT: 0
```

### For Frontend Service

```yaml
- stage: UpdateGitOps
  displayName: 'Update GitOps Repository'
  dependsOn: Build
  condition: succeeded()
  jobs:
    - job: UpdateManifests
      displayName: 'Update Kubernetes Manifests'
      steps:
        - checkout: self
          persistCredentials: true
          
        - script: |
            # Navigate to the kubernetes directory
            cd kubernetes/frontend
            
            # Update image tag in frontend-deployment.yaml
            sed -i "s|image:.*frontend.*|image: $(ACR_LOGIN_SERVER)/product-catalog-frontend:$(imageTag)|g" frontend-deployment.yaml
            
            # Verify the change
            echo "Updated frontend-deployment.yaml:"
            grep "image:" frontend-deployment.yaml
            
            # Configure git
            git config user.email "azure-pipelines@devops.com"
            git config user.name "Azure Pipelines"
            
            # Commit and push
            git add kubernetes/frontend/frontend-deployment.yaml
            git commit -m "Update frontend image to $(imageTag) [skip ci]"
            git push origin $(Build.SourceBranch)
          displayName: 'Update and Push Manifests'
          env:
            GIT_TERMINAL_PROMPT: 0
```

## Generic Version (Using Variable)

If you want a more generic version that works for all services using the `serviceName` variable:

```yaml
- stage: UpdateGitOps
  displayName: 'Update GitOps Repository'
  dependsOn: Build
  condition: succeeded()
  jobs:
    - job: UpdateManifests
      displayName: 'Update Kubernetes Manifests'
      steps:
        - checkout: self
          persistCredentials: true
          
        - script: |
            # Determine the manifest file name based on service
            if [ "$(serviceName)" == "product-service" ]; then
              MANIFEST_FILE="kubernetes/product-service/deployment.yaml"
            elif [ "$(serviceName)" == "ratings-service" ]; then
              MANIFEST_FILE="kubernetes/ratings-service/rating-deployment.yaml"
            elif [ "$(serviceName)" == "worker-service" ]; then
              MANIFEST_FILE="kubernetes/worker-service/worker-deployment.yaml"
            elif [ "$(serviceName)" == "product-catalog-frontend" ]; then
              MANIFEST_FILE="kubernetes/frontend/frontend-deployment.yaml"
            else
              echo "Unknown service: $(serviceName)"
              exit 1
            fi
            
            # Update image tag in the manifest file
            sed -i "s|image:.*$(serviceName).*|image: $(ACR_LOGIN_SERVER)/$(serviceName):$(imageTag)|g" $MANIFEST_FILE
            
            # Verify the change
            echo "Updated $MANIFEST_FILE:"
            grep "image:" $MANIFEST_FILE
            
            # Configure git
            git config user.email "azure-pipelines@devops.com"
            git config user.name "Azure Pipelines"
            
            # Commit and push
            git add $MANIFEST_FILE
            git commit -m "Update $(serviceName) image to $(imageTag) [skip ci]"
            git push origin $(Build.SourceBranch)
          displayName: 'Update and Push Manifests'
          env:
            GIT_TERMINAL_PROMPT: 0
```

## Key Differences from Separate GitOps Repo Approach

1. **No Git Clone**: We use `checkout: self` with `persistCredentials: true` instead of cloning a separate repo
2. **Direct Path**: We navigate directly to `kubernetes/{service-name}/` directory
3. **Same Branch**: We push to `$(Build.SourceBranch)` instead of a fixed `main` branch
4. **Manifest File Names**: Each service has a different manifest filename:
   - `product-service/deployment.yaml`
   - `ratings-service/rating-deployment.yaml`
   - `worker-service/worker-deployment.yaml`
   - `frontend/frontend-deployment.yaml`

## Important Notes

1. **Pipeline Permissions**: Ensure your pipeline has "Contribute" permission on the repository
2. **Branch Protection**: If using branch protection rules, you may need to allow pipeline commits
3. **Skip CI**: The `[skip ci]` in commit message prevents triggering pipelines on the manifest update commit
4. **Image Pattern**: The sed command looks for any line containing the service name in the image field
5. **ACR Login Server**: Make sure `ACR_LOGIN_SERVER` variable is set correctly (e.g., `productcatalogacr2024.azurecr.io`)

## Alternative: Using yq for YAML Updates (More Robust)

If you prefer a more robust YAML manipulation approach using `yq`:

```yaml
- stage: UpdateGitOps
  displayName: 'Update GitOps Repository'
  dependsOn: Build
  condition: succeeded()
  jobs:
    - job: UpdateManifests
      displayName: 'Update Kubernetes Manifests'
      steps:
        - checkout: self
          persistCredentials: true
          
        - task: UsePythonVersion@0
          inputs:
            versionSpec: '3.x'
          displayName: 'Install Python for yq'
          
        - script: |
            # Install yq (YAML processor)
            pip install yq
            
            # Determine manifest file
            if [ "$(serviceName)" == "product-service" ]; then
              MANIFEST_FILE="kubernetes/product-service/deployment.yaml"
            elif [ "$(serviceName)" == "ratings-service" ]; then
              MANIFEST_FILE="kubernetes/ratings-service/rating-deployment.yaml"
            elif [ "$(serviceName)" == "worker-service" ]; then
              MANIFEST_FILE="kubernetes/worker-service/worker-deployment.yaml"
            elif [ "$(serviceName)" == "product-catalog-frontend" ]; then
              MANIFEST_FILE="kubernetes/frontend/frontend-deployment.yaml"
            fi
            
            # Update image using yq
            yq eval ".spec.template.spec.containers[0].image = \"$(ACR_LOGIN_SERVER)/$(serviceName):$(imageTag)\"" -i $MANIFEST_FILE
            
            # Verify the change
            echo "Updated image in $MANIFEST_FILE:"
            yq eval ".spec.template.spec.containers[0].image" $MANIFEST_FILE
            
            # Configure git
            git config user.email "azure-pipelines@devops.com"
            git config user.name "Azure Pipelines"
            
            # Commit and push
            git add $MANIFEST_FILE
            git commit -m "Update $(serviceName) image to $(imageTag) [skip ci]"
            git push origin $(Build.SourceBranch)
          displayName: 'Update and Push Manifests with yq'
          env:
            GIT_TERMINAL_PROMPT: 0
```

## Repository Structure Reference

Based on [https://github.com/fred4impact/Product-catalog-app.git](https://github.com/fred4impact/Product-catalog-app.git):

```
product-catalog-app/
├── kubernetes/
│   ├── product-service/
│   │   └── deployment.yaml
│   ├── ratings-service/
│   │   └── rating-deployment.yaml
│   ├── worker-service/
│   │   └── worker-deployment.yaml
│   ├── frontend/
│   │   └── frontend-deployment.yaml
│   ├── mongodb/
│   │   └── statefulset.yaml
│   ├── redis/
│   │   └── deployment.yaml
│   └── ingress.yaml
├── product-service/
├── ratings-service/
├── worker-service/
└── frontend/
```

## Parameterized Version (Using Shell Script Parameters)

This version uses shell script parameters (`$1`, `$2`, etc.) to make it flexible and reusable for both same-repo and separate GitOps repo approaches.

### Standalone Script Version

Create a reusable script that can be called with parameters:

```yaml
- stage: UpdateGitOps
  displayName: 'Update GitOps Repository'
  dependsOn: Build
  condition: succeeded()
  jobs:
    - job: UpdateManifests
      displayName: 'Update Kubernetes Manifests'
      steps:
        - checkout: self
          persistCredentials: true
          
        - script: |
            # Parameters:
            # $1 = Service Name (e.g., product-service, ratings-service)
            # $2 = ACR Login Server (e.g., productcatalogacr2024.azurecr.io)
            # $3 = Image Tag (e.g., $(Build.BuildId))
            # $4 = Manifest File Path (optional, will be auto-detected if not provided)
            # $5 = Repository Type: "same-repo" or "separate-repo" (default: same-repo)
            # $6 = GitOps Repo URL (required only if $5 = "separate-repo")
            
            SERVICE_NAME="$1"
            ACR_LOGIN_SERVER="$2"
            IMAGE_TAG="$3"
            MANIFEST_FILE="$4"
            REPO_TYPE="${5:-same-repo}"  # Default to same-repo
            GITOPS_REPO_URL="$6"
            
            # Validate required parameters
            if [ -z "$SERVICE_NAME" ] || [ -z "$ACR_LOGIN_SERVER" ] || [ -z "$IMAGE_TAG" ]; then
              echo "Error: Missing required parameters"
              echo "Usage: $0 <service-name> <acr-login-server> <image-tag> [manifest-file] [repo-type] [gitops-repo-url]"
              exit 1
            fi
            
            # Auto-detect manifest file if not provided
            if [ -z "$MANIFEST_FILE" ]; then
              case "$SERVICE_NAME" in
                "product-service")
                  MANIFEST_FILE="kubernetes/product-service/deployment.yaml"
                  ;;
                "ratings-service")
                  MANIFEST_FILE="kubernetes/ratings-service/rating-deployment.yaml"
                  ;;
                "worker-service")
                  MANIFEST_FILE="kubernetes/worker-service/worker-deployment.yaml"
                  ;;
                "product-catalog-frontend"|"frontend")
                  MANIFEST_FILE="kubernetes/frontend/frontend-deployment.yaml"
                  ;;
                *)
                  echo "Error: Unknown service name: $SERVICE_NAME"
                  echo "Please provide manifest file path as 4th parameter"
                  exit 1
                  ;;
              esac
            fi
            
            # Handle different repository types
            if [ "$REPO_TYPE" = "separate-repo" ]; then
              # Separate GitOps repository approach
              if [ -z "$GITOPS_REPO_URL" ]; then
                echo "Error: GitOps repo URL required for separate-repo type"
                exit 1
              fi
              
              # Clone GitOps repository
              git clone "$GITOPS_REPO_URL" gitops-repo
              cd gitops-repo
              
              # Update manifest
              sed -i "s|image:.*$SERVICE_NAME.*|image: $ACR_LOGIN_SERVER/$SERVICE_NAME:$IMAGE_TAG|g" "$MANIFEST_FILE"
              
              # Configure git
              git config user.email "azure-pipelines@devops.com"
              git config user.name "Azure Pipelines"
              
              # Commit and push
              git add "$MANIFEST_FILE"
              git commit -m "Update $SERVICE_NAME image to $IMAGE_TAG [skip ci]"
              git push origin main
              
            else
              # Same repository approach (default)
              # Update manifest in current repository
              sed -i "s|image:.*$SERVICE_NAME.*|image: $ACR_LOGIN_SERVER/$SERVICE_NAME:$IMAGE_TAG|g" "$MANIFEST_FILE"
              
              # Verify the change
              echo "Updated $MANIFEST_FILE:"
              grep "image:" "$MANIFEST_FILE"
              
              # Configure git
              git config user.email "azure-pipelines@devops.com"
              git config user.name "Azure Pipelines"
              
              # Commit and push
              git add "$MANIFEST_FILE"
              git commit -m "Update $SERVICE_NAME image to $IMAGE_TAG [skip ci]"
              git push origin $(Build.SourceBranch)
            fi
            
            echo "Successfully updated $SERVICE_NAME image to $ACR_LOGIN_SERVER/$SERVICE_NAME:$IMAGE_TAG"
          displayName: 'Update and Push Manifests (Parameterized)'
          env:
            GIT_TERMINAL_PROMPT: 0
```

### Usage Examples

#### Example 1: Same Repository (Default)

```yaml
- script: |
    # Call the parameterized script
    bash -c '
      SERVICE_NAME="product-service"
      ACR_LOGIN_SERVER="$(ACR_LOGIN_SERVER)"
      IMAGE_TAG="$(Build.BuildId)"
      
      # Auto-detects manifest file and uses same-repo approach
      ./update-manifest.sh "$SERVICE_NAME" "$ACR_LOGIN_SERVER" "$IMAGE_TAG"
    '
  displayName: 'Update Product Service Manifest'
```

#### Example 2: Same Repository with Explicit Manifest Path

```yaml
- script: |
    bash -c '
      ./update-manifest.sh \
        "ratings-service" \
        "$(ACR_LOGIN_SERVER)" \
        "$(Build.BuildId)" \
        "kubernetes/ratings-service/rating-deployment.yaml" \
        "same-repo"
    '
  displayName: 'Update Ratings Service Manifest'
```

#### Example 3: Separate GitOps Repository

```yaml
- script: |
    bash -c '
      ./update-manifest.sh \
        "product-service" \
        "$(ACR_LOGIN_SERVER)" \
        "$(Build.BuildId)" \
        "product-service/deployment.yaml" \
        "separate-repo" \
        "https://$(System.AccessToken)@dev.azure.com/$(System.TeamFoundationCollectionUri | replace(''https://'', '''') | replace(''http://'', ''''))/$(System.TeamProject)/_git/product-catalog-gitops"
    '
  displayName: 'Update Product Service in GitOps Repo'
```

### Inline Parameterized Version (No External Script)

If you prefer to keep everything inline without a separate script file:

```yaml
- stage: UpdateGitOps
  displayName: 'Update GitOps Repository'
  dependsOn: Build
  condition: succeeded()
  jobs:
    - job: UpdateManifests
      displayName: 'Update Kubernetes Manifests'
      steps:
        - checkout: self
          persistCredentials: true
          
        - script: |
            # Function to update manifest
            update_manifest() {
              local SERVICE_NAME="$1"
              local ACR_LOGIN_SERVER="$2"
              local IMAGE_TAG="$3"
              local MANIFEST_FILE="$4"
              local REPO_TYPE="${5:-same-repo}"
              local GITOPS_REPO_URL="$6"
              
              # Auto-detect manifest file if not provided
              if [ -z "$MANIFEST_FILE" ]; then
                case "$SERVICE_NAME" in
                  "product-service")
                    MANIFEST_FILE="kubernetes/product-service/deployment.yaml"
                    ;;
                  "ratings-service")
                    MANIFEST_FILE="kubernetes/ratings-service/rating-deployment.yaml"
                    ;;
                  "worker-service")
                    MANIFEST_FILE="kubernetes/worker-service/worker-deployment.yaml"
                    ;;
                  "product-catalog-frontend"|"frontend")
                    MANIFEST_FILE="kubernetes/frontend/frontend-deployment.yaml"
                    ;;
                  *)
                    echo "Error: Unknown service: $SERVICE_NAME"
                    return 1
                    ;;
                esac
              fi
              
              # Update image in manifest
              sed -i "s|image:.*$SERVICE_NAME.*|image: $ACR_LOGIN_SERVER/$SERVICE_NAME:$IMAGE_TAG|g" "$MANIFEST_FILE"
              
              echo "Updated $MANIFEST_FILE with image: $ACR_LOGIN_SERVER/$SERVICE_NAME:$IMAGE_TAG"
              
              # Configure git
              git config user.email "azure-pipelines@devops.com"
              git config user.name "Azure Pipelines"
              
              # Commit and push based on repo type
              if [ "$REPO_TYPE" = "separate-repo" ] && [ -n "$GITOPS_REPO_URL" ]; then
                git clone "$GITOPS_REPO_URL" gitops-repo
                cd gitops-repo
                git add "$MANIFEST_FILE"
                git commit -m "Update $SERVICE_NAME image to $IMAGE_TAG [skip ci]"
                git push origin main
              else
                git add "$MANIFEST_FILE"
                git commit -m "Update $SERVICE_NAME image to $IMAGE_TAG [skip ci]"
                git push origin $(Build.SourceBranch)
              fi
            }
            
            # Call the function with parameters
            update_manifest \
              "$(serviceName)" \
              "$(ACR_LOGIN_SERVER)" \
              "$(imageTag)" \
              "" \
              "same-repo" \
              ""
          displayName: 'Update and Push Manifests (Inline Function)'
          env:
            GIT_TERMINAL_PROMPT: 0
```

### Using Variables in Pipeline

You can also define this as a reusable template or use pipeline variables:

```yaml
variables:
  - name: updateManifestScript
    value: |
      SERVICE_NAME="$1"
      ACR_LOGIN_SERVER="$2"
      IMAGE_TAG="$3"
      MANIFEST_FILE="${4:-}"
      REPO_TYPE="${5:-same-repo}"
      
      # Auto-detect manifest if not provided
      if [ -z "$MANIFEST_FILE" ]; then
        case "$SERVICE_NAME" in
          "product-service") MANIFEST_FILE="kubernetes/product-service/deployment.yaml" ;;
          "ratings-service") MANIFEST_FILE="kubernetes/ratings-service/rating-deployment.yaml" ;;
          "worker-service") MANIFEST_FILE="kubernetes/worker-service/worker-deployment.yaml" ;;
          "product-catalog-frontend"|"frontend") MANIFEST_FILE="kubernetes/frontend/frontend-deployment.yaml" ;;
        esac
      fi
      
      sed -i "s|image:.*$SERVICE_NAME.*|image: $ACR_LOGIN_SERVER/$SERVICE_NAME:$IMAGE_TAG|g" "$MANIFEST_FILE"
      git config user.email "azure-pipelines@devops.com"
      git config user.name "Azure Pipelines"
      git add "$MANIFEST_FILE"
      git commit -m "Update $SERVICE_NAME image to $IMAGE_TAG [skip ci]"
      git push origin $(Build.SourceBranch)

- stage: UpdateGitOps
  jobs:
    - job: UpdateManifests
      steps:
        - checkout: self
          persistCredentials: true
        - script: |
            eval "$(updateManifestScript)" "$(serviceName)" "$(ACR_LOGIN_SERVER)" "$(imageTag)"
          displayName: 'Update Manifest'
```

### Parameter Reference

| Parameter | Variable | Description | Example |
|-----------|----------|-------------|---------|
| `$1` | `SERVICE_NAME` | Name of the service | `product-service` |
| `$2` | `ACR_LOGIN_SERVER` | ACR registry URL | `productcatalogacr2024.azurecr.io` |
| `$3` | `IMAGE_TAG` | Image tag/version | `123` or `v1.0.0` |
| `$4` | `MANIFEST_FILE` | Path to manifest (optional) | `kubernetes/product-service/deployment.yaml` |
| `$5` | `REPO_TYPE` | `same-repo` or `separate-repo` | `same-repo` (default) |
| `$6` | `GITOPS_REPO_URL` | GitOps repo URL (if separate-repo) | `https://dev.azure.com/...` |

### Benefits of Parameterized Approach

1. **Reusability**: One script works for all services
2. **Flexibility**: Works with both same-repo and separate-repo approaches
3. **Maintainability**: Update logic in one place
4. **Testability**: Easy to test with different parameters
5. **Consistency**: Same update logic across all services

---

## GitOps Repository Strategy: Separate Repo vs Same Repo

### Comparison: Separate GitOps Repo vs Same Repo

#### **Separate GitOps Repository** (Recommended for Production)

**Pros:**
✅ **Clear Separation of Concerns**: Infrastructure code separate from application code  
✅ **Independent Access Control**: Different teams can manage infrastructure vs application  
✅ **Better Security**: Infrastructure changes require separate approval process  
✅ **Cleaner Git History**: Application commits don't mix with infrastructure updates  
✅ **Easier Rollbacks**: Can rollback infrastructure independently of application code  
✅ **Multi-Environment Support**: Easier to manage dev/staging/prod with different branches  
✅ **Compliance**: Better audit trail for infrastructure changes  
✅ **Team Collaboration**: DevOps team can manage manifests without touching application code  
✅ **ArgoCD Best Practice**: Aligns with GitOps best practices and ArgoCD recommendations  

**Cons:**
❌ **More Complex Setup**: Requires managing two repositories  
❌ **Additional Overhead**: Need to clone and manage separate repo in pipelines  
❌ **Synchronization**: Must ensure image tags match between repos  
❌ **More Moving Parts**: More things that can go wrong  

**Best For:**
- Production environments
- Large teams with separate DevOps teams
- Multi-environment deployments (dev/staging/prod)
- Organizations with strict compliance requirements
- When infrastructure changes need separate approval workflows
- Enterprise environments

---

#### **Same Repository (Monorepo)** (Good for Small Teams/Projects)

**Pros:**
✅ **Simpler Setup**: Everything in one place, easier to get started  
✅ **Atomic Changes**: Application code and infrastructure changes in same commit  
✅ **Easier Navigation**: Developers can see infrastructure alongside code  
✅ **Less Overhead**: No need to clone separate repos in pipelines  
✅ **Faster Development**: Quicker to make changes during development  
✅ **Single Source of Truth**: All project code in one repository  
✅ **Easier for Small Teams**: Less complexity for solo developers or small teams  

**Cons:**
❌ **Mixed Concerns**: Application and infrastructure code together  
❌ **Noisy Git History**: Infrastructure updates clutter application commit history  
❌ **Access Control**: Harder to restrict who can change infrastructure  
❌ **Rollback Complexity**: Rolling back infrastructure might affect application code  
❌ **Branch Management**: More complex when managing multiple environments  
❌ **Security Concerns**: Developers with code access also have infrastructure access  

**Best For:**
- Small teams or solo developers
- Development/staging environments
- Learning projects and portfolios
- Projects where infrastructure changes frequently with code
- Startups and small companies
- When you want to keep everything simple

---

### **Recommendation Matrix**

| Scenario | Recommended Approach | Reason |
|----------|---------------------|--------|
| **Production Environment** | Separate Repo | Security, compliance, clear separation |
| **Small Team (< 5 people)** | Same Repo | Simplicity, less overhead |
| **Large Team (> 10 people)** | Separate Repo | Better access control, team separation |
| **Learning/Portfolio Project** | Same Repo | Simpler, easier to understand |
| **Multi-Environment (dev/staging/prod)** | Separate Repo | Easier environment management |
| **Startup/Early Stage** | Same Repo | Move fast, less complexity |
| **Enterprise/Compliance Required** | Separate Repo | Better audit trail, security |
| **Single Developer** | Same Repo | Simplicity wins |

---

### **Hybrid Approach** (Best of Both Worlds)

You can also use a **hybrid approach**:

1. **Development/Staging**: Use same repo for speed and simplicity
2. **Production**: Use separate GitOps repo for security and compliance

```yaml
# Example: Conditional logic based on environment
- script: |
    if [ "$(Build.SourceBranch)" = "main" ] || [ "$(Build.SourceBranch)" = "production" ]; then
      # Use separate GitOps repo for production
      REPO_TYPE="separate-repo"
      GITOPS_REPO_URL="https://dev.azure.com/.../product-catalog-gitops"
    else
      # Use same repo for dev/staging
      REPO_TYPE="same-repo"
    fi
    
    update_manifest "$(serviceName)" "$(ACR_LOGIN_SERVER)" "$(imageTag)" "" "$REPO_TYPE" "$GITOPS_REPO_URL"
```

---

### **My Recommendation**

**For Your Product Catalog App (Portfolio/Learning Project):**

**Start with Same Repo** because:
1. ✅ You're learning - keep it simple
2. ✅ Small project - less complexity is better
3. ✅ Faster iteration - easier to make changes
4. ✅ Portfolio showcase - shows you understand both approaches
5. ✅ Can always migrate later if needed

**Migrate to Separate Repo when:**
- You're deploying to production
- You have multiple environments
- You're working with a team
- You need stricter access controls

**For Production/Enterprise:**
**Use Separate Repo** because:
1. ✅ Better security and compliance
2. ✅ Clear separation of concerns
3. ✅ Industry best practice
4. ✅ Better for team collaboration
5. ✅ Easier multi-environment management

---

### **Real-World Examples**

**Companies Using Separate GitOps Repos:**
- Netflix, Spotify, Google (large scale)
- Most enterprise companies
- Organizations with dedicated DevOps teams

**Companies Using Same Repo:**
- Many startups
- Small development teams
- Open source projects
- Personal/portfolio projects

---

### **Conclusion**

**Both approaches are valid**, but choose based on:
- **Team size**: Small = same repo, Large = separate repo
- **Environment**: Dev = same repo, Prod = separate repo  
- **Complexity tolerance**: Simple = same repo, Enterprise = separate repo
- **Compliance needs**: Low = same repo, High = separate repo

**For learning and portfolio projects**: Start with **same repo** - it's simpler and you can always migrate later!

**For production**: Use **separate repo** - it's the industry standard and better for security/compliance.


