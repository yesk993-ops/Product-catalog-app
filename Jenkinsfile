pipeline {

    agent any

    environment {
        IMAGE_TAG = "${BUILD_NUMBER}"
        SONARQUBE = "SonarQubeServer"
    }

    stages {

        stage('Checkout') {
            steps {
                git 'https://github.com/yesk993-ops/Product-catalog-app.git'
            }
        }

        stage('SonarQube Scan') {
            steps {
                withSonarQubeEnv("${SONARQUBE}") {
                    sh '''
                    sonar-scanner \
                    -Dsonar.projectKey=product-catalog \
                    -Dsonar.sources=.
                    '''
                }
            }
        }

        stage('Parallel Build + Trivy Scan') {
            parallel {

                stage('Product Service') {
                    steps {
                        sh '''
                        docker build -t product-service:${IMAGE_TAG} product-service/

                        trivy image --severity HIGH,CRITICAL --exit-code 1 \
                        product-service:${IMAGE_TAG}
                        '''
                    }
                }

                stage('Ratings Service') {
                    steps {
                        sh '''
                        docker build -t ratings-service:${IMAGE_TAG} ratings-service/

                        trivy image --severity HIGH,CRITICAL --exit-code 1 \
                        ratings-service:${IMAGE_TAG}
                        '''
                    }
                }

                stage('Worker Service') {
                    steps {
                        sh '''
                        docker build -t worker-service:${IMAGE_TAG} worker-service/

                        trivy image --severity HIGH,CRITICAL --exit-code 1 \
                        worker-service:${IMAGE_TAG}
                        '''
                    }
                }

                stage('Frontend Service') {
                    steps {
                        sh '''
                        docker build -t product-catalog-frontend:${IMAGE_TAG} frontend/

                        trivy image --severity HIGH,CRITICAL --exit-code 1 \
                        product-catalog-frontend:${IMAGE_TAG}
                        '''
                    }
                }
            }
        }

        stage('Deploy Infra') {
            steps {
                sh '''
                kubectl apply -f infrastructure/kubernetes/mongodb/
                kubectl apply -f infrastructure/kubernetes/redis/
                '''
            }
        }

        stage('Deploy Applications') {
            steps {
                sh '''
                kubectl set image deployment/product-service \
                    product-service=product-service:${IMAGE_TAG}

                kubectl set image deployment/ratings-service \
                    ratings-service=ratings-service:${IMAGE_TAG}

                kubectl set image deployment/worker-service \
                    worker-service=worker-service:${IMAGE_TAG}

                kubectl set image deployment/frontend \
                    frontend=product-catalog-frontend:${IMAGE_TAG}
                '''
            }
        }

        stage('Verify Deployment') {
            steps {
                sh 'kubectl get pods'
            }
        }
    }

    post {
        success {
            echo "🔥 Parallel DevSecOps pipeline completed successfully"
        }
        failure {
            echo "❌ Pipeline failed due to build or security issues"
        }
    }
}
