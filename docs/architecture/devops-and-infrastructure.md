<div align="center">
  
  # DevOps & Cloud Infrastructure
  **The architectural blueprints for deploying Reshma-Core as a highly available, horizontally scalable distributed system.**

  [![AWS ECS](https://img.shields.io/badge/AWS-Elastic_Container_Service-FF9900?style=flat&logo=amazonaws&logoColor=white)](#)
  [![Kubernetes](https://img.shields.io/badge/Kubernetes-Zero_Downtime-326CE5?style=flat&logo=kubernetes&logoColor=white)](#)
  [![Redis](https://img.shields.io/badge/Redis-Distributed_State-DC382D?style=flat&logo=redis&logoColor=white)](#)
</div>

---

## 1. Cluster Readiness (Horizontal Scalability)
Reshma-Core is designed to be horizontally scaled. This means you can run 10, 50, or 100 identical instances of the Node.js application behind a Load Balancer. 

To achieve this, the application is strictly **Stateless**.
* **Sessions:** Stored in cryptographically signed JWTs, never in server RAM.
* **Background Jobs:** Offloaded to a central Redis/BullMQ queue. No instance "owns" a task.
* **Rate Limits:** Centralized in Redis, ensuring all instances share the same security strike-counter.

## 2. Deep Liveness & Readiness Probes (`/api/v1/health`)
Standard web applications return a simple `200 OK` on their health route. In a cloud environment, this is dangerous because the Express server might be running while the MongoDB connection has fatally crashed, causing the Load Balancer to route users to a broken server.

Reshma-Core implements **Deep Probing**:
* When the AWS/K8s Load Balancer pings `/health`, the controller actively executes `ping()` commands against **MongoDB**, **Redis**, and **Typesense**.
* It calculates the exact latency of each microservice.
* If *any* database drops offline, the route intentionally returns a `503 Service Unavailable`.
* **The Result:** The Load Balancer instantly recognizes the failure and severs traffic to that specific EC2/Container instance, ensuring customers experience **Zero Downtime**.

## 3. Distributed Rate Limiting
To defend against DDoS and financial card-testing bots, the platform utilizes `rate-limit-redis`.
* **The Server-Hopping Exploit:** If a bot needs 100 requests to guess a password, and the platform has 5 servers with RAM-based limits, the bot could hit Server A 100 times, Server B 100 times, etc.
* **The Distributed Defense:** By centralizing the strike-counter in Redis, the millisecond the bot hits the limit on Server A, Servers B, C, D, and E synchronize and block the IP simultaneously.

## 4. The Graceful Shutdown Protocol (SIGTERM)
When deploying a new version of the code, AWS or Docker sends a `SIGTERM` signal to the server to shut it down. If the Node process terminates instantly, active customer checkouts (ACID transactions) will be corrupted.

**The Reshma-Core Shutdown Sequence:**
1. Intercepts `SIGTERM` / `SIGINT`.
2. Commands the Express Server to stop accepting *new* HTTP requests.
3. Keeps the event loop alive to finish processing active user requests.
4. Safely drains and disconnects the Mongoose and Redis connection pools.
5. Exits cleanly with code `0`.