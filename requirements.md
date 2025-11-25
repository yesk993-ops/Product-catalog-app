# Product Catalog & Ratings App - Requirements Document

## 📋 Overview

**Application Name:** Product Catalog & Ratings App (Microservices Architecture)

**Purpose:** 
A microservices-based e-commerce application that allows users to browse products, submit ratings, and view real-time average ratings. This application is designed to showcase DevOps best practices including microservices architecture, containerization, CI/CD pipelines, and cloud-native deployment strategies.

**Key Objectives:**
- Demonstrate microservices architecture with independent services
- Implement separate CI/CD pipelines for each microservice
- Showcase containerization and orchestration capabilities
- Implement asynchronous processing with message queues
- Provide real-time updates and monitoring

---

## 🏗️ Architecture Overview

### Microservices Architecture

The application follows a microservices architecture pattern where each service is:
- **Independently deployable** with its own CI/CD pipeline
- **Loosely coupled** through message queues and REST APIs
- **Scalable** independently based on load
- **Containerized** using Docker
- **Orchestrated** using Kubernetes

### System Architecture Diagram

```
┌─────────────┐
│   Frontend  │ (React/Next.js)
│   Service   │
└──────┬──────┘
       │
       ├──────────────┬──────────────┐
       │              │              │
┌──────▼──────┐ ┌─────▼──────┐ ┌────▼─────┐
│   Product   │ │  Ratings   │ │  Worker  │
│   Service   │ │  Service   │ │ Service  │
└──────┬──────┘ └─────┬──────┘ └────┬─────┘
       │              │              │
       │              │              │
       └──────────────┴──────────────┘
                      │
            ┌─────────▼─────────┐
            │     MongoDB       │
            │  (products DB)    │
            │  (ratings DB)     │
            └─────────┬─────────┘
                      │
            ┌─────────▼─────────┐
            │      Redis         │
            │   (Message Queue)  │
            └────────────────────┘
```

**Note:** Both Product and Ratings services use the same MongoDB instance but different databases for logical separation and simplicity.

---

## 🔧 Microservices & Responsibilities

| Service | Technology Stack | Port | Responsibility |
|---------|-----------------|------|----------------|
| **Product Service** | Node.js/Express | 5000 | CRUD operations for products (list, add, update, delete) |
| **Ratings Service** | Node.js/Express | 5001 | Receive user ratings, store in DB, publish rating events |
| **Worker Service** | Node.js | N/A | Process rating events from queue to calculate average ratings |
| **Frontend Service** | React/Next.js | 3000 | Display products, ratings, and allow rating submissions |
| **Database** | MongoDB | 27017 | Single MongoDB instance storing both products and ratings (separate databases) |
| **Message Queue** | Redis | 6379 | Asynchronous rating processing |

---

## 📁 Project Structure

```
product-catalog-app/
│
├── product-service/
│   ├── src/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── config/
│   │   └── server.js
│   ├── tests/
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── package.json
│   └── .github/
│       └── workflows/
│           └── product-service-ci.yml
│
├── ratings-service/
│   ├── src/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── config/
│   │   └── server.js
│   ├── tests/
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── package.json
│   └── .github/
│       └── workflows/
│           └── ratings-service-ci.yml
│
├── worker-service/
│   ├── src/
│   │   └── worker.js
│   ├── tests/
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── package.json
│   └── .github/
│       └── workflows/
│           └── worker-service-ci.yml
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   └── App.js
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── package.json
│   └── .github/
│       └── workflows/
│           └── frontend-ci.yml
│
├── infrastructure/
│   ├── kubernetes/
│   │   ├── product-service/
│   │   │   ├── deployment.yaml
│   │   │   ├── service.yaml
│   │   │   └── configmap.yaml
│   │   ├── ratings-service/
│   │   │   ├── deployment.yaml
│   │   │   ├── service.yaml
│   │   │   └── configmap.yaml
│   │   ├── worker-service/
│   │   │   ├── deployment.yaml
│   │   │   └── configmap.yaml
│   │   ├── frontend/
│   │   │   ├── deployment.yaml
│   │   │   └── service.yaml
│   │   ├── mongodb/
│   │   │   ├── statefulset.yaml
│   │   │   ├── service.yaml
│   │   │   └── persistentvolumeclaim.yaml
│   │   └── redis/
│   │       ├── deployment.yaml
│   │       └── service.yaml
│   ├── terraform/
│   │   ├── eks/
│   │   ├── vpc/
│   │   └── rds/
│   └── helm/
│       ├── product-service/
│       ├── ratings-service/
│       ├── worker-service/
│       └── frontend/
│
├── docker-compose.yml
├── .gitignore
├── README.md
└── requirements.md
```

---

## 🎯 Service Specifications

### 1. Product Service

