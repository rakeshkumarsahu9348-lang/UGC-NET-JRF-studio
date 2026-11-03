# NET JRF Studio — UGC NET Paper 1 Practice Website

Ye project ek bilingual (English/Hindi), unit-wise UGC NET Paper 1 practice website hai. Frontend GitHub Pages par host hota hai; secure login, AI generation, answer checking aur permanent multi-device history Supabase backend par chalti hai.

## Features included

- Paper 1 ke 10 units, har unit ka alag practice page.
- Har practice set mein 5 MCQs; har question 2 marks. Wrong answer par negative marking nahi.
- Question aur options English, Hindi ya Both mode mein.
- Submit karne ke baad correct/incorrect status, correct option aur explanation. History se purane completed set ka question-wise review dobara khol sakte ho.
- Timer ON/OFF setting.
- Set start hote hi questions user ki permanent `seen` history mein save hote hain. Selected options bhi har click par cloud mein auto-save hote hain. Incomplete set next login par resume hota hai; seen question us user ko dobara allocate nahi hota.
- Cloud history and progress sync across devices, because records are stored in Supabase (not only browser storage).
- Each unit has a hard database limit of 500 questions. Question generator 5-question batches mein bank ko gradually fill karta hai, global exact-duplicate fingerprint check karta hai, aur per-user history se already-seen questions ko exclude karta hai.
- 20 completed questions ke baad practice grade card unlock hota hai; browser se print / Save as PDF.
- History CSV export.
- Admin dashboard: registration list, page-open/login/signup events, completed-set counts and per-unit question counts.
- AI doubt helper (Gemini API) answers in English and Hindi. External buttons open official Gemini, ChatGPT, Perplexity and Google websites.

## Honest limitations / important notes

1. **5,000 questions are not preloaded in this ZIP.** The system can generate up to 500 per unit using your configured Gemini API key. It generates as users request more sets. Gemini quota, model availability and any applicable API charges depend on your Google AI account.
2. Generated items are labelled as AI practice, **not authentic previous-year questions**. Search grounding can help the generator consult current web results, but AI can still make mistakes. Verify exam facts and policy questions from UGC/NTA sources.
3. Duplicate blocking uses a database-wide normalized English-question fingerprint plus each user's permanent seen-question list. This reliably blocks exact/near-exact punctuation variants, but no AI-only system can guarantee that two differently worded questions never test a similar concept. Review AI items before relying on them as a final question bank.
4. ChatGPT, Gemini and Perplexity are separate services. This site does not grant their paid plans or full API access. It provides one configured Gemini API connection for generation/doubt help and official links to the other services.
5. History is cloud-saved, not guaranteed “never deletable”. Keep Supabase backups enabled and export your CSV periodically. A hosting/database owner can still delete a project or data.
6. Signup asks for a recovery email. Login is by username + password. The password is handled by Supabase Auth and is not saved in frontend code or shown in admin.
7. The practice grade is a study-progress grade, not an official NTA/UGC grade or JRF qualification prediction.

## A. Create Supabase backend

