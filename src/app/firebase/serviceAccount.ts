import config from '../../config';

if (!config.firebase.projectId || !config.firebase.privateKey) {
  console.warn('Firebase service account not fully configured. Firebase auth will be unavailable.');
}

export const serviceAccount = config.firebase.projectId
  ? {
      type: 'service_account',
      project_id: config.firebase.projectId,
      private_key_id: config.firebase.privateKeyId || '',
      private_key: config.firebase.privateKey?.replace(/\\n/g, '\n') || '',
      client_email: config.firebase.clientEmail || '',
      client_id: config.firebase.clientId || '',
      auth_uri: 'https://accounts.google.com/o/oauth2/auth',
      token_uri: 'https://oauth2.googleapis.com/token',
      auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
      client_x509_cert_url: config.firebase.clientCertUrl || '',
      universe_domain: 'googleapis.com',
    }
  : undefined;
