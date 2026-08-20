# Setting up Google (Calendar + Gmail)

Life OS signs you in with Google and uses that login to read your calendar and mail. Because the app runs on *your* machine, there is no shared Google app to "log in to" — you create your own (free) OAuth client in Google Cloud and paste its credentials into the setup wizard. Ten minutes, once.

What you end up with:

- A **Client ID** and **Client Secret** (stored locally in `config.json`).
- A refresh token (stored locally in the database) that lets Life OS sync in the background.

## 1. Create a Google Cloud project

1. Go to <https://console.cloud.google.com/> and sign in with the Google account you want Life OS to use.
2. Top bar → project dropdown → **New project**. Name it anything (`Life OS`). Create it and make sure it is selected.

## 2. Enable the APIs

**APIs & Services → Library**. Search for and **Enable** each of:

- **Google Calendar API**
- **Gmail API**

## 3. Configure the OAuth consent screen

**APIs & Services → OAuth consent screen** (newer consoles call this **Google Auth Platform → Branding / Audience**).

1. User type: **External** (the only option for a personal Gmail account). Create.
2. App name: `Life OS`. User support email and developer contact: your own address. Save.
3. **Scopes**: click **Add or remove scopes** and add these three (paste them into the "manually add scopes" box):

   ```
   https://www.googleapis.com/auth/calendar
   https://www.googleapis.com/auth/gmail.modify
   https://www.googleapis.com/auth/gmail.send
   ```

   `openid`, `email` and `profile` are requested automatically for sign-in. These exact scopes are what the app asks for (see `GOOGLE_SCOPES` in `src/lib/auth.ts`).

   | Scope | Used for |
   |---|---|
   | `calendar` | Reading your calendars/events and adding events |
   | `gmail.modify` | Reading inbox mail and applying labels / archiving |
   | `gmail.send` | Sending replies from the AI inbox |

4. **Test users**: add the Google account you'll sign in with. **Do not skip this** — without it you get `access_denied` at login.
5. Save and continue to the summary.

## 4. Create the OAuth client

**APIs & Services → Credentials → + Create credentials → OAuth client ID**.

- Application type: **Web application**
- Name: `Life OS desktop`
- **Authorized JavaScript origins**: `http://localhost:3210`
- **Authorized redirect URIs**: exactly

  ```
  http://localhost:3210/api/auth/callback/google
  ```

  (If you run Life OS on a different port, use that port instead — the wizard shows the exact URI for your install.)

Click **Create**. Copy the **Client ID** (ends in `.apps.googleusercontent.com`) and **Client secret**.

## 5. Paste into Life OS and sign in

In the wizard's **Google** step (or later under **Settings → Integrations → Google**) paste both values and click **Sign in with Google**. A browser window opens:

1. Pick your account.
2. You will see **"Google hasn't verified this app"**. This is expected — it is *your* app, and Google only verifies apps published to the public. Click **Advanced → Go to Life OS (unsafe)**.
3. Tick all the permissions and **Continue**.

You are sent back to Life OS; the first account that completes this becomes the **owner** of the install and no other account can sign in afterwards.

## 6. Publish the app (strongly recommended)

While the consent screen is in **Testing** mode, Google expires refresh tokens after **7 days**. Life OS would then stop syncing and show a "needs a re-login" notification every week.

Fix: **OAuth consent screen → Publishing status → Publish app → Confirm**.

- You do **not** need to submit for verification. Google will show a warning about sensitive scopes; ignore it. Because you never share the client ID, the "unverified app" interstitial only ever affects you.
- After publishing, sign in again once (Settings → Integrations → Google → Sign in) so a non-expiring refresh token is issued.

## Troubleshooting

**`redirect_uri_mismatch`**
The redirect URI in the Google console does not match byte-for-byte. It must be `http://localhost:3210/api/auth/callback/google` — `http` not `https`, `localhost` not `127.0.0.1`, no trailing slash, correct port. Console edits can take a minute to propagate.

**`access_denied` / "Life OS has not completed the Google verification process"**
Your account is not in the **Test users** list (Testing mode) — add it, or publish the app.

**"This app is blocked" (Google Workspace accounts)**
Your workspace admin restricts third-party apps. Either ask them to allow your client ID, or use a personal Gmail account.

**"needs a re-login" notification every week**
You are still in Testing mode — see step 6.

**Signed in with the wrong account**
Only the first account is allowed. Quit the app, delete `config.json`'s `core.allowedEmail` value (or delete the whole data folder to start fresh — see [SECURITY.md](SECURITY.md)), relaunch and sign in with the right account.

**`invalid_client`**
Client ID/secret copy-paste error (stray whitespace, or the secret was regenerated in the console). Re-paste under Settings → Integrations → Google.

## Rotating or removing access

- **Revoke Life OS from Google:** <https://myaccount.google.com/permissions> → Life OS → Remove access.
- **Rotate the client secret:** Credentials → your client → **Reset secret**, then paste the new one in Settings → Integrations → Google and sign in again.
- **Delete everything locally:** quit the app and delete the data folder (paths in [SECURITY.md](SECURITY.md)).
