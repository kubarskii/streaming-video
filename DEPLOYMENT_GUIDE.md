# Deployment Guide - Quick Start for Different Platforms

Step-by-step deployment instructions for scaling your video platform.

---

## 🎯 Option 1: AWS ECS Fargate (Recommended for Medium-Large Scale)

### Prerequisites
```bash
# Install AWS CLI
npm install -g aws-cli

# Configure AWS credentials
aws configure

# Install ECS CLI
sudo curl -Lo /usr/local/bin/ecs-cli https://amazon-ecs-cli.s3.amazonaws.com/ecs-cli-linux-amd64-latest
sudo chmod +x /usr/local/bin/ecs-cli
```

### Step 1: Dockerize Your Application

Create `Dockerfile`:
```dockerfile
FROM node:20-alpine

# Install FFmpeg for video processing
RUN apk add --no-cache ffmpeg

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --production

# Copy application code
COPY . .

# Expose port
EXPOSE 3000

# Start application
CMD ["node", "server.js"]
```

Create `.dockerignore`:
```
node_modules
npm-debug.log
.env
.git
videos/temp
```

### Step 2: Build and Push Docker Image

```bash
# Build image
docker build -t video-platform:latest .

# Create ECR repository
aws ecr create-repository --repository-name video-platform

# Get login token
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com

# Tag image
docker tag video-platform:latest YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/video-platform:latest

# Push to ECR
docker push YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/video-platform:latest
```

### Step 3: Set Up Infrastructure

Create `ecs-params.yml`:
```yaml
version: 1
task_definition:
  task_execution_role: ecsTaskExecutionRole
  ecs_network_mode: awsvpc
  task_size:
    mem_limit: 2GB
    cpu_limit: 1024
run_params:
  network_configuration:
    awsvpc_configuration:
      subnets:
        - subnet-xxxxx
        - subnet-yyyyy
      security_groups:
        - sg-xxxxx
      assign_public_ip: ENABLED
```

Create `docker-compose.yml` for ECS:
```yaml
version: '3'
services:
  api:
    image: YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/video-platform:latest
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - B2_KEY_ID=${B2_KEY_ID}
      - B2_APPLICATION_KEY=${B2_APPLICATION_KEY}
    logging:
      driver: awslogs
      options:
        awslogs-group: /ecs/video-platform
        awslogs-region: us-east-1
        awslogs-stream-prefix: api
```

### Step 4: Deploy to ECS

```bash
# Create cluster
aws ecs create-cluster --cluster-name video-platform-cluster

# Create log group
aws logs create-log-group --log-group-name /ecs/video-platform

# Deploy service
ecs-cli compose --project-name video-platform service up \
  --cluster video-platform-cluster \
  --launch-type FARGATE

# Check status
ecs-cli compose --project-name video-platform service ps \
  --cluster video-platform-cluster
```

### Step 5: Set Up Load Balancer

```bash
# Create load balancer
aws elbv2 create-load-balancer \
  --name video-platform-alb \
  --subnets subnet-xxxxx subnet-yyyyy \
  --security-groups sg-xxxxx

# Create target group
aws elbv2 create-target-group \
  --name video-platform-tg \
  --protocol HTTP \
  --port 3000 \
  --vpc-id vpc-xxxxx \
  --health-check-path /health

# Update ECS service to use ALB
aws ecs update-service \
  --cluster video-platform-cluster \
  --service video-platform \
  --load-balancers targetGroupArn=arn:aws:elasticloadbalancing:...,containerName=api,containerPort=3000
```

### Step 6: Configure Auto-Scaling

```bash
# Register scalable target
aws application-autoscaling register-scalable-target \
  --service-namespace ecs \
  --resource-id service/video-platform-cluster/video-platform \
  --scalable-dimension ecs:service:DesiredCount \
  --min-capacity 2 \
  --max-capacity 10

# Create scaling policy
aws application-autoscaling put-scaling-policy \
  --service-namespace ecs \
  --scalable-dimension ecs:service:DesiredCount \
  --resource-id service/video-platform-cluster/video-platform \
  --policy-name cpu-scaling-policy \
  --policy-type TargetTrackingScaling \
  --target-tracking-scaling-policy-configuration file://scaling-policy.json
```

Create `scaling-policy.json`:
```json
{
  "TargetValue": 70.0,
  "PredefinedMetricSpecification": {
    "PredefinedMetricType": "ECSServiceAverageCPUUtilization"
  },
  "ScaleInCooldown": 300,
  "ScaleOutCooldown": 60
}
```