**Technology:** Node.js with Express.js

**Responsibilities:**
- Manage product catalog (CRUD operations)
- Store product information in MongoDB
- Provide RESTful API endpoints
- Handle product search and filtering

**API Endpoints:**
```
GET    /api/products              - List all products
GET    /api/products/:id          - Get product by ID
POST   /api/products              - Create new product
PUT    /api/products/:id          - Update product
DELETE /api/products/:id          - Delete product
GET    /api/products/search?q=    - Search products
```

**Data Model:**
```javascript
{
  _id: ObjectId,
  name: String,
  description: String,
  price: Number,
  category: String,
  imageUrl: String,
  averageRating: Number,
  ratingsCount: Number,
  createdAt: Date,
  updatedAt: Date
}
```

**Environment Variables:**
- `PORT=5000`
- `MONGO_URI=mongodb://mongodb:27017/products` (uses `products` database)
- `NODE_ENV=production`
- `LOG_LEVEL=info`

**CI/CD Pipeline Requirements:**
- Separate GitHub Actions workflow
- Unit and integration tests
- Docker image build and push to container registry
- Security scanning (Trivy/Snyk)
- Deploy to Kubernetes on successful build

---

### 2. Ratings Service

**Technology:** Node.js with Express.js

**Responsibilities:**
- Accept user ratings via REST API
- Store ratings in MongoDB
- Publish rating events to Redis queue
- Validate rating data (1-5 stars)

**API Endpoints:**
```
POST   /api/ratings               - Submit a rating
GET    /api/ratings/product/:id   - Get ratings for a product
GET    /api/ratings/user/:id      - Get ratings by a user
DELETE /api/ratings/:id           - Delete a rating
```

**Data Model:**
```javascript
{
  _id: ObjectId,
  productId: String,
  userId: String,
  rating: Number, // 1-5
  comment: String (optional),
  createdAt: Date
}
```

**Event Publishing:**
- Publish to Redis channel: `ratings:new`
- Event format: `{ productId, userId, rating, timestamp }`

**Environment Variables:**
- `PORT=5001`
- `MONGO_URI=mongodb://mongodb:27017/ratings` (uses `ratings` database on same MongoDB instance)
- `REDIS_HOST=redis`
- `REDIS_PORT=6379`
- `NODE_ENV=production`

**CI/CD Pipeline Requirements:**
- Separate GitHub Actions workflow
- Unit and integration tests
- Docker image build and push
- Security scanning
- Deploy to Kubernetes independently

---

### 3. Worker Service

**Technology:** Node.js

**Responsibilities:**
- Subscribe to Redis rating events
- Calculate updated average ratings
- Update product service database
- Handle errors and retries
- Log processing metrics

**Processing Logic:**
1. Subscribe to `ratings:new` channel
2. Receive rating event
3. Fetch all ratings for the product
4. Calculate new average rating
5. Update product document in Product Service database
6. Log success/failure metrics

**Environment Variables:**
- `REDIS_HOST=redis`
- `REDIS_PORT=6379`
- `MONGO_URI=mongodb://mongodb:27017/products` (accesses products database to update ratings)
- `PRODUCT_SERVICE_URL=http://product-service:5000`
- `LOG_LEVEL=info`
- `WORKER_CONCURRENCY=5`

**CI/CD Pipeline Requirements:**
- Separate GitHub Actions workflow
- Unit tests for calculation logic
- Docker image build and push
- Deploy as Kubernetes Deployment with auto-scaling

---

### 4. Frontend Service

**Technology:** React.js or Next.js

**Responsibilities:**
- Display product catalog
- Show product details with ratings
- Allow users to submit ratings
- Real-time rating updates (WebSocket or polling)
- Responsive design

**Pages/Components:**
- Product Listing Page
- Product Details Page
- Rating Submission Form
- Rating Display Component
- Navigation Bar

**API Integration:**
- Product Service: `http://product-service:5000/api/products`
- Ratings Service: `http://ratings-service:5001/api/ratings`

**Environment Variables:**
- `REACT_APP_PRODUCT_SERVICE_URL`
- `REACT_APP_RATINGS_SERVICE_URL`
- `REACT_APP_WS_URL` (for WebSocket)

**CI/CD Pipeline Requirements:**
- Separate GitHub Actions workflow
- Unit tests (Jest/React Testing Library)
- E2E tests (Cypress/Playwright)
- Build static assets
- Docker image build and push
- Deploy to Kubernetes or CDN

---

## 🚀 DevOps Requirements

### CI/CD Pipeline Strategy

Each microservice MUST have its own independent CI/CD pipeline to demonstrate:
- **Independent deployments** - Deploy services separately
- **Service isolation** - Changes to one service don't affect others
- **Parallel builds** - Build all services simultaneously
- **Selective deployments** - Deploy only changed services

