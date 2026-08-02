import os
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer()

SUPABASE_URL = os.getenv("SUPABASE_URL")
JWKS_URL = f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json"

# Initialize PyJWKClient (it fetches & caches public keys from Supabase)
jwks_client = jwt.PyJWKClient(JWKS_URL)

def get_current_user_id(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    token = credentials.credentials

    try:
        # 1. Dynamically retrieve the signing public key for this specific token
        signing_key = jwks_client.get_signing_key_from_jwt(token)

        # 2. Verify and decode using ES256 and the public key
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256"],
            audience="authenticated"  # Default Supabase audience for authenticated users
        )

        # 3. Extract the user's UUID
        user_id: str = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token payload is missing user ID (sub)."
            )

        return user_id

    except jwt.PyJWTError as e:
        # Catch signature mismatches, expired tokens, or invalid claims
        print(f"JWT Verification Failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Could not validate credentials: {str(e)}"
        )
    except Exception as e:
        print(f"Unexpected Auth Error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal authentication error."
        )