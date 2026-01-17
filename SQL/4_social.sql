--SEARCH BY USERNAME
CREATE OR REPLACE FUNCTION search_users_by_username(search_query text)
RETURNS TABLE(id uuid, username text, avatar_url text) AS $$
BEGIN
    RETURN QUERY
    SELECT p.id, p.username, p.avatar_url 
    FROM public."Profile" p
    WHERE p.username ILIKE search_query || '%'
    LIMIT 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;



--INVITE
CREATE OR REPLACE FUNCTION invite_friend_by_id(inviter_id uuid, target_id uuid)
RETURNS void AS $$
BEGIN
    --PREVENTS MULTI CLICK
    IF EXISTS (
        SELECT 1 FROM public."Friends" 
        WHERE (user1_id = inviter_id AND user2_id = target_id)
           OR (user1_id = target_id AND user2_id = inviter_id)
    ) THEN
        RAISE EXCEPTION 'Friendship request already exists or you are already friends.';
    END IF;


    INSERT INTO public."Friends" (user1_id, user2_id, status)
    VALUES (inviter_id, target_id, 'pending');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;



--ACCEPT
CREATE OR REPLACE FUNCTION accept_friendship(friendship_id uuid)
RETURNS void AS $$
BEGIN
    UPDATE public."Friends"
    SET status = 'accepted'
    WHERE id = friendship_id
    AND user2_id = auth.uid(); --only the receiver can accept
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Request not found or you are not authorized to accept it.';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

--DECLINE FRIEND REQUEST
--This works for both the sender (cancel) and the receiver (decline)
CREATE OR REPLACE FUNCTION decline_friendship(friendship_id uuid)
RETURNS void AS $$
BEGIN
    DELETE FROM public."Friends"
    WHERE id = friendship_id
    AND (user2_id = auth.uid() OR user1_id = auth.uid()) --Either party can cancel/decline
    AND status = 'pending';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Request not found or it has already been accepted/blocked.';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;



--GROUP LOGIC

--INVITE TO GROUP
CREATE OR REPLACE FUNCTION invite_to_group(target_group_id uuid, target_user_id uuid)
RETURNS void AS $$
BEGIN
    --Check if they are already in the group or have a pending invite
    IF EXISTS (
        SELECT 1 FROM public."Group_Members" 
        WHERE group_id = target_group_id AND user_id = target_user_id
    ) THEN
        RAISE EXCEPTION 'User is already a member or has a pending invite.';
    END IF;

    INSERT INTO public."Group_Members" (group_id, user_id, status)
    VALUES (target_group_id, target_user_id, 'pending');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

--ACCEPT GROUP INVITE
CREATE OR REPLACE FUNCTION accept_group_invite(target_group_id uuid)
RETURNS void AS $$
BEGIN
    UPDATE public."Group_Members"
    SET status = 'joined'
    WHERE group_id = target_group_id 
    AND user_id = auth.uid() --Ensure user is accepting for themselves
    AND status = 'pending';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No pending invite found for this group.';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

--LEAVE OR DECLINE GROUP
CREATE OR REPLACE FUNCTION leave_group(target_group_id uuid)
RETURNS void AS $$
BEGIN
    DELETE FROM public."Group_Members"
    WHERE group_id = target_group_id
    AND user_id = auth.uid(); --Only you can remove yourself
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

--DECLINE GROUP INVITE
CREATE OR REPLACE FUNCTION decline_group_invite(target_group_id uuid)
RETURNS void AS $$
BEGIN
    DELETE FROM public."Group_Members"
    WHERE group_id = target_group_id
    AND user_id = auth.uid()
    AND status = 'pending'; --Only allows declining if they haven't joined yet

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No pending invite found to decline.';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;