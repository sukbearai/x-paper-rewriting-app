# fc3 SMS Relay

Tencent Cloud SMS bridge for Supabase OTP webhooks. Built with Hono and deployed to Alibaba Cloud Function Compute (FC3).

## How It Works

- Supabase sends the `send-sms` webhook to the root endpoint (`POST /`).
- The handler verifies the signature via `standardwebhooks` using `SUPABASE_HOOK_SECRET`.
- Verified requests forward the OTP code to Tencent Cloud SMS with TC3 signed requests.
- A lightweight `/dev` endpoint lets you trigger manual SMS sends during development.

## Prerequisites

- Node.js 20 runtime (mirrors FC3 runtime).
- Global `pnpm` (project root uses a pnpm monorepo).
- Alibaba Cloud account configured for Serverless Devs (`s`) CLI deployment.
- Tencent Cloud SMS service activated with a verified signature and template.

## Environment Variables

Copy `.env.example` to `.env` (or inject via FC3 console) and provide the required secrets:

| Key | Required | Description |
| --- | --- | --- |
| `SUPABASE_HOOK_SECRET` | Yes | Supabase webhook signing secret (use the `v1,whsec_*` value). |
| `TENCENT_SMS_SDK_APP_ID` | Yes | Tencent Cloud SMS application ID. |
| `TENCENT_SMS_SIGN` | Yes | Bound SMS signature name. |
| `TENCENT_SMS_TEMPLATE_ID` | Yes | OTP template ID (expects one variable for the code). |
| `SECRET_ID` | Yes | Tencent Cloud API secret ID. |
| `SECRET_KEY` | Yes | Tencent Cloud API secret key. |
| `TENCENT_SMS_REGION` | No | Optional override for API region (`ap-guangzhou` by default). |
| `TENCENT_SMS_TOKEN` | No | Session token when using temporary credentials. |
| `TENCENT_SMS_LANGUAGE` | No | Response language hint, e.g. `en-US` or `zh-CN`. |

> Supabase webhook secrets are stored base64 encoded. The handler will accept both the raw `whsec_*` form and the bare base64 string.

## Local Development

- `pnpm i` (run once at repo root) installs dependencies.
- `pnpm --filter fc3 build` bundles `src/index.ts` into `dist/index.js` via esbuild.
- `pnpm --filter fc3 deploy` runs `s deploy -y`, pushing the bundle to FC3. Set `S_ACCESS=<profile>` for alternate Serverless Devs credentials.
- To exercise the `/dev` endpoint locally or after deployment, send a JSON payload:

```bash
curl -X POST "https://<fc3-endpoint>/dev" \
	-H "content-type: application/json" \
	-d '{"phone": "13800138000", "code": "123456"}'
```

## Supabase Setup Checklist

- Enable the `send-sms` webhook and set the target URL to the deployed FC3 HTTP trigger.
- Copy the webhook secret into `SUPABASE_HOOK_SECRET`.
- Ensure the webhook payload includes `user.phone` and `sms.otp` (Supabase default for OTP).
- Tencent SMS template must expect a single numeric parameter (the OTP code).

## Troubleshooting

- **Signature errors**: Confirm webhook secret and that Supabase sends the `whsec_` prefixed key.
- **Invalid phone format**: Handler accepts E.164 (`+8613...`), mainland 11-digit (`1XXXXXXXXXX`), or `861XXXXXXXXXX`.
- **Tencent API errors**: Review the response JSON logged by FC3; update template or signature status accordingly.
- **Temporary credentials**: Supply `TENCENT_SMS_TOKEN` alongside `SECRET_ID/SECRET_KEY`.

## Deployment Notes

- FC3 runtime uses Node.js 20; keep dependencies edge-compatible.
- Logs are available in Alibaba Cloud Function Compute console; use them to inspect webhook payloads.
- Secrets should be configured through Function Compute environment variables rather than hard-coded files in production.
