const { HttpStatus, validErrorStatuses } = require('../http/http-errors');

function isConstraintError(error) {
  return error?.code?.startsWith('SQLITE_CONSTRAINT')
    || (error?.code === 'ERR_SQLITE_ERROR' && [1555, 2067].includes(error?.errcode));
}

function errorHandler(error, _req, res, _next) {
  const status = isConstraintError(error)
    ? HttpStatus.CONFLICT
    : validErrorStatuses.has(Number(error.status))
      ? Number(error.status)
      : error.type === 'entity.too.large'
        ? HttpStatus.PAYLOAD_TOO_LARGE
        : error instanceof SyntaxError && error.status === HttpStatus.BAD_REQUEST
          ? HttpStatus.BAD_REQUEST
          : HttpStatus.INTERNAL_SERVER_ERROR;
  if (status >= 500) console.error(error);
  const message = status === 409 && isConstraintError(error)
    ? 'L’operazione crea un duplicato già presente.'
    : status === HttpStatus.PAYLOAD_TOO_LARGE
      ? 'La richiesta è troppo grande.'
      : status >= 500
        ? 'Errore interno del server.'
        : error.message;
  res.status(status).json({ status, error: message });
}

function notFoundHandler(_req, res) {
  res.status(HttpStatus.NOT_FOUND).json({
    status: HttpStatus.NOT_FOUND,
    error: 'Risorsa non trovata.',
  });
}

module.exports = { errorHandler, notFoundHandler };
