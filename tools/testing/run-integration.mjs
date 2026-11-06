import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createMockApi } from '../mock-api/server.mjs';

// 独占临时端口与数据，不依赖或修改开发中的 8080 服务。
const server = createMockApi();
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const apiUrl = `http://127.0.0.1:${server.address().port}/api/v1`;
let child;
try {
  child = spawn(
    process.execPath,
    [
      'node_modules/@angular/cli/bin/ng.js',
      'test',
      '--watch=false',
      '--include=**/*.integration.ts',
      '--ts-config=tsconfig.integration.json',
    ],
    {
      stdio: 'inherit',
      env: { ...process.env, MOCK_API_URL: apiUrl },
    },
  );
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => child.kill(signal));
  }
  const [code] = await once(child, 'exit');
  process.exitCode = code ?? 1;
} finally {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
