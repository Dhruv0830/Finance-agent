import os
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError

# Get SUPABASE_JWT_SECRET from your Supabase Dashboard -> Project Settings -> API
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")
ALGORITHM = "HS256"

security = HTTPBearer()

async def get_current_user_id(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    """
    Extracts and verifies the Supabase JWT token from the Authorization header,
    returning the authenticated user's UUID (sub claim).
    """
    token = credentials.credentials
    try:
        # Decode and verify token signature using your Supabase JWT secret
        payload = jwt.decode(
            token, 
            SUPABASE_JWT_SECRET, 
            algorithms=[ALGORITHM], 
            audience="authenticated"
        )
        
        # 'sub' contains the user_id from auth.users.id
        user_id: str = payload.get("sub") 
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, 
                detail="Invalid token: user ID missing."
            )
        return user_id

    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Could not validate credentials / Invalid JWT token."
        )