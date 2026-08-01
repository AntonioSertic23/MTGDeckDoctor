-- Migrate decks from an old (often anonymous) user to your email account.
-- Run in Supabase → SQL Editor.
--
-- Step 1: find your NEW account id (the email you just signed up with)
select id, email, is_anonymous, created_at
from auth.users
order by created_at desc;

-- Step 2: see who currently owns decks
select
  u.id,
  u.email,
  u.is_anonymous,
  count(d.id) as deck_count
from auth.users u
left join public.decks d on d.user_id = u.id
group by u.id, u.email, u.is_anonymous
order by deck_count desc, u.created_at desc;

-- Step 3: paste IDs below, then run the block
--   new_id = your email account from step 1
--   old_id = the anonymous (or old) row that has deck_count > 0

do $$
declare
  new_id uuid := 'PASTE_NEW_USER_UUID_HERE';
  old_id uuid := 'PASTE_OLD_USER_UUID_HERE';
begin
  if new_id = old_id then
    raise exception 'new_id and old_id must be different';
  end if;

  update public.decks
    set user_id = new_id
    where user_id = old_id;

  update public.inventory_items
    set user_id = new_id
    where user_id = old_id;

  update public.card_allocations
    set user_id = new_id
    where user_id = old_id;

  raise notice 'Migration done for % → %', old_id, new_id;
end $$;

-- Step 4: verify
select id, name, user_id, updated_at
from public.decks
order by name;
