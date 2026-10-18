import admin from 'firebase-admin';
import { serviceAccount } from './serviceAccount';

if (serviceAccount) {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
    });
  }
}

export default admin;
