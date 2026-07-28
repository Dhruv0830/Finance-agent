# agents/checkpointer.py
import os
from psycopg_pool import AsyncConnectionPool
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

DB_URI = os.getenv("DATABASE_URL")

# Global instances (Connection pool & Checkpointer singleton)
_pool = None
_checkpointer = None


async def init_checkpointer():
    """Call this ONCE on application startup (e.g., FastAPI lifespan)."""
    global _pool, _checkpointer
    if _pool is None:
        _pool = AsyncConnectionPool(conninfo=DB_URI, max_size=20, open=False)
        await _pool.open()
        
        _checkpointer = AsyncPostgresSaver(_pool)
        # Runs setup DDL queries ONCE to ensure LangGraph tables exist
        await _checkpointer.setup()


async def get_postgres_checkpointer() -> AsyncPostgresSaver:
    """Returns the initialized AsyncPostgresSaver instance instantly without running setup()."""
    global _checkpointer
    if _checkpointer is None:
        await init_checkpointer()
    return _checkpointer