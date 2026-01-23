--Calculation

--NET BALANCE    
CREATE OR REPLACE FUNCTION get_user_net_balance(user_uuid uuid)
returns numeric(10,2)
language plpgsql
security definer
as $$
declare
    total_lent numeric(10,2);
    total_borrowed numeric(10,2);
begin
    select coalesce(sum(amount - COALESCE(settled_amount, 0)), 0)
    into total_lent
    from public."Expenses"
    where payer_id = user_uuid 
    and is_settled = false;

    select coalesce(sum(amount - COALESCE(settled_amount, 0)), 0)
    into total_borrowed
    from public."Expenses"
    where receiver_id = user_uuid 
    and is_settled = false;

    return total_lent - total_borrowed;
end;
$$;

--1TO1 BALANCE
CREATE OR REPLACE FUNCTION get_friend_balance(my_id uuid, friend_id uuid)
RETURNS numeric(10,2)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    i_lent numeric(10,2);
    i_borrowed numeric(10,2);
BEGIN
    -- 1. Money I paid for this specific friend
    SELECT coalesce(sum(amount), 0) INTO i_lent
    FROM public."Expenses"
    WHERE payer_id = my_id AND receiver_id = friend_id AND is_settled = false;

    -- 2. Money this friend paid for me
    SELECT coalesce(sum(amount), 0) INTO i_borrowed
    FROM public."Expenses"
    WHERE payer_id = friend_id AND receiver_id = my_id AND is_settled = false;

    RETURN i_lent - i_borrowed;
END;
$$;

-- GROUP BALANCE
CREATE OR REPLACE FUNCTION get_group_balance(user_uuid uuid, target_group_id uuid)
RETURNS numeric(10,2)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    total_lent numeric(10,2);
    total_borrowed numeric(10,2);
BEGIN
    SELECT coalesce(sum(amount), 0) INTO total_lent
    FROM public."Expenses"
    WHERE payer_id = user_uuid 
      AND group_id = target_group_id 
      AND is_settled = false;

    SELECT coalesce(sum(amount), 0) INTO total_borrowed
    FROM public."Expenses"
    WHERE receiver_id = user_uuid 
      AND group_id = target_group_id 
      AND is_settled = false;

    RETURN total_lent - total_borrowed;
END;
$$;


--SETTLEMENT
CREATE OR REPLACE FUNCTION settle_all_between_friends(user_a uuid, user_b uuid)
RETURNS void AS $$
BEGIN
    -- Mark all active expenses where user_a is the PAYER as done
    UPDATE public."Expenses"
    SET is_settled = true,
        settled_amount = amount
    WHERE payer_id = user_a 
      AND receiver_id = user_b 
      AND is_settled = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;






--SCHEMA MIGRATION (Run once)
-- ALTER TABLE public."Expenses" ADD COLUMN IF NOT EXISTS settled_amount numeric DEFAULT 0;

--EXPENSE FUNCTION WITH AUTO-NETTING
CREATE OR REPLACE FUNCTION create_expense_automated(
    sender_id uuid,
    target_username text,
    final_amount numeric(10,2),
    expense_description text,
    target_group_id uuid DEFAULT NULL
)
RETURNS void AS $$
DECLARE
    target_id uuid;
    remaining_amount numeric(10,2) := final_amount;
    reverse_txn record;
    offset_amount numeric(10,2);
BEGIN
    --USERNAME TO UUID
    SELECT id INTO target_id 
    FROM public."Profile" 
    WHERE username = target_username;

    --FRIEND NOT FOUND
    IF target_id IS NULL THEN 
        RAISE EXCEPTION 'User % not found in IntelliDivide', target_username; 
    END IF;

    --PREVENT SELECTING YOURSELF
    IF sender_id = target_id THEN
        RAISE EXCEPTION 'You cannot log an expense with yourself.';
    END IF;

    -- AUTO-NETTING LOGIC: Check for reverse debts (Money they owe ME)
    -- We are adding an expense where I paid for Them (They owe Me).
    -- So we look for expenses where They paid for Me (I owe Them).
    -- Wait... Standard Logic: 
    -- User A (Sender) pays for User B (Target). A is Payer. B is Receiver. B owes A.
    -- Reverse Debt: B previously paid for A. B is Payer. A is Receiver. A owes B.
    
    FOR reverse_txn IN 
        SELECT * FROM public."Expenses" 
        WHERE payer_id = target_id 
          AND receiver_id = sender_id 
          AND is_settled = false
        ORDER BY created_at ASC -- Settle oldest debt first
    LOOP
        -- If we have no amount left to offset, stop
        IF remaining_amount <= 0 THEN
            EXIT;
        END IF;

        -- Calculate how much can be settled from this specific reverse transaction
        -- Amount pending on old txn = amount - settled_amount
        offset_amount := LEAST(remaining_amount, reverse_txn.amount - COALESCE(reverse_txn.settled_amount, 0));

        IF offset_amount > 0 THEN
            -- Update the reverse transaction
            UPDATE public."Expenses"
            SET settled_amount = COALESCE(settled_amount, 0) + offset_amount,
                is_settled = (amount <= (COALESCE(settled_amount, 0) + offset_amount))
            WHERE id = reverse_txn.id;

            -- Reduce the amount of the NEW transaction we need to record
            remaining_amount := remaining_amount - offset_amount;
        END IF;
    END LOOP;

    -- INSERT TO EXPENSE TABLE
    -- If remaining_amount is 0, it means the entire new expense was cancelled out by existing debts.
    -- However, we still usually want to record the transaction but mark it as settled/partially settled 
    -- so history is preserved.
    -- BUT, the standard Splitwise model often just reduces the balance. 
    -- Let's record it with `settled_amount` calculated.
    
    INSERT INTO public."Expenses" (
        description, 
        amount, 
        payer_id, 
        receiver_id, 
        group_id,
        settled_amount,
        is_settled
    )
    VALUES (
        expense_description, 
        final_amount, 
        sender_id, 
        target_id, 
        target_group_id,
        (final_amount - remaining_amount), -- The amount that was offset
        (remaining_amount <= 0) -- If 0 remaining, it's fully settled immediately
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- SETTLE INDIVIDUAL TRANSACTION
CREATE OR REPLACE FUNCTION settle_transaction(txn_id uuid)
RETURNS void AS $$
BEGIN
    UPDATE public."Expenses"
    SET is_settled = true,
        settled_amount = amount
    WHERE id = txn_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;