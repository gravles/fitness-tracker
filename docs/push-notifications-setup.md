# Push Notifications Setup Guide

This guide explains how to set up Web Push notifications for the Life Logger fitness tracker app.

## Prerequisites

- A deployed version of the app (push notifications don't work on localhost)
- Node.js installed locally

## Step 1: Generate VAPID Keys

VAPID (Voluntary Application Server Identification) keys are required for web push notifications. Run this command to generate them:

```bash
npx web-push generate-vapid-keys
```

You'll get output like:
```
Public Key:  BNxRLJ5...
Private Key: 8ZxnZ9...
```

## Step 2: Add Environment Variables

Add these to your `.env.local` file and your deployment environment:

```env
# Public key (exposed to browser)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BNxRLJ5...your-public-key...

# Private key (server-only, never expose to browser)
VAPID_PRIVATE_KEY=8ZxnZ9...your-private-key...

# Email for VAPID identification
VAPID_SUBJECT=mailto:your-email@example.com
```

## Step 3: Update Supabase Storage

Create a storage bucket for progress photos:

1. Go to Supabase Dashboard → Storage
2. Create a new bucket called `progress-photos`
3. Set it to **Public** (or configure signed URLs if you prefer)
4. Add these policies:
   - INSERT: `auth.uid() = owner`
   - SELECT: `true` (public) or `auth.uid() = owner`
   - DELETE: `auth.uid() = owner`

## Step 4: Run Database Migrations

Run the migration file to create the required tables:

```sql
-- Copy contents of feature_migrations.sql and run in Supabase SQL Editor
```

This creates:
- `progress_photos` - For storing progress photo metadata
- `user_goals` - For goal tracking
- `workout_templates` - Pre-built workout programs
- `push_subscriptions` - Push notification subscriptions
- `shared_achievements` - For social sharing

## Step 5: Deploy and Test

1. Deploy your app to your hosting provider (Vercel, Netlify, etc.)
2. Visit the deployed app on a mobile device
3. Go to Settings and enable notifications
4. Grant notification permission when prompted
5. Test by triggering a streak warning or daily reminder

## Troubleshooting

### Notifications not showing
- Ensure you're on the deployed site (not localhost)
- Check that service worker is registered (`navigator.serviceWorker.ready`)
- Verify VAPID keys are correctly set

### Permission denied
- User may have blocked notifications in browser settings
- Check `Notification.permission` status

### Subscription fails
- Verify VAPID public key is correct
- Check browser console for errors

## Production Checklist

- [ ] VAPID keys generated and added to environment
- [ ] Database migrations run
- [ ] Storage bucket created
- [ ] Service worker registered
- [ ] Test notification on mobile device
