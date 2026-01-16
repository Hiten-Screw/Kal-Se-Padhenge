create or replace function get_user_net_balance(user_uuid uuid)
returns numeric
language plpgsql
security definer
as $$
declare
    total_lent numeric;
    total_borrowed numeric;
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