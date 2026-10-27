import { randomUUID } from 'node:crypto';
import { createReservation } from '../../src/lib/booking/engine';
import { bookingSchema } from '../../src/lib/booking/validation';
import { database } from '../../src/lib/booking/db';
async function main() {
try {
 await createReservation(bookingSchema.parse({date:process.argv[2],time:'12:00',guests:2,name:'SQLite concurrency test',phone:'01012345678',consent:true,adult:true,privacyVersion:'1',idempotencyKey:randomUUID()}));
 console.log('COMMITTED');
} catch(error) {
 if((error as Error).message!=='SLOT_UNAVAILABLE') throw error;
 console.log('FULL');
} finally { await database().end(); }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
