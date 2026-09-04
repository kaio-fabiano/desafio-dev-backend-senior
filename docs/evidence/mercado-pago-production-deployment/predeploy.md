# Sandbox predeploy approval

- Stage: `sandbox`
- AWS account: `945323157760`
- Region: `us-east-1`
- Approval: explicitly granted by the owner before provisioning
- Secrets: synchronized through the SST secret store without recording values
- Public ingress: one managed HTTPS API Gateway with private VPC integrations
- Cost surface reviewed: seven ECS services, four managed databases, VPC/NAT networking, API Gateway, Cloud Map, and CloudWatch logs
- Provider mode: Mercado Pago test credentials only

The reviewed changes contained no literal secret values. Deployment evidence is recorded separately after readiness and provider verification.
