const demoRuntimeEnvironments = ['development', 'test'];

function assertDemoSeedAllowed(runtimeEnvironment) {
  if (runtimeEnvironment === 'production' && process.env.HACKHUB_SEED_DEMO === 'true') {
    throw new Error('HACKHUB_SEED_DEMO non può essere abilitato in produzione.');
  }
  if (process.env.HACKHUB_SEED_DEMO === 'true' && !demoRuntimeEnvironments.includes(runtimeEnvironment)) {
    throw new Error('Il seed demo richiede NODE_ENV=development o NODE_ENV=test.');
  }
}

function isDemoSeedEnabled(runtimeEnvironment) {
  return demoRuntimeEnvironments.includes(runtimeEnvironment) && process.env.HACKHUB_SEED_DEMO !== 'false';
}

module.exports = { assertDemoSeedAllowed, isDemoSeedEnabled };