**Estimated Cost**: $200-2,000/month depending on scale

---

## 🎯 Option 2: AWS EKS (Kubernetes) - For Maximum Control

### Step 1: Install Tools

```bash
# Install kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl

# Install eksctl
curl --silent --location "https://github.com/weaveworks/eksctl/releases/latest/download/eksctl_$(uname -s)_amd64.tar.gz" | tar xz -C /tmp
sudo mv /tmp/eksctl /usr/local/bin

# Install Helm
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
```

### Step 2: Create EKS Cluster

Create `cluster.yaml`:
```yaml
apiVersion: eksctl.io/v1alpha5
kind: ClusterConfig

metadata:
  name: video-platform
  region: us-east-1
  version: "1.28"

managedNodeGroups:
  - name: general
    instanceType: t3.large
    desiredCapacity: 3
    minSize: 2
    maxSize: 10
    volumeSize: 100
    ssh:
      allow: true
    labels:
      role: general
    tags:
      nodegroup-role: general

  - name: compute-intensive
    instanceType: c5.2xlarge
    desiredCapacity: 2
    minSize: 1
    maxSize: 20
    volumeSize: 200
    labels:
      role: transcode
    taints:
      - key: workload
        value: transcode
        effect: NoSchedule
```

```bash
# Create cluster
eksctl create cluster -f cluster.yaml

# Verify
kubectl get nodes
```

### Step 3: Deploy Application

Create `k8s/deployment.yaml`:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: video-api
  namespace: production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: video-api
  template:
    metadata:
      labels:
        app: video-api
    spec:
      containers:
      - name: api
        image: YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/video-platform:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: video-secrets
              key: database-url
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: video-api-service
  namespace: production
spec:
  type: LoadBalancer
  ports:
  - port: 80
    targetPort: 3000
  selector:
    app: video-api
```

Create `k8s/hpa.yaml` (Horizontal Pod Autoscaler):
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: video-api-hpa
  namespace: production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: video-api
  minReplicas: 3
  maxReplicas: 50
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

Create secrets:
```bash
# Create namespace
kubectl create namespace production

# Create secrets
kubectl create secret generic video-secrets \
  --from-literal=database-url="postgresql://..." \
  --from-literal=redis-url="redis://..." \
  --from-literal=b2-key-id="..." \
  --from-literal=b2-app-key="..." \
  --namespace production
```

Deploy:
```bash
# Apply configurations
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/hpa.yaml

# Check status
kubectl get pods -n production
kubectl get svc -n production
kubectl get hpa -n production
```

### Step 4: Install NGINX Ingress Controller

```bash
# Add NGINX Helm repo
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update

# Install NGINX Ingress
helm install nginx-ingress ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace \
  --set controller.service.type=LoadBalancer
```

Create `k8s/ingress.yaml`:
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: video-platform-ingress
  namespace: production
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
    nginx.ingress.kubernetes.io/rate-limit: "100"
spec:
  ingressClassName: nginx
  rules:
  - host: api.yourplatform.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: video-api-service
            port:
              number: 80
  tls:
  - hosts:
    - api.yourplatform.com
    secretName: tls-secret
```

**Estimated Cost**: $500-5,000/month depending on scale

---

## 🎯 Option 3: Railway (Simplest - Good for Starting)

### Step 1: Install Railway CLI

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login
```

### Step 2: Initialize Project

```bash
# Initialize Railway project
railway init

# Link to existing project (if you have one)
railway link
```

### Step 3: Configure Services

Create `railway.toml`:
```toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "Dockerfile"

[deploy]
startCommand = "node server.js"
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10

[[services]]
name = "api"
[services.env]
NODE_ENV = "production"
PORT = "3000"

[[services]]
name = "postgres"
[services.database]
type = "postgresql"

[[services]]
name = "redis"
[services.database]
type = "redis"

[[services]]
name = "mongodb"
[services.database]
type = "mongodb"
```

### Step 4: Add Environment Variables

```bash
# Set environment variables
railway variables set DATABASE_URL="${{Postgres.DATABASE_URL}}"
railway variables set REDIS_URL="${{Redis.REDIS_URL}}"
railway variables set MONGODB_URL="${{MongoDB.MONGO_URL}}"
railway variables set B2_KEY_ID="your-b2-key"
railway variables set B2_APPLICATION_KEY="your-b2-app-key"
railway variables set JWT_SECRET="your-jwt-secret"
```

### Step 5: Deploy

```bash
# Deploy to Railway
railway up

