import { spawn } from 'node:child_process';
const child = spawn(process.execPath, ['--import','tsx','--test','tests/booking.integration.test.ts','tests/sqlite.test.ts'], {
 stdio:'inherit', windowsHide:true,
 env:{...process.env, NODE_ENV:'test', TEST_SQLITE:'true'},
});
child.on('error',error=>{ console.error(error); process.exitCode=1; });
child.on('exit',code=>{ process.exitCode=code ?? 1; });
