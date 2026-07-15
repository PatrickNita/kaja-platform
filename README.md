# KAJA Internal Platform

A Vercel-ready Next.js workspace for Patrick, Ionut, Igor, and Andrei. Members use private capability links to publish updates, manage shared tasks, and see an immutable activity trail.

## Deploy

1. Import this repository into Vercel.
2. Add the **Neon** integration from the Vercel Marketplace. It injects `DATABASE_URL`.
3. Run `pnpm db:migrate` with that environment value to create the tables.
4. Generate secrets, add them as Vercel environment variables, then redeploy:

   ```bash
   openssl rand -hex 32
   ```

   Set `SESSION_SECRET` to one generated value. Set `MEMBER_LINKS` to comma-separated entries such as `patrick:<secret>,ionut:<secret>,igor:<secret>,andrei:<secret>`.
5. Share each member’s link as `https://your-domain.vercel.app/member/<name>/<secret>`.

Never commit real secrets. A member link grants access as that person.
