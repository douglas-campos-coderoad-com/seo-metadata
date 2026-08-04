from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
import json
import logging

logger = logging.getLogger(__name__)


class AppException(Exception):
    def __init__(self, status_code: int, detail: str, error_code: str = None):
        self.status_code = status_code
        self.detail = detail
        self.error_code = error_code or 'app_error'


async def app_exception_handler(request: Request, exc: AppException):
    logger.error(
        f'AppException: {exc.error_code}',
        extra={
            'status_code': exc.status_code,
            'detail': exc.detail,
            'path': request.url.path,
        }
    )
    return JSONResponse(
        status_code=exc.status_code,
        content={
            'error': exc.error_code,
            'detail': exc.detail,
        },
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.warning(
        'Validation error',
        extra={
            'path': request.url.path,
            'errors': exc.errors(),
        }
    )
    return JSONResponse(
        status_code=422,
        content={
            'error': 'validation_error',
            'detail': 'Invalid request',
            'errors': exc.errors(),
        },
    )


async def general_exception_handler(request: Request, exc: Exception):
    logger.exception(
        'Unhandled exception',
        extra={
            'path': request.url.path,
            'error': str(exc),
        }
    )
    return JSONResponse(
        status_code=500,
        content={
            'error': 'internal_server_error',
            'detail': 'An internal error occurred',
        },
    )


def register_exception_handlers(app: FastAPI):
    app.add_exception_handler(AppException, app_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(Exception, general_exception_handler)
