import { bootstrap } from '../../src/lib/server/bootstrap';
bootstrap().catch(()=>{console.error('Initialization failed. Check ADMIN_EMAIL, ADMIN_PASSWORD, MAIL_ADDRESS and DATA_DIR; existing data was preserved.');process.exitCode=1;});
