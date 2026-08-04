import logging
import logging.config
import os
from pythonjsonlogger import jsonlogger
from fastapi import Request
from fastapi.middleware.base import BaseHTTPMiddleware
import uuid
import time


def setup_logging():
    log_format = os.getenv('LOG_FORMAT', 'json')
    log_level = os.getenv('LOG_LEVEL', 'INFO')

    if log_format == 'json':
        handler = logging.StreamHandler()
        formatter = jsonlogger.JsonFormatter(
            '%(timestamp)s %(level)s %(name)s %(message)s'
        )
        handler.setFormatter(formatter)

        logging.basicConfig(
            level=getattr(logging, log_level),
            handlers=[handler],
        )
    else:
        logging.basicConfig(
            level=getattr(logging, log_level),
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        )

    logger = logging.getLogger(__name__)
    return logger


class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id

        start_time = time.time()
        response = await call_next(request)
        process_time = time.time() - start_time

        response.headers['X-Request-ID'] = request_id
        response.headers['X-Process-Time'] = str(process_time)

        logger = logging.getLogger(__name__)
        logger.info(
            f'{request.method} {request.url.path}',
            extra={
                'request_id': request_id,
                'method': request.method,
                'path': request.url.path,
                'status_code': response.status_code,
                'process_time': process_time,
            }
        )

        return response
