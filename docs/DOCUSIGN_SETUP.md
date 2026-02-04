# DocuSign setup for testing (lease e-signatures)

You **cannot** create or use Integration Keys in a **production** DocuSign account. For testing, you must use a **Developer (demo)** account and create an app there.

---

## 1. Use the Developer account (not production)

- The page you’re on says **“Configure your production apps here”** and **“You cannot create an integration key in production.”**
- **For testing**, use the **DocuSign Developer** environment:
  1. Go to **[developer.docusign.com](https://developer.docusign.com)** and sign in (or create a free developer account).
  2. In the top navigation, open **“Apps and Keys”** (or **“My Apps and Keys”**).
  3. Make sure you’re in the **developer** area (URL often contains `account-d.docusign.com` or “demo”), **not** the production “Apps and Keys” you have open now.

---

## 2. Create an app and get credentials

1. In the **developer** Apps and Keys page, click **“Add App and Integration Key”** (or “Create Integration Key”).
2. Give it a name (e.g. “RentFlow”).
3. **Integration type** – choose **“Public integration”** (“Use if you are a DocuSign Partner building a public integration for multiple customers”). Do **not** use “Embedded integration” (that’s for DocuSign Embed / ISV license); “Private custom” is only for a single company integrating their own systems.
4. **Integration Key** – copy this; this is your `DOCUSIGN_INTEGRATION_KEY`.
5. Under **“Secret Key”** (or “Keys”): generate or reveal the secret. Copy it; this is your `DOCUSIGN_SECRET_KEY`.
   - If you don’t see a secret, you may need to add an **RSA keypair** or use **“Add Secret Key”** depending on the UI.

---

## 3. Add Redirect URI (required for “Connect DocuSign”)

DocuSign must redirect to your **frontend** URL (not the Supabase function). Add your app’s Settings URL **exactly** (no trailing slash):

1. Open your app (e.g. RentFlow) in the DocuSign Developer Center → **Apps and Keys** → click the app.
2. Find **“Redirect URIs”** (often under **Authentication** or **General Info**).
3. Click **“Add URI”** and add your **frontend** URL:
   - **Production:** `https://www.payrentflow.com/admin/settings` (or your real domain)
   - **Local dev:** `http://localhost:5173/admin/settings`
   Add both if you test on localhost and production.
4. **Save** (some UIs require a separate Save button).
5. Try “Connect DocuSign” again. After you authorize, DocuSign redirects to this URL with `?code=...&state=...`; the app then exchanges the code with your auth and completes the connection.

---

## 4. Set Supabase Edge Function secrets

In **Supabase Dashboard** → your project → **Edge Functions** → **Secrets** (or **Settings → API**), add:

| Secret name                 | Value                                      |
|----------------------------|--------------------------------------------|
| `DOCUSIGN_INTEGRATION_KEY` | Integration Key from step 2                |
| `DOCUSIGN_SECRET_KEY`      | Secret Key from step 2                     |
| `DOCUSIGN_BASE_URL`        | `https://account-d.docusign.com` (demo)   |

Optional (app can work without these for basic connect + send):

- `DOCUSIGN_REDIRECT_URI` – only if you want to override: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/docusign-callback`
- `DOCUSIGN_WEBHOOK_SECRET` – only needed when you add Connect webhooks later
- `ENCRYPTION_KEY` – optional; used to encrypt stored tokens (defaults to integration key if not set)

**Redeploy** the DocuSign-related functions after changing secrets:

```bash
supabase functions deploy docusign-connect
supabase functions deploy docusign-callback
supabase functions deploy send-lease-for-signature
supabase functions deploy get-embedded-signing-url
```

---

## 5. Test the flow

1. In your app, go to **Admin → Settings** (or wherever “Connect DocuSign” is).
2. Click **“Connect DocuSign”** (or equivalent). You should be sent to DocuSign to sign in and authorize.
3. Sign in with your **developer** DocuSign account (the one where you created the Integration Key).
4. After authorizing, you should be redirected back and see “Connected”.
5. Create a lease and **“Send for signature”**; the envelope should be created in your **developer** DocuSign account.

---

## Quick reference

| Purpose              | Where to do it                    | Notes                                      |
|----------------------|-----------------------------------|--------------------------------------------|
| Integration type     | General Info → Integration Type   | Use **Public integration** (not Embedded)  |
| Create Integration Key | **Developer** account only       | developer.docusign.com → Apps and Keys     |
| Redirect URI         | Same app → Redirect URIs          | Must match exactly; no trailing slash       |
| Production go-live   | DocuSign “Go live” process        | After testing in developer account          |
| OAuth base URL (demo) | `DOCUSIGN_BASE_URL`              | `https://account-d.docusign.com`            |

If you still see “No Integration Keys found,” you are in the **production** Apps and Keys; switch to the **developer** site (developer.docusign.com) and create the app there.

---

## Troubleshooting: "The redirect URI is not registered properly with Docusign"

This error appears when DocuSign does not have the exact callback URL in the app's Redirect URIs. It can happen on **localhost** or production; the redirect URI is always the **deployed** Supabase URL (the Edge Function runs on Supabase).

**Checklist:**

1. **Same app as your Integration Key** – The `client_id` in the DocuSign error URL must be the app where you added the URI. In DocuSign Developer Center → Apps and Keys, open the app whose **Integration Key** matches the one in Supabase (`DOCUSIGN_INTEGRATION_KEY`). Add the redirect URI there.

2. **Exact URL, no typo** – In that app's **Redirect URIs**, add **exactly** (no trailing slash, `https`): `https://heismaqehgqxcrndtqmz.supabase.co/functions/v1/docusign-callback` If your project ref is different, use your ref. Copy-paste; do not type by hand.

3. **Save in DocuSign** – Click **Save** so the new URI is stored.

4. **No wrong redirect in Supabase** – In Supabase → Edge Functions → Secrets, if `DOCUSIGN_REDIRECT_URI` is set, it must be exactly the same URL. If unsure, remove it so the function uses the default.

5. **Localhost is fine** – When you click Connect DocuSign from localhost, the request goes to the **deployed** Supabase function. You do not need a localhost redirect URI in DocuSign.

6. **Retry** – Wait a minute after saving in DocuSign, then try again (incognito can help).
