-- FIX: Add missing 'settled_amount' column to Expenses table
-- This is required for the new 'Partial Settlement' feature to work.

ALTER TABLE public."Expenses" 
ADD COLUMN IF NOT EXISTS settled_amount numeric DEFAULT 0;

-- Optional: Verify it was added
-- SELECT * FROM public."Expenses" LIMIT 1;
