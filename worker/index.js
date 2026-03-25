/**
 * worker/index.js — Cloudflare Worker entry point
 * CORS is handled at the Worker level (industry standard approach)
 */

import { getRequestListener } from '@hono/node-server';

const ALLOWED_ORIGINS = [
  'https://saas-learnify.pages.dev',
];

function getCorsHeaders(origin) {
  if (!ALLOWED_ORIGINS.includes(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control, X-Tenant',
  };
}

function injectEnv(env) {
  const KEYS = [
    'MONGODB_URI',
    'JWT_SECRET', 'JWT_REFRESH_SECRET', 'JWT_EXPIRE', 'JWT_REFRESH_EXPIRE', 'JWT_COOKIE_EXPIRE',
    'COOKIE_DOMAIN', 'ALLOWED_ORIGINS', 'FRONTEND_URL',
    'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET',
    'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET',
    'STRIPE_STARTER_MONTHLY_PRICE_ID', 'STRIPE_PROFESSIONAL_MONTHLY_PRICE_ID', 'STRIPE_ENTERPRISE_MONTHLY_PRICE_ID',
    'STRIPE_STARTER_YEARLY_PRICE_ID', 'STRIPE_PROFESSIONAL_YEARLY_PRICE_ID', 'STRIPE_ENTERPRISE_YEARLY_PRICE_ID',
    'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'FROM_EMAIL',
    'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET',
    'SUPER_ADMIN_EMAIL', 'SUPER_ADMIN_PASSWORD',
    'BCRYPT_ROUNDS', 'CRON_SECRET', 'WORKER_SELF_URL',
  ];
  for (const key of KEYS) {
    if (env[key] !== undefined) process.env[key] = env[key];
  }
}

let requestListener = null;

async function getListener() {
  if (!requestListener) {
    const app = (await import('../app-worker.js')).default;
    requestListener = getRequestListener(app);
  }
  return requestListener;
}

export default {
  async fetch(request, env, ctx) {
    injectEnv(env);

    const origin = request.headers.get('Origin') || '';
    const corsHeaders = getCorsHeaders(origin);

    // Handle preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Pass to Express
    const listener = await getListener();
    const response = await listener(request, env, ctx);

    // Attach CORS headers to every response
    const newHeaders = new Headers(response.headers);
    for (const [key, value] of Object.entries(corsHeaders)) {
      newHeaders.set(key, value);
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  },

  async scheduled(event, env, ctx) {
    injectEnv(env);

    const baseUrl = env.WORKER_SELF_URL;
    if (!baseUrl) return;

    const headers = {
      'Content-Type': 'application/json',
      'X-Cron-Secret': env.CRON_SECRET,
    };

    if (event.cron === '0 2 1 * *') {
      ctx.waitUntil(
        fetch(`${baseUrl}/api/jobs/billing/monthly`, { method: 'POST', headers })
          .then(r => r.json())
          .then(data => console.log('Monthly billing:', data))
          .catch(err => console.error('Monthly billing failed:', err))
      );
    }

    if (event.cron === '0 6 * * *') {
      ctx.waitUntil(
        fetch(`${baseUrl}/api/jobs/billing/overdue`, { method: 'POST', headers })
          .then(r => r.json())
          .then(data => console.log('Overdue billing:', data))
          .catch(err => console.error('Overdue billing failed:', err))
      );
    }
  },
};
