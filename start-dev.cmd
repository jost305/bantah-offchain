@echo off
set NODE_ENV=development
npx tsx server/index.ts > dev-server.out.log 2> dev-server.err.log