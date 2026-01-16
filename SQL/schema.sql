-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.Expenses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  amount bigint NOT NULL,
  description text NOT NULL,
  payer_id uuid NOT NULL,
  receiver_id uuid NOT NULL,
  is_settled boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT (now() AT TIME ZONE 'utc'::text),
  group_id uuid,
  CONSTRAINT Expenses_pkey PRIMARY KEY (id),
  CONSTRAINT Expenses_payer_id_fkey FOREIGN KEY (payer_id) REFERENCES public.Profile(id),
  CONSTRAINT Expenses_receiver_id_fkey FOREIGN KEY (receiver_id) REFERENCES public.Profile(id),
  CONSTRAINT Expenses_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.Group(id)
);
CREATE TABLE public.Friends (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user1_id uuid NOT NULL,
  user2_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT Friends_pkey PRIMARY KEY (id),
  CONSTRAINT Friends_user1_id_fkey FOREIGN KEY (user1_id) REFERENCES public.Profile(id),
  CONSTRAINT Friends_user2_id_fkey FOREIGN KEY (user2_id) REFERENCES public.Profile(id)
);
CREATE TABLE public.Group (
  id uuid NOT NULL,
  name text NOT NULL,
  created_by uuid NOT NULL,
  CONSTRAINT Group_pkey PRIMARY KEY (id),
  CONSTRAINT Group_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.Profile(id)
);
CREATE TABLE public.Group_Members (
  group_id uuid NOT NULL,
  user_id uuid NOT NULL,
  CONSTRAINT Group_Members_pkey PRIMARY KEY (group_id, user_id),
  CONSTRAINT Group_Members_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.Group(id),
  CONSTRAINT Group_Members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.Profile(id)
);
CREATE TABLE public.Profile (
  id uuid NOT NULL,
  email text NOT NULL UNIQUE,
  username text NOT NULL UNIQUE,
  avatar_url text,
  CONSTRAINT Profile_pkey PRIMARY KEY (id),
  CONSTRAINT Profile_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);