#### Pipeline Stages (per service):

1. **Source Control**
   - Git repository (GitHub/GitLab)
   - Branch protection rules
   - Pull request reviews

2. **Build Stage**
   - Install dependencies
   - Run linters (ESLint, Prettier)
   - Build application
   - Create Docker image
   - Tag with version/Git SHA

3. **Test Stage**
   - Unit tests
   - Integration tests
   - Code coverage reports
   - Test reports publishing

4. **Security Scanning**
   - Container image scanning (Trivy, Snyk)
   - Dependency vulnerability scanning
   - SAST (Static Application Security Testing)

5. **Push to Registry**
   - Push Docker image to container registry (Docker Hub, ECR, GCR)
   - Tag with: `latest`, `v1.0.0`, `sha-<commit-hash>`

6. **Deploy to Staging**
   - Deploy to Kubernetes staging namespace
   - Run smoke tests
   - Health checks

7. **Deploy to Production**
   - Manual approval gate
   - Blue-green or rolling deployment
   - Rollback capability

### Infrastructure as Code

**Terraform Modules:**
- EKS cluster setup
- VPC and networking
- MongoDB configuration (single instance or MongoDB Atlas)
- IAM roles and policies
- Security groups

**Kubernetes Manifests:**
- Deployments for each service
- Services (ClusterIP, LoadBalancer)
- ConfigMaps for configuration
- Secrets for sensitive data
- HorizontalPodAutoscaler for auto-scaling
- Ingress for external access

**Helm Charts:**
- Separate Helm chart for each service
- Values files for different environments
- Dependency management

### Containerization

**Docker Requirements:**
- Multi-stage builds for optimization
- Non-root user in containers
- Minimal base images (Alpine)
- Health checks in Dockerfiles
- .dockerignore files

**Container Registry:**
- Docker Hub or AWS ECR
- Image versioning strategy
- Image retention policies

### Orchestration

**Kubernetes Requirements:**
- Namespace per environment (dev, staging, prod)
- Resource limits and requests
- Liveness and readiness probes
- Service mesh (optional: Istio/Linkerd)
- Ingress controller (NGINX/Traefik)

### Monitoring & Observability

**Required Components:**
- **Logging:** Centralized logging (ELK, Loki, CloudWatch)
- **Metrics:** Prometheus + Grafana
- **Tracing:** Distributed tracing (Jaeger, Zipkin)
- **APM:** Application Performance Monitoring

**Metrics to Track:**
- Request rate per service
- Error rate per service
- Response time (p50, p95, p99)
- Container resource usage
- Queue depth (Redis)
- Database connection pool

**Alerts:**
- High error rate (> 5%)
- High latency (> 1s p95)
- Service down
- Resource exhaustion
- Queue backlog

### Security Requirements

- **Secrets Management:** Kubernetes Secrets or external secret manager (AWS Secrets Manager, HashiCorp Vault)
- **Network Policies:** Restrict inter-pod communication
- **RBAC:** Role-based access control in Kubernetes
- **TLS/SSL:** HTTPS for all external communication
- **Image Security:** Scan all container images
- **Dependency Scanning:** Regular dependency updates

---

## 🗄️ Database Requirements

### MongoDB (Single Instance)

**Architecture Decision:**
- Use a **single MongoDB instance** for simplicity while maintaining logical separation
- Each service uses a **different database** within the same MongoDB instance
- This simplifies infrastructure while still maintaining service boundaries

**Databases (within single MongoDB instance):**
- `products` - Product catalog data (used by Product Service)
- `ratings` - User ratings data (used by Ratings Service)

**Collections:**
- Products database: `products` collection
- Ratings database: `ratings` collection

**Connection Strings:**
- Product Service: `mongodb://mongodb:27017/products`
- Ratings Service: `mongodb://mongodb:27017/ratings`
- Worker Service: `mongodb://mongodb:27017/products` (to update product ratings)

**Indexes:**
- Products collection: `_id`, `name`, `category`
- Ratings collection: `productId`, `userId`, `createdAt`

**Benefits of Single MongoDB Instance:**
- Simplified infrastructure management
- Reduced resource requirements
- Easier backup and maintenance
- Lower operational complexity
- Still maintains logical separation between services

**Backup Strategy:**
- Daily automated backups of entire MongoDB instance
- Point-in-time recovery
- Backup retention: 30 days
- Can backup both databases together or separately

**Note:** In production, you could scale to separate MongoDB instances per service if needed, but for portfolio/demo purposes, a single instance with separate databases is sufficient and demonstrates the microservices pattern effectively.

---

## 📡 Message Queue Requirements

### Redis

**Channels:**
- `ratings:new` - New rating events
- `ratings:updated` - Rating update events

