from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
import os
import random
import string
from motor.motor_asyncio import AsyncIOMotorDatabase

SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class OTPStore:
    """Simple in-memory OTP storage (use Redis in production)"""
    def __init__(self):
        self.store = {}  # {email: {otp: str, expires: datetime}}
    
    def generate_otp(self, email: str) -> str:
        otp = ''.join(random.choices(string.digits, k=6))
        self.store[email] = {
            "otp": otp,
            "expires": datetime.utcnow() + timedelta(minutes=5)
        }
        return otp
    
    def verify_otp(self, email: str, otp: str) -> bool:
        if email not in self.store:
            return False
        
        stored = self.store[email]
        if datetime.utcnow() > stored["expires"]:
            del self.store[email]
            return False
        
        if stored["otp"] == otp:
            del self.store[email]
            return True
        
        return False

otp_store = OTPStore()

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None

async def get_current_user(db: AsyncIOMotorDatabase, token: str):
    payload = verify_token(token)
    if not payload:
        return None
    
    user_id = payload.get("sub")
    if not user_id:
        return None
    
    user = await db.users.find_one({"_id": user_id})
    return user
