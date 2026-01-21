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
    select coalesce(sum(amount), 0)
    into total_lent
    from public."Expenses"
    where payer_id = user_uuid 
    and is_settled = false;

    select coalesce(sum(amount), 0)
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
    -- Mark all active expenses btw 2 as done
    UPDATE public."Expenses"
    SET is_settled = true
    WHERE (payer_id = user_a AND receiver_id = user_b AND is_settled = false)
       OR (payer_id = user_b AND receiver_id = user_a AND is_settled = false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;






--EXPENSE FUNCTION
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
BEGIN
    --USERNAME TO UUID
    SELECT id INTO target_id 
    FROM public."Profile" 
    WHERE username = target_username;

    --FRIEND NO FOUND
    IF target_id IS NULL THEN 
        RAISE EXCEPTION 'User % not found in IntelliDivide', target_username; 
    END IF;

    --PREVENT SELECTING YOURSELF
    IF sender_id = target_id THEN
        RAISE EXCEPTION 'You cannot log an expense with yourself.';
    END IF;

    --INSERT TO EXPENSE TABLE
    INSERT INTO public."Expenses" (
        description, 
        amount, 
        payer_id, 
        receiver_id, 
        group_id
    )
    VALUES (
        expense_description, 
        final_amount, 
        sender_id, 
        target_id, 
        target_group_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;