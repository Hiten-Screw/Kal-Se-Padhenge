--CLS

-- 1. Reset permissions to start from a "Zero Trust" state
REVOKE ALL ON TABLE public."Profile" FROM anon, authenticated;

-- 2. Grant access to the ID and Username to everyone (for search bars)
GRANT SELECT (id, username) ON public."Profile" TO authenticated;

-- 3. Grant access to Email ONLY for the owner (so they can see it in their settings)
-- Note: This works because RLS will still filter the row to 'auth.uid() = id'
GRANT SELECT (email) ON public."Profile" TO authenticated;

-- 4. Allow users to ONLY update their username (prevents tampering with IDs/Emails)
GRANT UPDATE (username) ON public."Profile" TO authenticated;

-- ==========================================
-- EXPENSES TABLE - RLS INSERT POLICY
-- ==========================================
-- This policy allows authenticated users to INSERT new expenses
-- where they are the payer

CREATE POLICY "Enable users to insert their own expenses"
ON public."Expenses"
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = payer_id
);