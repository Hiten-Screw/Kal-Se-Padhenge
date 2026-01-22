# Setup Guide - Kal Se Padhenge (Expense Tracker)

## Quick Start

### Option 1: Local Development (Without Supabase - Fast Testing)
1. Update `index.html` - Add your Supabase credentials to the config section:
```html
<script>
    window.SUPABASE_URL = 'https://your-project.supabase.co';
    window.SUPABASE_KEY = 'your-anon-key';
</script>
```

2. Start the development server:
```bash
npm install
npm start
# or
node start_server.bat
```

3. Open browser at `http://localhost:8888`

---

### Option 2: Production Deployment (Netlify with Environment Variables)

#### Step 1: Get Supabase Credentials
1. Go to [supabase.com](https://supabase.com)
2. Create a new project or use existing one
3. Find your credentials in **Settings > API**:
   - `Project URL` → Copy as `SUPABASE_URL`
   - `anon public` key → Copy as `SUPABASE_KEY`

#### Step 2: Deploy to Netlify
1. Push code to GitHub
2. Go to [netlify.com](https://netlify.com)
3. Connect your GitHub repository
4. Go to **Site Settings > Build & Deploy > Environment**
5. Add these environment variables:
   - `SUPABASE_URL` = your_supabase_url
   - `SUPABASE_KEY` = your_supabase_key

6. Deploy the site

---

## Troubleshooting

### Login Button Not Working
**Error:** "Supabase client not initialized yet"

**Solution:**
- Ensure `SUPABASE_URL` and `SUPABASE_KEY` are set in `index.html`
- Check browser console for errors
- Wait 2-3 seconds after page loads (initialization takes time)

### Missing Config Error (404)
- This is normal for local development without API
- The app falls back to `window.SUPABASE_URL` and `window.SUPABASE_KEY`
- For production, ensure Netlify `/api/config` endpoint is working

### Dashboard Not Showing After Login
- Clear browser cache (Ctrl+Shift+Delete)
- Check browser console for JavaScript errors
- Ensure session is valid in Supabase dashboard

---

## Environment Variables

### Required for both Local & Production:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_KEY` - Your Supabase anonymous key

### Optional for Production:
- `NODE_ENV` - Set to 'production' for deployment
- `PORT` - Server port (default: 8888)

---

## File Structure

```
├── index.html          # Main HTML with embedded config
├── src/
│   ├── main.js        # App initialization & auth logic
│   ├── api/           # API endpoints
│   ├── components/    # Reusable components
│   ├── modules/       # Business logic modules
│   └── css/           # Stylesheets
├── netlify/
│   └── functions/
│       └── config.js  # Netlify serverless config endpoint
└── public/
    └── assets/        # Images and media
```

---

## Features

✅ Google OAuth Authentication (via Supabase)
✅ Expense Splitting with Friends
✅ Dashboard with Stats
✅ Friend Requests & Invitations
✅ Dark/Light Theme Toggle
✅ Gemini AI Integration (for expense logging)
✅ Investment Links & Tips

---

## Support

For issues or questions:
1. Check browser console for errors
2. Review `/netlify/functions/config.js` for config endpoint setup
3. Verify Supabase credentials are correct
4. Clear cache and reload page