1. Open [Supabase](https://supabase.com/) and create a new project. Save your database password privately.
2. In the project, open **SQL Editor → New query**.
3. Open `supabase/schema.sql` from this project, copy the whole file, paste it in SQL Editor, and press **Run** once.
4. Go to **Project Settings → API** (or API Keys). Copy:
   - Project URL
   - Publishable key (or legacy anon/public key)
5. In Authentication settings, enable Email provider. Email confirmation may stay ON (users will need to verify the recovery email before their first login); turn it OFF only if you knowingly want instant signup without email verification.
6. Never put the Supabase **secret/service_role** key in a website file, GitHub Pages setting, `.env` frontend variable, screenshot or public repository.

## B. Configure Gemini question generation

1. Create an API key in [Google AI Studio](https://aistudio.google.com/app/apikey).
2. In your computer terminal, install the [Supabase CLI](https://supabase.com/docs/guides/cli) and sign in:

   ```bash
   supabase login
   supabase link --project-ref YOUR_SUPABASE_PROJECT_REF
   ```

3. Set the server-side secrets. The current default model in this project is `gemini-3.8-flash`; change `GEMINI_MODEL` to a model currently available to your Google AI Studio project if required.

   ```bash
   supabase secrets set GEMINI_API_KEY=YOUR_GEMINI_API_KEY GEMINI_MODEL=gemini-3.8-flash GEMINI_USE_SEARCH=true
   ```

   `GEMINI_USE_SEARCH=true` enables the Google Search grounding tool in the question-generation request. Search grounding and model access depend on Google's API support, quota and billing rules. If the model/API does not support it for your account, set it to `false`.

4. Deploy all seven Edge Functions:

   ```bash
   supabase functions deploy username-login
   supabase functions deploy username-reset
   supabase functions deploy generate-set
   supabase functions deploy save-answer
   supabase functions deploy submit-set
   supabase functions deploy get-session-review
   supabase functions deploy ask-doubt
   ```

   `username-login` and `username-reset` accept requests before login; login returns the same generic error for an unknown username or wrong password, and reset never reveals whether an account exists. The other functions require an authenticated user token.

## C. Make your first account the admin

1. Open the deployed website and use **Create an account**.
2. Create your admin username as `Rakesh99`, enter a real recovery email and use a **new, strong, unique password**. Do not put a password in code or share it in screenshots/chats. Do not reuse a weak password that has already been shared in a chat.
3. After signup (and email verification if enabled), return to Supabase → SQL Editor and run:

   ```sql
   update public.profiles
   set role = 'admin'
   where lower(username) = lower('Rakesh99');
   ```

4. Log out and log in again. Admin Panel will now appear in the sidebar.
5. Every later account created through the website has `user` role by default. Do not give other accounts admin rights unless you mean to.

## D. Run the website locally (optional)

1. Install Node.js 22 or newer.
2. Open a terminal inside this project folder.
3. Copy `.env.example` to `.env.local` and fill the two public values:

   ```env
   VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
   ```

4. Run:

   ```bash
   npm install
   npm run dev
   ```

5. Open the local URL shown in the terminal. Never add the Supabase secret/service_role key or Gemini API key to `.env.local`.

## E. Publish with GitHub Pages

1. Create a new **public** GitHub repository (example: `ugc-net-jrf-studio`).
2. Upload the contents of this project folder to the repository root. Do not upload `node_modules` or `.env.local`.
3. In GitHub open **Settings → Secrets and variables → Actions → New repository secret**. Add:
   - `VITE_SUPABASE_URL` = your Supabase Project URL
   - `VITE_SUPABASE_ANON_KEY` = your Supabase publishable/anon key
4. Open **Settings → Pages**, choose **GitHub Actions** as the build/deployment source.
5. The included `.github/workflows/deploy.yml` builds and deploys the site when you push to the `main` branch. Open the Actions tab and wait for the workflow to show a green success tick. Your public site URL will be shown in the deployment.
6. In Supabase open **Authentication → URL Configuration**. Set **Site URL** to the exact GitHub Pages URL (example: `https://YOUR-GITHUB-NAME.github.io/ugc-net-jrf-studio/`) and add that same URL to **Redirect URLs**. This is needed for email verification and password reset links.
7. For the reset link to return to your site, optionally set the Supabase Edge secret `APP_SITE_URL` to that same full URL:

   ```bash
   supabase secrets set APP_SITE_URL=https://YOUR-GITHUB-NAME.github.io/ugc-net-jrf-studio/
   ```

If you use a branch named something other than `main`, edit the branch name in `.github/workflows/deploy.yml`.

## F. Admin / student account behaviour

- Username is stored in lowercase and compared case-insensitively. It must be 3–24 characters and use English letters, numbers or underscore.
- Database unique index blocks duplicate usernames even if two people try the same name at almost the same time. The signup page checks availability while typing and displays “This name is already taken”. A database transaction also reserves one active set per user/unit, preventing simultaneous devices from receiving duplicate sets.
- Users can log in on more than one phone/computer. Each account sees its own cloud history after logging in.
- When a user opens a set, its five questions are marked as seen before they answer. Closing the browser cannot make those questions available to that same user again.
- The timer preference and language preference are local to each browser; attempts/history/results are in the cloud. Password reset is available from the login page and sends a reset link to the recovery email.
- Anonymous page-open counts are approximate analytics events. No IP address or password is collected for the admin dashboard.

## Main folders

```text
src/                         React frontend
src/data/units.js            Paper 1 unit list and practice-grade thresholds
src/lib/supabase.js          Supabase public client
supabase/schema.sql          Database schema, indexes, RLS and username uniqueness
supabase/functions/          Secure backend functions
.github/workflows/deploy.yml GitHub Pages deployment
```

## Useful references

- [Official UGC-NET updated syllabus listing](https://www.ugcnetonline.in/syllabus-new.php?form=MG0AV3)
- [Supabase security and Row Level Security](https://supabase.com/docs/guides/database/secure-data)
- [Supabase Edge Function secrets](https://supabase.com/docs/guides/functions/secrets)
- [Gemini API model list](https://ai.google.dev/gemini-api/docs/models)
- [Gemini Google Search grounding](https://ai.google.dev/gemini-api/docs/google-search)
