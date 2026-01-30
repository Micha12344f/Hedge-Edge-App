"""
Session Manager - Redis-backed session tracking for MT5 workers
"""
import json
import time
import redis
from typing import Optional, Dict, List


class SessionManager:
    def __init__(self, redis_url: str, idle_timeout: int = 1800):
        """
        Initialize session manager.
        
        Args:
            redis_url: Redis connection URL
            idle_timeout: Seconds before a session is considered idle (default 30 min)
        """
        self.redis = redis.from_url(redis_url, decode_responses=True)
        self.idle_timeout = idle_timeout
        
        # Key prefixes
        self.USER_SESSION_KEY = "mt5:session:user:"      # user_id -> session data
        self.WORKER_SESSION_KEY = "mt5:session:worker:"  # worker_id -> user_id
        self.QUEUE_KEY = "mt5:queue"                     # waiting queue
    
    def create_session(self, user_id: str, worker_id: str, 
                       mt5_login: Optional[int] = None,
                       mt5_server: Optional[str] = None) -> Dict:
        """
        Create a new session for a user.
        
        Args:
            user_id: Unique user identifier
            worker_id: Assigned worker ID
            mt5_login: MT5 account login (optional)
            mt5_server: MT5 broker server (optional)
        
        Returns:
            Session data dict
        """
        now = time.time()
        session = {
            "user_id": user_id,
            "worker_id": worker_id,
            "mt5_login": mt5_login,
            "mt5_server": mt5_server,
            "created_at": now,
            "last_activity": now
        }
        
        # Store user -> session mapping
        self.redis.set(
            f"{self.USER_SESSION_KEY}{user_id}",
            json.dumps(session),
            ex=86400  # 24 hour max TTL
        )
        
        # Store worker -> user mapping
        self.redis.set(
            f"{self.WORKER_SESSION_KEY}{worker_id}",
            user_id,
            ex=86400
        )
        
        return session
    
    def get_user_session(self, user_id: str) -> Optional[Dict]:
        """Get session data for a user"""
        data = self.redis.get(f"{self.USER_SESSION_KEY}{user_id}")
        if data:
            return json.loads(data)
        return None
    
    def get_worker_session(self, worker_id: str) -> Optional[Dict]:
        """Get session data for a worker"""
        user_id = self.redis.get(f"{self.WORKER_SESSION_KEY}{worker_id}")
        if user_id:
            return self.get_user_session(user_id)
        return None
    
    def is_worker_in_use(self, worker_id: str) -> bool:
        """Check if a worker is currently assigned"""
        return self.redis.exists(f"{self.WORKER_SESSION_KEY}{worker_id}") > 0
    
    def update_activity(self, user_id: str) -> bool:
        """Update the last activity timestamp for a session"""
        session = self.get_user_session(user_id)
        if session:
            session['last_activity'] = time.time()
            self.redis.set(
                f"{self.USER_SESSION_KEY}{user_id}",
                json.dumps(session),
                ex=86400
            )
            return True
        return False
    
    def release_session(self, user_id: str) -> bool:
        """Release a user's session"""
        session = self.get_user_session(user_id)
        if session:
            worker_id = session.get('worker_id')
            
            # Remove user session
            self.redis.delete(f"{self.USER_SESSION_KEY}{user_id}")
            
            # Remove worker mapping
            if worker_id:
                self.redis.delete(f"{self.WORKER_SESSION_KEY}{worker_id}")
            
            return True
        return False
    
    def get_idle_sessions(self) -> List[Dict]:
        """Get all sessions that have been idle longer than the timeout"""
        idle_sessions = []
        now = time.time()
        
        # Scan for all user sessions
        cursor = 0
        while True:
            cursor, keys = self.redis.scan(cursor, match=f"{self.USER_SESSION_KEY}*", count=100)
            
            for key in keys:
                data = self.redis.get(key)
                if data:
                    session = json.loads(data)
                    if now - session.get('last_activity', 0) > self.idle_timeout:
                        idle_sessions.append(session)
            
            if cursor == 0:
                break
        
        return idle_sessions
    
    def get_active_session_count(self) -> int:
        """Get count of active sessions"""
        cursor = 0
        count = 0
        
        while True:
            cursor, keys = self.redis.scan(cursor, match=f"{self.USER_SESSION_KEY}*", count=100)
            count += len(keys)
            if cursor == 0:
                break
        
        return count
    
    def add_to_queue(self, user_id: str) -> int:
        """Add user to waiting queue, return position"""
        # Add to sorted set with timestamp as score
        self.redis.zadd(self.QUEUE_KEY, {user_id: time.time()})
        return self.get_queue_position(user_id)
    
    def get_queue_position(self, user_id: str) -> int:
        """Get user's position in queue (0 if not in queue)"""
        rank = self.redis.zrank(self.QUEUE_KEY, user_id)
        return (rank + 1) if rank is not None else 0
    
    def pop_from_queue(self) -> Optional[str]:
        """Get and remove the first user from queue"""
        result = self.redis.zpopmin(self.QUEUE_KEY, 1)
        if result:
            return result[0][0]
        return None
    
    def remove_from_queue(self, user_id: str) -> bool:
        """Remove user from queue"""
        return self.redis.zrem(self.QUEUE_KEY, user_id) > 0
    
    def get_all_sessions(self) -> List[Dict]:
        """Get all active sessions (for admin/debugging)"""
        sessions = []
        cursor = 0
        
        while True:
            cursor, keys = self.redis.scan(cursor, match=f"{self.USER_SESSION_KEY}*", count=100)
            
            for key in keys:
                data = self.redis.get(key)
                if data:
                    sessions.append(json.loads(data))
            
            if cursor == 0:
                break
        
        return sessions
