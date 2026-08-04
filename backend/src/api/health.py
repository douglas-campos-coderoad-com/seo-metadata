from fastapi import APIRouter, status
from pydantic import BaseModel
from datetime import datetime

router = APIRouter(prefix='/api/v1', tags=['health'])


class HealthResponse(BaseModel):
    status: str
    timestamp: datetime
    version: str


@router.get('/health', response_model=HealthResponse, status_code=status.HTTP_200_OK)
async def health_check():
    """Health check endpoint."""
    return {
        'status': 'healthy',
        'timestamp': datetime.utcnow(),
        'version': '0.1.0',
    }