**Configuration:**
- Persistence enabled (AOF)
- Memory limit: 2GB
- Replication for high availability

---

## 🌐 Networking Requirements

### Service Communication

- **Internal:** Services communicate via Kubernetes service names
- **External:** Frontend exposed via Ingress/LoadBalancer
- **Service Discovery:** Kubernetes DNS
- **Load Balancing:** Kubernetes Service (round-robin)

### Ports

| Service | Internal Port | External Port |
|---------|--------------|---------------|
| Product Service | 5000 | N/A (internal) |
| Ratings Service | 5001 | N/A (internal) |
| Frontend | 3000 | 80/443 (via Ingress) |
| MongoDB | 27017 | N/A (internal) |
| Redis | 6379 | N/A (internal) |

---

## 🧪 Testing Requirements

### Unit Tests
- Minimum 80% code coverage
- Test all business logic
- Mock external dependencies

### Integration Tests
- Test API endpoints
- Test database operations
- Test message queue integration

### End-to-End Tests
- Test complete user workflows
- Test cross-service communication
- Test error scenarios

### Performance Tests
- Load testing (Apache Bench, k6)
- Stress testing
- Capacity planning

---

## 📊 Documentation Requirements

### Required Documentation

1. **README.md** - Project overview and quick start
2. **API Documentation** - OpenAPI/Swagger specs for each service
3. **Architecture Diagram** - System architecture visualization
4. **Deployment Guide** - Step-by-step deployment instructions
5. **Development Guide** - Local development setup
6. **CI/CD Documentation** - Pipeline configuration and usage
7. **Monitoring Guide** - How to monitor and troubleshoot

---

## 🎯 Success Criteria

### Functional Requirements
- ✅ Users can browse products
- ✅ Users can submit ratings (1-5 stars)
- ✅ Average ratings update in real-time
- ✅ All services are independently deployable
- ✅ Services handle errors gracefully

### Non-Functional Requirements
- ✅ Each service has separate CI/CD pipeline
- ✅ Services are containerized
- ✅ Services are deployed to Kubernetes
- ✅ Monitoring and logging are implemented
- ✅ Infrastructure is defined as code
- ✅ Security best practices are followed
- ✅ Documentation is complete

### DevOps Portfolio Showcase
- ✅ Demonstrates microservices architecture
- ✅ Shows CI/CD pipeline expertise
- ✅ Shows containerization skills
- ✅ Shows Kubernetes deployment skills
- ✅ Shows infrastructure automation
- ✅ Shows monitoring and observability

---

## 🚦 Implementation Phases

### Phase 1: Core Services (Week 1-2)
- [ ] Product Service implementation
- [ ] Ratings Service implementation
- [ ] Worker Service implementation
- [ ] Basic Frontend implementation
- [ ] Docker Compose setup for local development

### Phase 2: CI/CD Pipelines (Week 3)
- [ ] Product Service CI/CD pipeline
- [ ] Ratings Service CI/CD pipeline
- [ ] Worker Service CI/CD pipeline
- [ ] Frontend CI/CD pipeline
- [ ] Container registry setup

### Phase 3: Kubernetes Deployment (Week 4)
- [ ] Kubernetes manifests for all services
- [ ] Helm charts for each service
- [ ] Ingress configuration
- [ ] ConfigMaps and Secrets
- [ ] Health checks and probes

### Phase 4: Infrastructure (Week 5)
- [ ] Terraform for EKS cluster
- [ ] VPC and networking setup
- [ ] MongoDB setup (single instance with separate databases)
- [ ] Redis setup
- [ ] Security groups and IAM

### Phase 5: Monitoring & Observability (Week 6)
- [ ] Prometheus and Grafana setup
- [ ] Logging aggregation
- [ ] Distributed tracing
- [ ] Alerting rules
- [ ] Dashboard creation

### Phase 6: Documentation & Polish (Week 7)
- [ ] Complete all documentation
- [ ] Create architecture diagrams
- [ ] Write deployment guides
- [ ] Performance optimization
- [ ] Security audit

---

## 📝 Notes

- All services should follow RESTful API design principles
- Use semantic versioning for releases
- Implement proper error handling and logging
- Follow 12-factor app principles
- Use environment-specific configuration
- Implement graceful shutdown for all services
- Add retry logic for external service calls
- Implement circuit breakers for resilience

---

## 🔗 References

- [Microservices Patterns](https://microservices.io/patterns/)
- [Kubernetes Best Practices](https://kubernetes.io/docs/concepts/)
- [12-Factor App](https://12factor.net/)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [CI/CD Best Practices](https://www.redhat.com/en/topics/devops/what-is-ci-cd)

---

**Document Version:** 1.0  
**Last Updated:** 2024  
**Status:** Draft - Ready for Implementation
