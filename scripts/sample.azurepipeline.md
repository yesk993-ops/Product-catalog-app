# Docker
# Build and push an image to Azure Container Registry
# https://docs.microsoft.com/azure/devops/pipelines/languages/docker

trigger:
 paths:
   include:
     - product-service/*

resources:
- repo: self

variables:
  # Container registry service connection established during pipeline creation
  dockerRegistryServiceConnection: '6d98ab55-5471-477e-b47c-a3c92999a578'
  imageRepository: 'votingapp'
  containerRegistry: 'bilarnacr.azurecr.io'
  dockerfilePath: '$(Build.SourcesDirectory)/result/Dockerfile'
  tag: '$(Build.BuildId)'

pool:
 name: 'azureagent'


stages:
- stage: Build
  displayName: Build 
  jobs:
  - job: Build
    displayName: Build
    steps:
    - task: Docker@2
      displayName: Build an image
      inputs:
        containerRegistry: '$(dockerRegistryServiceConnection)'
        repository: '$(imageRepository)'
        command: 'build'
        Dockerfile: 'product-service/Dockerfile'
        tags: '$(tag)'
- stage: Push
  displayName: Push 
  jobs:
  - job: Push
    displayName: Push
    steps:
    - task: Docker@2
      displayName: Build an image
      inputs:
        containerRegistry: '$(dockerRegistryServiceConnection)'
        repository: '$(imageRepository)'
        command: 'push'
        tags: '$(tag)'
- stage: Update Manifest
  displayName: Update k8s Manifests
  jobs:
  - job: Update Manifest
    displayName: Update
    steps:
    - task: ShellScript@2
      inputs:
        scriptPath: 'scripts/k8smanifestupdater.sh'
        args: 'product-service $(imageRepository) $(tag)'