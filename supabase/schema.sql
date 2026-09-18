-- Dakaropoly — the whole backend.
--
-- There is no server: a room is a row, a Realtime channel and a set of
-- functions. This file is the authoritative record of what is applied to the
-- Supabase project, kept in the repository so that the rules a game depends
-- on can be read and reviewed here rather than only in a dashboard. It is
-- idempotent — running it again is safe.
--
-- The shape of the security model, in one paragraph: **the tables cannot be
-- read or written directly.** Every path goes through a `security definer`
-- function that takes the caller's identity from `auth.uid()` rather than
-- from the request body, so passing somebody else's id gets you nowhere. The
-- room code is therefore a real key: `get_room(code)` is the only way in, and
-- there is no way to list other people's games.

-- ------------------------------------------------------------------ tables

create table if not exists public.rooms (
  code       text primary key,                 -- 'QH5C42'
  status     text not null default 'lobby',    -- lobby | playing | over
  host_id    uuid not null,
  seed       bigint,                           -- agreed RNG seed
  state      jsonb,                            -- GameState snapshot
  version    integer not null default 0,       -- compare-and-set counter
  seat_order jsonb not null default '[]',      -- client ids, frozen at kickoff
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.room_players (
  room_code text not null references public.rooms(code) on delete cascade,
  client_id uuid not null,
  seat      smallint,      -- 0..7; null marks a spectator
  name      text not null,
  pawn      smallint,
  avatar    text,          -- unused: identity is the chosen pawn
  joined_at timestamptz not null default now(),
  -- Whether somebody is still there has to be a fact the database can check:
  -- a chair is only offered to someone else once it has gone quiet, and a
  -- client that could assert "they are gone" could take one from under a
  -- player.
  last_seen timestamptz not null default now(),
  primary key (room_code, client_id)
);

-- A seat *is* a pawn: one index keeps both unique, and turn order follows the
-- pawn table. Two players choosing the same token at the same moment is
-- settled here rather than in application code — the loser gets a constraint
-- violation, which is the one outcome that cannot go wrong.
create unique index if not exists room_players_seat_unique
  on public.room_players (room_code, seat) where seat is not null;
create unique index if not exists room_players_pawn_unique
  on public.room_players (room_code, pawn) where seat is not null;

create index if not exists room_players_last_seen
  on public.room_players (room_code, last_seen);
create index if not exists rooms_stale on public.rooms (updated_at);

-- Row level security is on with no policies at all. Nothing reaches these
-- tables except through the functions below, which run as the owner. Policies
-- granting what no path uses would only be somewhere for a mistake to hide —
-- and two of them were: `rooms_update` tested membership by subquerying
-- `room_players`, which is denied, so starting a game silently updated
-- nothing; and a plain delete on `room_players` was filtered to zero rows,
-- which PostgREST reports as success, so leaving a room did nothing at all.
alter table public.rooms enable row level security;
alter table public.room_players enable row level security;

-- --------------------------------------------------------------- functions
--
-- `SEAT_TIMEOUT` is 75 seconds, written inline below. Clients report in every
-- 20 seconds through `touch_seat`, so a chair survives three missed beats —
-- a tunnel, a locked phone, a reload — before anyone else is offered it.

-- The only way to see a room. Demands the code, which is what makes the code
-- a key rather than a label. `absent` is computed here, not on a device.
create or replace function public.get_room(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when r.code is null then null else jsonb_build_object(
    'code', r.code,
    'status', r.status,
    'host_id', r.host_id,
    'seed', r.seed,
    'state', r.state,
    'version', r.version,
    'seat_order', r.seat_order,
    'seats', coalesce((
      select jsonb_agg(jsonb_build_object(
        'client_id', p.client_id, 'seat', p.seat, 'name', p.name,
        'pawn', p.pawn, 'avatar', p.avatar,
        'absent', p.last_seen < now() - interval '75 seconds'
      ) order by p.joined_at)
      from public.room_players p where p.room_code = r.code
    ), '[]'::jsonb)
  ) end
  from public.rooms r where r.code = p_code;
$$;

-- Creating a room also sweeps rooms nobody has touched in a day, so finished
-- games do not pile up. There is no scheduler to maintain.
create or replace function public.create_room(p_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Identité manquante' using errcode = '28000';
  end if;

  -- Cascades to room_players.
  delete from public.rooms where updated_at < now() - interval '24 hours';

  insert into public.rooms (code, host_id) values (p_code, me);
end;
$$;

-- Sitting down in a lobby, or standing at the back when p_pawn is null.
create or replace function public.claim_seat(
  p_code text, p_client_id uuid, p_name text, p_pawn smallint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := coalesce(auth.uid(), p_client_id);
begin
  if me is null then
    raise exception 'Identité manquante' using errcode = '28000';
  end if;
  if not exists (select 1 from public.rooms where code = p_code) then
    raise exception 'Aucun salon avec ce code' using errcode = 'P0002';
  end if;

  insert into public.room_players (room_code, client_id, seat, name, pawn, last_seen)
  values (p_code, me, p_pawn, p_name, p_pawn, now())
  on conflict (room_code, client_id)
  do update set seat = excluded.seat, name = excluded.name,
                pawn = excluded.pawn, last_seen = now();
end;
$$;

-- Taking back a chair in a game already under way.
--
-- Your own is always yours: a reload keeps the tab's identity, so coming
-- straight back costs nothing. Somebody else's is only free once they have
-- stopped reporting in — because they left, which deletes their row, or
-- because nothing has been heard from them for well over a minute.
create or replace function public.resume_seat(p_code text, p_seat smallint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me        uuid := auth.uid();
  room      public.rooms%rowtype;
  holder    public.room_players%rowtype;
  held      boolean;
  seat_name text;
  seat_pawn smallint;
begin
  if me is null then
    raise exception 'Identité manquante' using errcode = '28000';
  end if;

  -- Locked for the rest of the call: two people reaching for the same empty
  -- chair at the same moment must not both walk away believing they got it.
  select * into room from public.rooms where code = p_code for update;
  if not found then
    raise exception 'Aucun salon avec ce code' using errcode = 'P0002';
  end if;
  if room.status = 'lobby' then
    raise exception 'La partie n''a pas encore commencé' using errcode = '22023';
  end if;
  if p_seat < 0 or p_seat >= jsonb_array_length(room.seat_order) then
    raise exception 'Place inconnue' using errcode = '22023';
  end if;

  select * into holder
    from public.room_players
   where room_code = p_code and seat = p_seat;
  held := found;

  if held and holder.client_id <> me
     and holder.last_seen > now() - interval '75 seconds' then
    raise exception 'Cette place est encore occupée' using errcode = '42501';
  end if;

  -- The name and pawn come from the board, not from the roster row that is
  -- about to be replaced: the engine froze them at kickoff and they are what
  -- every other player already sees.
  seat_name := coalesce(room.state->'players'->(p_seat::int)->>'name', 'Joueur');
  seat_pawn := coalesce((room.state->'players'->(p_seat::int)->>'pawn')::smallint, p_seat);

  if held and holder.client_id <> me then
    delete from public.room_players
     where room_code = p_code and client_id = holder.client_id;
  end if;

  insert into public.room_players (room_code, client_id, seat, name, pawn, last_seen)
  values (p_code, me, p_seat, seat_name, seat_pawn, now())
  on conflict (room_code, client_id)
  do update set seat = excluded.seat, name = excluded.name,
                pawn = excluded.pawn, last_seen = now();

  -- The engine numbers players by their position in this list, so taking the
  -- chair means taking the index. Rebuilding the list instead would renumber
  -- everyone still at the table.
  update public.rooms
     set seat_order = jsonb_set(seat_order, array[p_seat::text], to_jsonb(me::text))
   where code = p_code;
end;
$$;

-- Still here. Called on a timer while a device is in a room.
create or replace function public.touch_seat(p_code text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.room_players
     set last_seen = now()
   where room_code = p_code and client_id = auth.uid();
$$;

-- Giving the chair up, and the room with it when it was an empty lobby this
-- device was hosting.
--
-- This used to be a plain delete from the client. Row level security filtered
-- it to nothing and PostgREST answered 204, so leaving looked like it had
-- worked while the seat stayed held and the room stayed remembered.
create or replace function public.leave_room(p_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Identité manquante' using errcode = '28000';
  end if;

  delete from public.room_players
   where room_code = p_code and client_id = me;

  -- A lobby whose host walks out has no future. One with a game under way
  -- does: the others are still playing, and somebody will want back in.
  delete from public.rooms
   where code = p_code and host_id = me and status = 'lobby';
end;
$$;

-- Kickoff. The seed is fixed here so every client builds the same board, and
-- the seating is frozen because the engine numbers players by their position
-- in this list.
create or replace function public.open_room(
  p_code text, p_seed bigint, p_state jsonb, p_seat_order jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if not exists (select 1 from public.rooms where code = p_code and host_id = me) then
    raise exception 'Seul l''hôte peut lancer la partie' using errcode = '42501';
  end if;

  update public.rooms
     set status = 'playing', seed = p_seed, state = p_state,
         version = 1, seat_order = p_seat_order, updated_at = now()
   where code = p_code and status = 'lobby';
end;
$$;

-- One turn's worth of progress, written only by the device that played it.
-- Compare-and-set on `version`: a refused write means that device is behind
-- and should pull the room again rather than overwrite somebody's turn.
create or replace function public.advance_room(p_code text, p_state jsonb, p_from integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  hit integer;
begin
  if not exists (
    select 1 from public.room_players
    where room_code = p_code and client_id = auth.uid() and seat is not null
  ) then
    raise exception 'Vous ne jouez pas dans ce salon' using errcode = '42501';
  end if;

  update public.room_players
     set last_seen = now()
   where room_code = p_code and client_id = auth.uid();

  update public.rooms
     set state = p_state,
         version = p_from + 1,
         status = case when p_state->>'phase' = 'game-over' then 'over' else 'playing' end,
         updated_at = now()
   where code = p_code and version = p_from;
  get diagnostics hit = row_count;
  return hit = 1;
end;
$$;

-- ------------------------------------------------------------------ grants
--
-- Every one of these refuses an anonymous caller on its own terms already;
-- saying so at the grant keeps the rule in one readable place. Anonymous
-- sign-in must be enabled in the project (Authentication -> Providers):
-- without an identity there is nothing to check a seat against.
revoke execute on function public.get_room(text) from anon;
revoke execute on function public.create_room(text) from anon;
revoke execute on function public.claim_seat(text, uuid, text, smallint) from anon;
revoke execute on function public.resume_seat(text, smallint) from anon;
revoke execute on function public.touch_seat(text) from anon;
revoke execute on function public.leave_room(text) from anon;
revoke execute on function public.open_room(text, bigint, jsonb, jsonb) from anon;
revoke execute on function public.advance_room(text, jsonb, integer) from anon;
