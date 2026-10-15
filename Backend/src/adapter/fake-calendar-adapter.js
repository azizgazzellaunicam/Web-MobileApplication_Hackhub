class FakeCalendarAdapter {
  schedule(requestId, mentorId, scheduledAt) {
    const value = `${requestId}:${mentorId}:${scheduledAt}`;
    return `https://calendar.hackhub.local/call/${Buffer.from(value).toString('base64url')}`;
  }
}

module.exports = { FakeCalendarAdapter };
