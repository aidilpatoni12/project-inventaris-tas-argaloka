import { hashPassword } from '../server/password.ts';

const pw = process.argv[2];
if (!pw) {
  console.error('Pemakaian: npm run hash -- "kata-sandi-baru"');
  process.exit(1);
}

console.log(hashPassword(pw));
