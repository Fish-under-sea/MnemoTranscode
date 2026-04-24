"""MTC 领域异常定义。"""

from __future__ import annotations


class MTCDomainError(Exception):
    """MTC 领域异常统一基类。"""

    http_status: int = 500

    def __init__(
        self,
        error_code: str,
        message: str,
        fields: list[str] | None = None,
    ) -> None:
        self.error_code = error_code
        self.message = message
        self.fields = fields
        super().__init__(message)


class DomainInputError(MTCDomainError):
    http_status = 422


class FieldValidationError(DomainInputError):
    """单字段验证错误。"""


class FieldConflictError(DomainInputError):
    """跨字段冲突错误。"""


class DomainAuthError(MTCDomainError):
    http_status = 401


class DomainResourceError(MTCDomainError):
    http_status = 404


class DomainMediaError(MTCDomainError):
    http_status = 422


class DomainInternalError(MTCDomainError):
    http_status = 500

