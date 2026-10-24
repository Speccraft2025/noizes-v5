import { defineEnvVars } from '@sveltejs/kit/env';

// Email, signing, and rotation settings stay optional so unconfigured integrations
// do not prevent the public Studio and Exchange pages from loading.
export const variables = defineEnvVars({
	PUBLIC_SUPABASE_URL: { public: true, static: true },
	SUPABASE_SERVICE_ROLE_KEY: { static: true },
	RESEND_API_KEY: { schema: (input) => input ?? '' },
	RESEND_FROM_EMAIL: { schema: (input) => input ?? '' },
	RESEND_REPLY_TO: { schema: (input) => input ?? '' },
	PAYSTACK_SECRET_KEY: { static: true },
	PUBLIC_SUPABASE_ANON_KEY: { public: true, static: true },
	EXCHANGE_ROTATION_HOURS: { schema: (input) => input ?? '' },
	EXCHANGE_ROTATION_SECRET: { schema: (input) => input ?? '' },
	SIGNING_KEK: { schema: (input) => input ?? '' }
});
