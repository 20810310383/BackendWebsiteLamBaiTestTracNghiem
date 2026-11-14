// Keep HTTP and Socket.IO origins in sync. FRONTEND_ORIGINS accepts a
// comma-separated list for additional deployment domains.
const defaultOrigins = [
  'http://localhost:2004',
  'http://localhost:2003',
  'https://ktquizz.vercel.app',
  'https://vuaquiz.com',
  'https://hoangnghia.vercel.app',
  'chrome-extension://gimjcdniohfjmmbhhdbcogfkfkbogfmn',
];

function getAllowedOrigins() {
  const configured = (process.env.FRONTEND_ORIGINS || '')
    .split(',')
    .map(origin => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);
  return [...new Set([...defaultOrigins, ...configured])];
}

function allowOrigin(origin, callback) {
  if (!origin || getAllowedOrigins().includes(origin)) return callback(null, true);
  return callback(new Error('Not allowed by CORS'));
}

module.exports = { getAllowedOrigins, allowOrigin };
