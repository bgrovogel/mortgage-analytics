/**
 * Where the end-to-end tests find the app: the API serving the production build, as the container does. Its own
 * port, so it never collides with the development API on 5080. Override with APP_URL to test another setup.
 */
export const APP_URL = process.env['APP_URL'] ?? 'http://localhost:5090';