# Watch logs
railway logs

# Get deployment URL
railway domain
```

### Step 6: Scale (Railway Pro)

```bash
# Scale replicas (requires Pro plan)
railway scale --replicas 3

# Upgrade instance size
railway scale --size STANDARD_LARGE
```

**Railway Pricing**:
- Hobby: $5/month (1 project)
- Pro: $20/month + usage ($0.000231/GB-hour RAM, $0.000463/vCPU-hour)
- Estimated: $100-1,000/month

---

## 🎯 Option 4: Google Cloud Run (Serverless)

### Step 1: Install gcloud CLI

```bash
# Install gcloud CLI
curl https://sdk.cloud.google.com | bash
exec -l $SHELL

# Initialize
gcloud init

# Set project
gcloud config set project YOUR_PROJECT_ID
```

### Step 2: Build and Deploy

```bash
# Enable required APIs
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com

# Build with Cloud Build
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/video-platform

# Deploy to Cloud Run
gcloud run deploy video-platform \
  --image gcr.io/YOUR_PROJECT_ID/video-platform \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --min-instances 1 \
  --max-instances 100 \
  --set-env-vars "NODE_ENV=production,DATABASE_URL=..." \
  --port 3000
```

### Step 3: Set Up Auto-Scaling

```bash
# Configure auto-scaling
gcloud run services update video-platform \
  --region us-central1 \
  --min-instances 2 \
  --max-instances 100 \
  --concurrency 80 \
  --cpu-throttling \
  --timeout 300
```

**Cloud Run Pricing**:
- First 2 million requests/month free
- $0.00002400 per request after
- $0.00001200 per vCPU-second
- $0.00000150 per GiB-second
- Estimated: $100-2,000/month

---

## 🗄️ Database Setup

### PostgreSQL on AWS RDS

```bash
# Create RDS instance
aws rds create-db-instance \
  --db-instance-identifier video-platform-db \
  --db-instance-class db.m5.2xlarge \
  --engine postgres \
  --engine-version 15.4 \
  --master-username admin \
  --master-user-password YourSecurePassword \
  --allocated-storage 100 \
  --storage-type gp3 \
  --vpc-security-group-ids sg-xxxxx \
  --db-subnet-group-name default \
  --backup-retention-period 7 \
  --preferred-backup-window "03:00-04:00" \
  --preferred-maintenance-window "mon:04:00-mon:05:00" \
  --enable-cloudwatch-logs-exports '["postgresql"]' \
  --storage-encrypted \
  --multi-az

# Create read replica
aws rds create-db-instance-read-replica \
  --db-instance-identifier video-platform-db-replica-1 \
  --source-db-instance-identifier video-platform-db \
  --db-instance-class db.m5.large
```

### MongoDB Atlas

```bash
# Install Atlas CLI
brew install mongodb-atlas-cli

# Login
atlas auth login

# Create cluster
atlas clusters create video-platform-cluster \
  --provider AWS \
  --region US_EAST_1 \
  --tier M30 \
  --mdbVersion 7.0 \
  --diskSizeGB 100

# Create database user
atlas dbusers create admin \
  --password YourSecurePassword \
  --role readWriteAnyDatabase

# Get connection string
atlas clusters connectionStrings describe video-platform-cluster
```

### Redis on AWS ElastiCache

```bash
# Create Redis cluster
aws elasticache create-cache-cluster \
  --cache-cluster-id video-platform-redis \
  --cache-node-type cache.r6g.large \
  --engine redis \
  --engine-version 7.0 \
  --num-cache-nodes 1 \
  --cache-subnet-group-name default \
  --security-group-ids sg-xxxxx

# Enable auto-failover (optional)
aws elasticache create-replication-group \
  --replication-group-id video-platform-redis-rg \
  --replication-group-description "Video platform Redis" \
  --cache-node-type cache.r6g.large \
  --engine redis \
  --num-cache-clusters 3 \
  --automatic-failover-enabled
```

---

## 📦 Storage & CDN Setup

### Backblaze B2 Configuration

```bash
# Install B2 CLI
pip install b2

# Authorize
b2 authorize-account YOUR_KEY_ID YOUR_APPLICATION_KEY

