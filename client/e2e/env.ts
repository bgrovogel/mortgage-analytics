/** Where the end-to-end tests find the app and the API. Override with environment variables in other setups. */
export const APP_URL = process.env['APP_URL'] ?? 'http://localhost:4200';
export const API_URL = process.env['API_URL'] ?? 'http://localhost:5080';
