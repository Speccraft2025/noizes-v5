import { defineEnvVars } from '@sveltejs/kit/env';

// SvelteKit validates configured variables through Standard Schema. These
// integrations are deliberately optional in local development, so normalize a
// missing value to an empty string instead of making the public Studio fail to
// start before a mail or signing service has been configured.
const optionalString = {
	'~standard': {
		version: 1,
		vendor: 'noizes',
		validate: (value) => ({ value: value ?? '' })
	}
};

// Email, signing, and rotation settings stay optional so unconfigured integrations
// do not prevent the public Studio and Exchange pages from loading.
export const variables = defineEnvVars({
	PUBLIC_SUPABASE_URL: { public: true, static: true },
	SUPABASE_SERVICE_ROLE_KEY: { static: true },
	RESEND_API_KEY: { schema: optionalString },
	RESEND_FROM_EMAIL: { schema: optionalString },
	RESEND_REPLY_TO: { schema: optionalString },
	PAYSTACK_SECRET_KEY: { static: true },
	PUBLIC_SUPABASE_ANON_KEY: { public: true, static: true },
	EXCHANGE_ROTATION_HOURS: { schema: optionalString },
	EXCHANGE_ROTATION_SECRET: { schema: optionalString },
	SIGNING_KEK: { schema: optionalString }
});
