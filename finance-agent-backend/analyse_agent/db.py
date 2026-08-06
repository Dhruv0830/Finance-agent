import json
import os
import importlib
from typing import Dict, Any, Optional, Union
from contextlib import asynccontextmanager
from psycopg.rows import dict_row
from psycopg_pool import AsyncConnectionPool
from fastapi import FastAPI
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from pydantic import BaseModel
from langgraph.checkpoint.serde.jsonplus import JsonPlusSerializer


# Global singletons
pool: Optional[AsyncConnectionPool] = None
checkpointer: Optional[AsyncPostgresSaver] = None


class PydanticJsonPlusSerializer(JsonPlusSerializer):
    """
    Custom Serde for LangGraph that automatically serializes Pydantic objects
    for Postgres storage and hydrates them back into full Pydantic instances.
    """
    def _default(self, obj: Any) -> Any:
        if isinstance(obj, BaseModel):
            return {
                "__pydantic_type__": f"{obj.__class__.__module__}.{obj.__class__.__qualname__}",
                "data": obj.model_dump(mode="json")
            }
        return super()._default(obj)

    def _reviver(self, value: Any) -> Any:
        if isinstance(value, dict) and "__pydantic_type__" in value:
            try:
                module_name, class_name = value["__pydantic_type__"].rsplit(".", 1)
                module = importlib.import_module(module_name)
                cls = getattr(module, class_name)
                return cls(**value["data"])
            except Exception as e:
                print(f"Failed to revive Pydantic object {value.get('__pydantic_type__')}: {e}")
                return value["data"]
        return super()._reviver(value)

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
        min_size=1,
        max_size=8,
        max_idle=300,        # Close idle connections after 5 mins
        max_lifetime=1800,   # Refresh connections every 30 mins
        kwargs={
            "autocommit": True,
            "keepalives": 1,
            "keepalives_idle": 30,
            "keepalives_interval": 10,
            "keepalives_count": 5,
        },
        open=False
    )
    
    await pool.open()

    # 2. Initialize LangGraph checkpointer using the same pool
    checkpointer = AsyncPostgresSaver(pool, serde=PydanticJsonPlusSerializer())
    await checkpointer.setup()
    yield  # Application running

    # 3. Cleanup connection pool on application shutdown
    await pool.close()


def get_checkpointer() -> AsyncPostgresSaver:
    if checkpointer is None:
        raise RuntimeError("Checkpointer is not initialized. Ensure FastAPI lifespan has started.")
    return checkpointer


async def get_pool() -> AsyncConnectionPool:
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
) -> str:
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
            thread_id = str(row[0])

            # 2. Insert First User Message
            user_msg_content = {"type": "human", "text": prompt}
            await conn.execute(
                """
                INSERT INTO public.thread_messages (thread_id, role, node_name, content, created_at)
                VALUES (%s, 'user', 'user_input', %s::jsonb, NOW());
                """,
                (thread_id, json.dumps(user_msg_content,default=str))
            )
            
            return thread_id


# =====================================================================
# STEP 2: RESUME ANALYSIS (After HITL Node)
# =====================================================================
async def update_thread_and_log_resume_input(
    thread_id: str,
    user_id: str,
    resume_payload: Union[Dict[str, Any], Any],
    node_name: str = "hitl_node"
) -> bool:
    # Safely extract ticker and serialize content regardless of dict or Pydantic model
    if isinstance(resume_payload, dict):
        ticker = resume_payload.get("ticker", "PENDING")
        payload_json = json.dumps(resume_payload,default=str)
    else:
        ticker = getattr(resume_payload, "ticker", "PENDING")
        payload_json = resume_payload.model_dump_json() if hasattr(resume_payload, "model_dump_json") else json.dumps(resume_payload.__dict__,default=str)

    title = f"Analyse {ticker} stock" 
    
    p = await get_pool()
    async with p.connection() as conn:
        async with conn.transaction():
            # 1. Update Thread Ticker & Title
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
                return False  # Thread not found or unauthorized

            # 2. Log Human Feedback/Approval Message
            await conn.execute(
                """
                INSERT INTO public.thread_messages (thread_id, role, node_name, content, created_at)
                VALUES (%s, 'user', %s, %s::jsonb, NOW());
                """,
                (thread_id, node_name, payload_json)
            )
            return True

def dump_to_json(obj):
    # Convert Pydantic models (v2 / v1)
    if isinstance(obj, BaseModel):
        return obj.model_dump() if hasattr(obj, "model_dump") else obj.dict()
    # Convert custom dataclasses / objects with __dict__
    if hasattr(obj, "__dict__"):
        return obj.__dict__
    # Fallback to str for non-serializable types like datetime/UUID
    return str(obj)

# =====================================================================
# STEP 3: LOG AGENT OUTPUT / INTERMEDIATE STEPS
# =====================================================================
async def record_thread_message(
    thread_id: str,
    role: str,
    content: Dict[str, Any],
    node_name: Optional[str] = None
):
    p = await get_pool()
    async with p.connection() as conn:
        async with conn.transaction():
            await conn.execute(
                """
                INSERT INTO public.thread_messages (thread_id, role, node_name, content, created_at)
                VALUES (%s, %s, %s, %s::jsonb, NOW());
                """,
                (thread_id, role, node_name, json.dumps(content, default=dump_to_json))
            )
            await conn.execute(
                """
                UPDATE public.threads SET updated_at = NOW() WHERE id = %s;
                """,
                (thread_id,)
            )


# =====================================================================
# STEP 4: CHANGE THREAD MODE TO CHAT
# =====================================================================
async def complete_thread_analysis(thread_id: str, ticker: Optional[str] = None):
    p = await get_pool()
    async with p.connection() as conn:
        if ticker:
            await conn.execute(
                """
                UPDATE public.threads 
                SET mode = 'CHAT', ticker = %s, updated_at = NOW()
                WHERE id = %s;
                """,
                (ticker, thread_id)
            )
        else:
            await conn.execute(
                """
                UPDATE public.threads 
                SET mode = 'CHAT', updated_at = NOW()
                WHERE id = %s;
                """,
                (thread_id,)
            )


# =====================================================================
# FETCH USER THREADS
# =====================================================================
async def get_user_threads(user_id: str) -> list[dict]:
    p = await get_pool()
    async with p.connection() as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(
                """
                SELECT 
                    id AS thread_id,
                    ticker,
                    title,
                    mode,
                    created_at,
                    updated_at
                FROM public.threads
                WHERE user_id = %s
                ORDER BY updated_at DESC;
                """,
                (user_id,)
            )
            rows = await cur.fetchall()
            
            for row in rows:
                if row.get("created_at"):
                    row["created_at"] = row["created_at"].isoformat()
                if row.get("updated_at"):
                    row["updated_at"] = row["updated_at"].isoformat()
                    
            return rows
        
# =====================================================================
# FETCH USER CONVERSATION THREAD 
# =====================================================================

async def get_user_conversation(thread_id: str) -> list[dict]:
    p = await get_pool()
    async with p.connection() as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(
                """
                SELECT 
                    role, 
                    node_name, 
                    content
                FROM thread_messages
                WHERE thread_id = %s 
                AND role != 'user'
                AND (
                    role = 'chat_agent'
                    OR 
                    role = 'chat_user'
                    OR (
                        content->'state' IS NOT NULL 
                        AND content->'state' != '{}'::jsonb 
                        AND content->'state' != 'null'::jsonb
                    )
                )
                ORDER BY created_at ASC;
                """,
                (thread_id,)
            )
            rows = await cur.fetchall()      
            return rows
        