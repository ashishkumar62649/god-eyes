import { ErrorCodes } from '@god-eyes/contracts';

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export function makeErrorResponse(
  code: string,
  message: string,
  details: Record<string, unknown> = {}
): ErrorResponse {
  return {
    error: {
      code,
      message,
      details,
    },
  };
}

export function invalidQueryError(message: string, details: Record<string, unknown> = {}): ErrorResponse {
  return makeErrorResponse(ErrorCodes.INVALID_QUERY, message, details);
}

export function invalidBBoxError(message: string, details: Record<string, unknown> = {}): ErrorResponse {
  return makeErrorResponse(ErrorCodes.INVALID_BBOX, message, details);
}

export function invalidCategoryError(message: string, details: Record<string, unknown> = {}): ErrorResponse {
  return makeErrorResponse(ErrorCodes.INVALID_CATEGORY, message, details);
}

export function invalidModeError(message: string, details: Record<string, unknown> = {}): ErrorResponse {
  return makeErrorResponse(ErrorCodes.INVALID_MODE, message, details);
}

export function invalidLimitError(message: string, details: Record<string, unknown> = {}): ErrorResponse {
  return makeErrorResponse(ErrorCodes.INVALID_LIMIT, message, details);
}

export function missingBBoxError(details: Record<string, unknown> = {}): ErrorResponse {
  return makeErrorResponse(ErrorCodes.MISSING_BBOX, 'bbox is required when mode=clusters', details);
}

export function invalidLayerError(layerId: string): ErrorResponse {
  return makeErrorResponse(ErrorCodes.INVALID_LAYER, `Layer ${layerId} is not supported.`);
}

export function databaseOfflineError(): ErrorResponse {
  return makeErrorResponse(ErrorCodes.DATABASE_OFFLINE, 'Database is not available.');
}

export function tablesUnavailableError(): ErrorResponse {
  return makeErrorResponse(ErrorCodes.DATABASE_OFFLINE, 'Aviation tables not available.');
}

export function objectNotFoundError(objectId: string): ErrorResponse {
  return makeErrorResponse(ErrorCodes.OBJECT_NOT_FOUND, `Airport not found: ${objectId}`);
}

export function invalidFieldsError(message: string, details: Record<string, unknown> = {}): ErrorResponse {
  return makeErrorResponse(ErrorCodes.INVALID_FIELDS, message, details);
}

export function invalidCoordinatesError(message: string, details: Record<string, unknown> = {}): ErrorResponse {
  return makeErrorResponse(ErrorCodes.INVALID_COORDINATES, message, details);
}