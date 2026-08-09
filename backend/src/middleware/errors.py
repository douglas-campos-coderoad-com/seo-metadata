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


def _sanitize_errors(errors: list) -> list:
    """Sanitize validation errors to be JSON serializable."""
    sanitized = []
    for error in errors:
        item = dict(error)
        # Replace non-serializable ctx values (e.g. ValueError objects)
        if 'ctx' in item and item['ctx']:
            ctx = {}
            for key, value in item['ctx'].items():
                if isinstance(value, Exception):
                    ctx[key] = str(value)
                else:
                    ctx[key] = value
            item['ctx'] = ctx
        sanitized.append(item)
    return sanitized


async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = _sanitize_errors(exc.errors())
    logger.warning(
        'Validation error',
        extra={
            'path': request.url.path,
            'errors': errors,
        }
    )
    return JSONResponse(
        status_code=422,
        content={
            'error': 'validation_error',
            'detail': 'Invalid request',
            'errors': errors,
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
