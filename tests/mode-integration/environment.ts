import type { EnvironmentConfig } from '../../config/environments.js';
export const targetEnvironment: EnvironmentConfig = {
  name: 'local-demo',
  frontendBaseURL: 'http://127.0.0.1:4187',
  apiBaseURL: 'http://127.0.0.1:4187',
  allowedHosts: ['127.0.0.1:4187'],
};
