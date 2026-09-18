     ^
    at emitErrorNT (node:net:1977:8)
Error: listen EADDRINUSE: address already in use :::8080
    at process.processTicksAndRejections (node:internal/process/task_queues:89:21) {
    at Server.setupListenHandle [as _listen2] (node:net:1941:16)
  code: 'EADDRINUSE',
    at listenInCluster (node:net:1998:12)
    at Server.listen (node:net:2103:7)
  errno: -98,
    at Function.listen (/app/node_modules/express/lib/application.js:635:24)
    at Object.<anonymous> (/app/index.js:2080:5)
  syscall: 'listen',
    at Module._compile (node:internal/modules/cjs/loader:1781:14)
    at Object..js (node:internal/modules/cjs/loader:1913:10)
Node.js v22.23.2
