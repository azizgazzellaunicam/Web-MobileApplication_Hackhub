const { HttpStatus, httpError } = require('../http/http-errors');

function selectHighestScoreWinner(entries) {
  if (!entries.length) {
    throw httpError(HttpStatus.CONFLICT, 'Classifica vuota.');
  }
  return [...entries].sort((left, right) => right.averageScore - left.averageScore)[0];
}

module.exports = { selectHighestScoreWinner };
