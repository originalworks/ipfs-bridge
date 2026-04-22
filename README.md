# Ipfs bridge

## Setup
To install simply run `npm install`

## Test
To run tests you need to run `docker-compose -f docker/test-runner.yaml test-runner bash` and then `npm run test`. After you're done remember to shut down containers with `docker-compose -f docker/test-runner.yaml down --remove-orphans`