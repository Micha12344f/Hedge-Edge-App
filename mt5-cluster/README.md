# MT5 Multi-User Cluster

A scalable Docker-based architecture for running multiple MetaTrader 5 connections simultaneously.

## Architecture

```
                    ┌─────────────────────────────────┐
                    │         Your Web App            │
                    │       (Hedge-Edge Front)        │
                    └────────────┬────────────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────────────┐
                    │      Orchestrator API           │
                    │        (Port 5000)              │
                    │  - Session management           │
                    │  - Load balancing               │
                    │  - Request routing              │
                    └────────────┬────────────────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              │                  │                  │
              ▼                  ▼                  ▼
        ┌──────────┐       ┌──────────┐       ┌──────────┐
        │ Worker 1 │       │ Worker 2 │       │ Worker N │
        │ Port 5001│       │ Port 5002│       │ Port 500N│
        │ Wine+MT5 │       │ Wine+MT5 │       │ Wine+MT5 │
        └──────────┘       └──────────┘       └──────────┘
```

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Linux VPS with 2GB+ RAM per worker

### Deploy

```bash
# Deploy with 5 workers (default)
./deploy.sh

# Deploy with custom worker count
./deploy.sh 10
```

Or on Windows:
```powershell
.\deploy.ps1 -Workers 5
```

## API Reference

### Orchestrator Endpoints

#### Health Check
```bash
GET /health
```

Response:
```json
{
  "status": "healthy",
  "service": "mt5-orchestrator",
  "workers": {
    "worker-1": true,
    "worker-2": true
  },
  "active_sessions": 3
}
```

#### List Workers
```bash
GET /api/workers
```

Response:
```json
{
  "success": true,
  "workers": [
    {
      "id": "worker-1",
      "port": 5001,
      "healthy": true,
      "in_use": true,
      "user_id": "user-uuid-1",
      "mt5_login": 12345678
    }
  ]
}
```

#### Allocate Session
```bash
POST /api/session/allocate
Content-Type: application/json

{
  "user_id": "your-unique-user-id",
  "mt5_login": 12345678,
  "mt5_server": "MetaQuotes-Demo"
}
```

Response:
```json
{
  "success": true,
  "worker_id": "worker-1",
  "worker_url": "http://mt5-worker-1:5000",
  "external_port": 5001,
  "message": "Worker allocated"
}
```

#### Release Session
```bash
POST /api/session/release
Content-Type: application/json

{
  "user_id": "your-unique-user-id"
}
```

#### Session Status
```bash
GET /api/session/status?user_id=your-unique-user-id
```

### Trading Endpoints (via Orchestrator)

All trading endpoints require `user_id` parameter.

#### Connect to MT5
```bash
POST /api/connect
Content-Type: application/json

{
  "user_id": "your-unique-user-id",
  "login": 12345678,
  "password": "your-password",
  "server": "MetaQuotes-Demo"
}
```

#### Get Account Info
```bash
GET /api/account/info?user_id=your-unique-user-id
```

#### Get Positions
```bash
GET /api/positions?user_id=your-unique-user-id
```

#### Get Orders
```bash
GET /api/orders?user_id=your-unique-user-id
```

#### Open Trade
```bash
POST /api/trade/open
Content-Type: application/json

{
  "user_id": "your-unique-user-id",
  "symbol": "EURUSD",
  "type": "buy",
  "volume": 0.01,
  "sl": 1.0500,
  "tp": 1.0700
}
```

#### Close Trade
```bash
POST /api/trade/close
Content-Type: application/json

{
  "user_id": "your-unique-user-id",
  "ticket": 123456789
}
```

#### Get Tick
```bash
GET /api/tick?user_id=your-unique-user-id&symbol=EURUSD
```

#### Get Symbols
```bash
GET /api/symbols?user_id=your-unique-user-id
```

#### Disconnect
```bash
POST /api/disconnect
Content-Type: application/json

{
  "user_id": "your-unique-user-id"
}
```

## Frontend Integration

### TypeScript Client Example

```typescript
class MT5ClusterClient {
  private baseUrl: string;
  private userId: string;

  constructor(baseUrl: string, userId: string) {
    this.baseUrl = baseUrl;
    this.userId = userId;
  }

  async connect(login: number, password: string, server: string) {
    const response = await fetch(`${this.baseUrl}/api/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: this.userId,
        login,
        password,
        server
      })
    });
    return response.json();
  }

  async getAccountInfo() {
    const response = await fetch(
      `${this.baseUrl}/api/account/info?user_id=${this.userId}`
    );
    return response.json();
  }

  async getPositions() {
    const response = await fetch(
      `${this.baseUrl}/api/positions?user_id=${this.userId}`
    );
    return response.json();
  }

  async openTrade(symbol: string, type: 'buy' | 'sell', volume: number) {
    const response = await fetch(`${this.baseUrl}/api/trade/open`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: this.userId,
        symbol,
        type,
        volume
      })
    });
    return response.json();
  }

  async closeTrade(ticket: number) {
    const response = await fetch(`${this.baseUrl}/api/trade/close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: this.userId,
        ticket
      })
    });
    return response.json();
  }

  async disconnect() {
    const response = await fetch(`${this.baseUrl}/api/disconnect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: this.userId })
    });
    return response.json();
  }
}

// Usage
const client = new MT5ClusterClient(
  'http://your-vps-ip:5000',
  'user-uuid-from-auth'
);

await client.connect(12345678, 'password', 'MetaQuotes-Demo');
const account = await client.getAccountInfo();
console.log(account);
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_URL` | `redis://redis:6379` | Redis connection URL |
| `MAX_CONTAINERS` | `5` | Maximum number of workers |
| `IDLE_TIMEOUT_MINUTES` | `30` | Disconnect idle sessions after N minutes |

### Scaling

To add more workers:

1. Edit the worker count in deploy script
2. Run `./deploy.sh <new-count>`

Resource requirements per worker:
- ~500MB RAM
- ~1 CPU core (shared)

## Monitoring

### Check cluster health
```bash
curl http://localhost:5000/health
```

### View logs
```bash
docker compose -f docker-compose.generated.yml logs -f
```

### View specific worker logs
```bash
docker logs -f mt5-worker-1
```

## Troubleshooting

### Workers showing as unhealthy
1. Check if Xvfb is running: `docker exec mt5-worker-1 ps aux | grep Xvfb`
2. Check Wine Python: `docker exec mt5-worker-1 wine python --version`
3. View worker logs: `docker logs mt5-worker-1`

### Connection timeouts
- Increase `start_period` in healthcheck
- Ensure VPS has sufficient RAM

### No available workers
- Scale up workers: `./deploy.sh 10`
- Reduce `IDLE_TIMEOUT_MINUTES` to free slots faster

## License

MIT
