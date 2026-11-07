// Unit/regression runs never spend provider credits. Live acceptance is opt-in
// and must report the provider's actual outcome separately.
process.env.AI_PROVIDER = 'mock';
process.env.NODE_ENV = 'test';

// Some legacy lifecycle tests read a local project. Never let their decision
// submission write to that database; acceptance writes belong to isolated DBs.
const prisma = require('../../src/config/prisma');
for (const key of Object.keys(prisma)) {
  const delegate = prisma[key];
  if (!delegate || typeof delegate.findMany !== 'function') continue;
  for (const mutation of ['create', 'createMany', 'update', 'updateMany', 'upsert', 'delete', 'deleteMany']) {
    if (typeof delegate[mutation] === 'function') delegate[mutation] = async () => { throw new Error('UNIT_TEST_DATABASE_WRITE_BLOCKED'); };
  }
}
prisma.$transaction = async callback => {
  if (typeof callback !== 'function') throw new Error('UNIT_TEST_DATABASE_WRITE_BLOCKED');
  return callback(prisma);
};
