class FakePaymentAdapter {
  pay(teamId, amount) {
    return Number.isInteger(Number(teamId)) && Number(amount) >= 0;
  }
}

module.exports = { FakePaymentAdapter };
