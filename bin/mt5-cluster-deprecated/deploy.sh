#!/bin/bash
# MT5 Cluster Deployment Script
# Usage: ./deploy.sh [workers]
# Example: ./deploy.sh 5

set -e

WORKERS=${1:-5}
echo "======================================"
echo "MT5 Cluster Deployment"
echo "Workers: $WORKERS"
echo "======================================"

# Generate docker-compose with dynamic workers
generate_compose() {
    cat > docker-compose.generated.yml << 'HEADER'
version: '3.8'

services:
  orchestrator:
    build:
      context: ./orchestrator
      dockerfile: Dockerfile
    container_name: mt5-orchestrator
    ports:
      - "5000:5000"
    environment:
      - REDIS_URL=redis://redis:6379
      - MAX_CONTAINERS=${MAX_WORKERS}
      - IDLE_TIMEOUT_MINUTES=30
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    depends_on:
      - redis
    networks:
      - mt5-network
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    container_name: mt5-redis
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    networks:
      - mt5-network
    restart: unless-stopped

HEADER

    for i in $(seq 1 $WORKERS); do
        cat >> docker-compose.generated.yml << WORKER
  mt5-worker-$i:
    build:
      context: ./mt5-worker
      dockerfile: Dockerfile
    container_name: mt5-worker-$i
    environment:
      - WORKER_ID=$i
      - WORKER_PORT=$((5000 + i))
    ports:
      - "$((5000 + i)):5000"
    volumes:
      - mt5-data-$i:/root/.wine
    networks:
      - mt5-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 90s

WORKER
    done

    echo "networks:" >> docker-compose.generated.yml
    echo "  mt5-network:" >> docker-compose.generated.yml
    echo "    driver: bridge" >> docker-compose.generated.yml
    echo "" >> docker-compose.generated.yml
    echo "volumes:" >> docker-compose.generated.yml
    echo "  redis-data:" >> docker-compose.generated.yml
    for i in $(seq 1 $WORKERS); do
        echo "  mt5-data-$i:" >> docker-compose.generated.yml
    done
}

echo "Generating docker-compose.yml for $WORKERS workers..."
MAX_WORKERS=$WORKERS generate_compose

echo "Building containers..."
docker compose -f docker-compose.generated.yml build

echo "Starting cluster..."
docker compose -f docker-compose.generated.yml up -d

echo ""
echo "======================================"
echo "MT5 Cluster Started!"
echo "======================================"
echo ""
echo "Orchestrator API: http://localhost:5000"
echo "Health Check:     http://localhost:5000/health"
echo "Worker Status:    http://localhost:5000/api/workers"
echo ""
echo "Individual Workers:"
for i in $(seq 1 $WORKERS); do
    echo "  Worker $i: http://localhost:$((5000 + i))/health"
done
echo ""
echo "To view logs: docker compose -f docker-compose.generated.yml logs -f"
echo "To stop:      docker compose -f docker-compose.generated.yml down"
