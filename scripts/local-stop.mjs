#!/usr/bin/env node
// Placeholder stop hook. This project connects to a PostgreSQL server the
// developer manages themselves (not one this repo starts), so there is
// nothing for this backend to stop. Kept as a script so the documented
// `npm run local:stop` command always exists and never errors.
console.log('Nothing to stop: this project uses your own local PostgreSQL server.');