# Create buckets
b2 create-bucket video-platform-hot allPrivate
b2 create-bucket video-platform-warm allPrivate
b2 create-bucket video-platform-cold allPrivate

# Set lifecycle rules
b2 update-bucket video-platform-hot \
  --lifecycleRule '{"daysFromUploadingToHiding": null, "daysFromHidingToDeleting": 30, "fileNamePrefix": ""}'
```

### CloudFlare CDN Setup

1. Sign up at cloudflare.com
2. Add your domain
3. Update nameservers
4. Create cache rules:

```javascript
// CloudFlare Page Rule for videos
/*videos/*
- Cache Level: Cache Everything
- Edge Cache TTL: 1 month
- Browser Cache TTL: 1 week

/*thumbnails/*
- Cache Level: Cache Everything
- Edge Cache TTL: 1 week
- Browser Cache TTL: 1 day

/api/*
- Cache Level: Bypass
```

5. Enable R2 (CloudFlare's S3 alternative):
```bash
# Install wrangler
npm install -g wrangler

# Login
wrangler login

# Create R2 bucket
wrangler r2 bucket create video-platform

# Generate access keys
wrangler r2 access-key create video-platform-key
```

---

## 🔍 Monitoring Setup

### Prometheus + Grafana on Kubernetes

```bash
# Add Prometheus Helm repo
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# Install Prometheus
helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace \
  --set prometheus.prometheusSpec.retention=15d \
  --set prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.resources.requests.storage=100Gi

# Access Grafana
kubectl port-forward -n monitoring svc/prometheus-grafana 3000:80

# Default credentials: admin / prom-operator
```

### Datadog (Managed Solution)

```bash
# Install Datadog agent on Kubernetes
helm repo add datadog https://helm.datadoghq.com
helm repo update

# Create values.yaml
cat <<EOF > datadog-values.yaml
datadog:
  apiKey: YOUR_API_KEY
  appKey: YOUR_APP_KEY
  logs:
    enabled: true
    containerCollectAll: true
  apm:
    enabled: true
  processAgent:
    enabled: true
clusterAgent:
  enabled: true
EOF

# Install
helm install datadog -f datadog-values.yaml datadog/datadog
```

---

## 🚀 CI/CD Pipeline

### GitHub Actions

Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v2
      with:
        aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        aws-region: us-east-1
    
    - name: Login to Amazon ECR
      id: login-ecr
      uses: aws-actions/amazon-ecr-login@v1
    
    - name: Build, tag, and push image to Amazon ECR
      env:
        ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
        ECR_REPOSITORY: video-platform
        IMAGE_TAG: ${{ github.sha }}
      run: |
        docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .
        docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
        docker tag $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG $ECR_REGISTRY/$ECR_REPOSITORY:latest
        docker push $ECR_REGISTRY/$ECR_REPOSITORY:latest
    
    - name: Deploy to ECS
      run: |
        aws ecs update-service \
          --cluster video-platform-cluster \
          --service video-platform \
          --force-new-deployment
    
    - name: Notify deployment
      uses: 8398a7/action-slack@v3
      with:
        status: ${{ job.status }}
        text: 'Deployment to production completed'
        webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

---

## 📋 Post-Deployment Checklist

- [ ] Verify all services are running
- [ ] Test video upload
- [ ] Test video playback
- [ ] Check database connections
- [ ] Verify cache is working
- [ ] Test authentication
- [ ] Check monitoring dashboards
- [ ] Set up alerts
- [ ] Configure backups
- [ ] Test auto-scaling
- [ ] Load test the system
- [ ] Document deployment process

---

## 🎯 Quick Commands Reference

```bash
# AWS ECS
ecs-cli compose service ps
ecs-cli logs --follow

# Kubernetes
kubectl get pods
kubectl logs -f pod-name
kubectl describe pod pod-name
kubectl exec -it pod-name -- /bin/sh

# Railway
railway logs
railway status
railway scale

# Docker
docker ps
docker logs container-id
docker exec -it container-id sh

# Database
psql $DATABASE_URL
mongo $MONGODB_URL
redis-cli -u $REDIS_URL
```

---

Choose the deployment option that fits your scale and budget:
- **Railway**: Quick start, < 100K users
- **AWS ECS**: Medium scale, 100K-1M users
- **AWS EKS**: Large scale, 1M+ users
- **Google Cloud Run**: Serverless, variable traffic

Good luck with your deployment! 🚀

