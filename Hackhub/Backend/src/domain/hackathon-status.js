const HackathonStatus = Object.freeze({
  OPEN_REGISTRATIONS: 'ISCRIZIONI_APERTE',
  REGISTRATION_CLOSED: 'ISCRIZIONI_CHIUSE',
  IN_PROGRESS: 'IN_CORSO',
  EVALUATION: 'VALUTAZIONE',
  CLOSED: 'CONCLUSO',
});

function getHackathonStatus(hackathon, now = Date.now()) {
  if (hackathon.status_override) return hackathon.status_override;
  if (hackathon.winner_team_id) return HackathonStatus.CLOSED;
  const deadline = Date.parse(hackathon.registration_deadline);
  const start = Date.parse(hackathon.start_date);
  const end = Date.parse(hackathon.end_date);
  if (now < deadline && now < start) return HackathonStatus.OPEN_REGISTRATIONS;
  if (now < end) return HackathonStatus.IN_PROGRESS;
  return HackathonStatus.EVALUATION;
}

module.exports = { HackathonStatus, getHackathonStatus };
