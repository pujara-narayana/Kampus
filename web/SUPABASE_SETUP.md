# Finding Your Supabase Database URL

## Step-by-Step Visual Guide

### Option 1: Dashboard Method

1. **Go to Supabase Dashboard**
   - Visit: https://supabase.com/dashboard
   - Log in to your account

2. **Select Your Project**
   - Click on your project: `scrnrkzxjebqsomgwrwg`
   - Or go directly to: https://supabase.com/dashboard/project/scrnrkzxjebqsomgwrwg

3. **Navigate to Settings**
   - Look at the **left sidebar**
   - Scroll down to find **Settings** (⚙️ gear icon)
   - Click on it

4. **Go to Database Settings**
   - In the Settings menu, click **"Database"**
   - This will show database configuration options

5. **Find Connection String**
   - Scroll down to the **"Connection string"** section
   - You'll see tabs: **URI**, **JDBC**, **Golang**, etc.
   - Click on the **"URI"** tab
   - You'll see a connection string that starts with `postgresql://`

6. **Copy the Connection String**
   - Click the copy button next to the connection string
   - It will look like:
     ```
     postgresql://postgres.scrnrkzxjebqsomgwrwg:[YOUR-PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres
     ```

### Option 2: Manual Construction

If you can't find the connection string, you can build it manually:

1. **Get Your Database Password**
   - In Settings → Database
   - Scroll to **"Database password"** section
   - If you don't see it, click **"Reset database password"**
   - Copy the password

2. **Use This Template**
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.scrnrkzxjebqsomgwrwg.supabase.co:5432/postgres
   ```
   
   Replace `[YOUR-PASSWORD]` with your actual password.

### Option 3: Connection Pooling (Recommended for Prisma)

For better performance with Prisma, use the **pooled connection**:

1. In Settings → Database → Connection string
2. Select **"Session mode"** or **"Transaction mode"** (both work)
3. Copy the URI - it will use port `6543` instead of `5432`
4. Format:
   ```
   postgresql://postgres.scrnrkzxjebqsomgwrwg:[PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres
   ```

## Alternative Locations (If Database isn't in Settings)

### Method A: Look in the Left Sidebar Directly
1. In your project dashboard, look at the **left sidebar**
2. You might see **"Database"** as a main menu item (not under Settings)
3. Click on **"Database"** directly
4. Look for **"Connection string"** or **"Connection info"** section

### Method B: Project Settings → API
1. Go to **Settings** (gear icon)
2. Look for **"API"** or **"Project API"** 
3. Sometimes connection info is shown there

### Method C: SQL Editor
1. Click on **"SQL Editor"** in the left sidebar
2. Sometimes connection details are shown there
3. Or create a new query and check the connection info

### Method D: Use the Direct URL Pattern
If you can find your **database password** anywhere (even if you need to reset it), you can construct the URL manually:

**Direct Connection:**
```
postgresql://postgres:[YOUR-PASSWORD]@db.scrnrkzxjebqsomgwrwg.supabase.co:5432/postgres
```

**Pooled Connection (Better for Prisma):**
```
postgresql://postgres.scrnrkzxjebqsomgwrwg:[YOUR-PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres
```

### Method E: Check Project Settings → General
1. Go to **Settings**
2. Click **"General"** or **"Project Settings"**
3. Look for database connection information

## Common Issues

### "I don't see Settings in the sidebar"
- Make sure you're logged in
- Settings is usually at the **bottom** of the sidebar
- Try scrolling down in the sidebar

### "Database isn't an option in Settings"
- Try clicking **"Database"** directly from the main sidebar (not under Settings)
- Or look in **Settings → API** or **Settings → General**
- The connection string might be in the **SQL Editor** section

### "I can't find Connection string section"
- Make sure you're in the right section
- The Connection string section is usually near the bottom
- Look for tabs: URI, JDBC, Golang, etc.
- Try searching for "connection" or "database url" in the page

### "I forgot my database password"
- Go to Settings → Database
- Click **"Reset database password"**
- Copy the new password immediately (you won't see it again)
- Update your `.env` file with the new password

## Quick Test

Once you have the connection string, test it:

```bash
cd web
# Add to .env file:
# DATABASE_URL="postgresql://..."

# Test the connection
npx prisma db pull
```

If this works, your connection string is correct!
