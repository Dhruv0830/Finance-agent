# db.py
import json
import os
from typing import Dict, Any, Optional
from contextlib import asynccontextmanager
from psycopg_pool import AsyncConnectionPool
from fastapi import FastAPI
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

# Global singletons
pool: Optional[AsyncConnectionPool] = None
checkpointer: Optional[AsyncPostgresSaver] = None


def get_db_uri() -> str:
    uri = os.getenv("DATABASE_URL")
    if not uri:
        raise RuntimeError("DATABASE_URL environment variable is not set.")
    return uri


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    FastAPI lifespan context manager.
    Opens the connection pool and sets up the LangGraph checkpointer table DDL on startup.
    Closes the connection pool gracefully on shutdown.
    """
    global pool, checkpointer
    
    # 1. Initialize shared connection pool
    pool = AsyncConnectionPool(
        conninfo=get_db_uri(),
        max_size=20,
        kwargs={"autocommit": True}
    )
    await pool.open()

    # 2. Initialize LangGraph checkpointer using the same pool
    checkpointer = AsyncPostgresSaver(pool)
    await checkpointer.setup()  # Runs setup DDL queries once to ensure tables exist

    yield  # FastAPI runs here

    # 3. Cleanup connection pool on application shutdown
    await pool.close()


def get_checkpointer() -> AsyncPostgresSaver:
    """
    Returns the initialized LangGraph AsyncPostgresSaver instance.
    Use this when compiling your LangGraph workflow: graph.compile(checkpointer=get_checkpointer())
    """
    if checkpointer is None:
        raise RuntimeError("Checkpointer is not initialized. Ensure FastAPI lifespan has started.")
    return checkpointer


async def get_pool() -> AsyncConnectionPool:
    """Returns the shared connection pool for raw application queries."""
    if pool is None:
        raise RuntimeError("Database connection pool is not initialized. Ensure FastAPI lifespan has started.")
    return pool


# =====================================================================
# STEP 1: START ANALYSIS (Initial Prompt Transaction)
# =====================================================================
async def create_thread_and_initial_message(
    user_id: str,
    prompt: str,
    mode: str = "ANALYSE"
):
    """
    Atomically creates the thread record (ticker='PENDING') and stores 
    the first human prompt before starting LangGraph execution.
    Returns the auto-generated thread_id.
    """
    p = await get_pool()
    async with p.connection() as conn:
        async with conn.transaction():
            # 1. Insert Thread Record
            result = await conn.execute(
                """
                INSERT INTO public.threads (user_id, ticker, title, mode, created_at, updated_at)
                VALUES (%s, 'PENDING', 'Pending Analysis', %s, NOW(), NOW())
                RETURNING id;
                """,
                (user_id, mode)
            )
            
            row = await result.fetchone()
            thread_id = str(row[0])  # Convert UUID object or string to str

            # 2. Insert First User Message
            user_msg_content = {"type": "human", "text": prompt}
            await conn.execute(
                """
                INSERT INTO public.thread_messages (thread_id, role, node_name, content, created_at)
                VALUES (%s, 'user', 'user_input', %s::jsonb, NOW());
                """,
                (thread_id, json.dumps(user_msg_content))
            )
            
            return thread_id


# =====================================================================
# STEP 2: RESUME ANALYSIS (After HITL Node)
# =====================================================================
async def update_thread_and_log_resume_input(
    thread_id: str,
    user_id: str,
    resume_payload: Dict[str, Any],
    node_name: str = "hitl_node"
) -> bool:
    """
    Atomically validates thread ownership, updates ticker and title,
    and logs the user's resume response (e.g., approval/modifications).
    """
    ticker = resume_payload.ticker
    title = f"Analyse {ticker} stock" 
    
    p = await get_pool()
    async with p.connection() as conn:
        async with conn.transaction():
            # 1. Update Thread Ticker & Title (Enforce user_id ownership)
            result = await conn.execute(
                """
                UPDATE public.threads 
                SET ticker = %s, title = %s, updated_at = NOW()
                WHERE id = %s AND user_id = %s
                RETURNING id;
                """,
                (ticker, title, thread_id, user_id)
            )
            row = await result.fetchone()
            if not row:
                return False  # Thread does not exist or user is unauthorized

            # 2. Log Human Feedback/Approval Message
            await conn.execute(
                """
                INSERT INTO public.thread_messages (thread_id, role, node_name, content, created_at)
                VALUES (%s, 'user', %s, %s::jsonb, NOW());
                """,
                (thread_id, node_name, json.dumps(resume_payload))
            )
            return True


# =====================================================================
# STEP 3: LOG AGENT OUTPUT / INTERMEDIATE STEPS
# =====================================================================
async def record_thread_message(
    thread_id: str,
    role: str,
    content: Dict[str, Any],
    node_name: Optional[str] = None
):
    """
    Atomically writes node execution outputs, final investment report, 
    or error logs into thread_messages, updating parent thread timestamp.
    """
    p = await get_pool()
    async with p.connection() as conn:
        async with conn.transaction():
            await conn.execute(
                """
                INSERT INTO public.thread_messages (thread_id, role, node_name, content, created_at)
                VALUES (%s, %s, %s, %s::jsonb, NOW());
                """,
                (thread_id, role, node_name, json.dumps(content))
            )
            await conn.execute(
                """
                UPDATE public.threads SET updated_at = NOW() WHERE id = %s;
                """,
                (thread_id,)
            )