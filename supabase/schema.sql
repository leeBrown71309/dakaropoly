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
  -- Whether the people standing behind the table may speak. Eight players is
  -- the most the voice mesh carries comfortably and a room holds any number
  -- of spectators on top; the host decides, and it is off until they say so.
  spectator_voice boolean not null default false,
  -- How long the room outlives its last seated player, in seconds. The host
  -- picks it; `set_idle_timeout` only accepts the choices the interface
  -- offers, and the check is the floor for anything written by hand.
  idle_seconds integer not null default 600 check (idle_seconds between 30 and 3600),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Rooms created before the setting existed.
alter table public.rooms
  add column if not exists idle_seconds integer not null default 600
  check (idle_seconds between 30 and 3600);

create table if not exists public.room_players (
  room_code text not null references public.rooms(code) on delete cascade,
  client_id uuid not null,
  seat      smallint,      -- 0..7; null marks a spectator
  name      text not null,
  pawn      smallint,
  avatar    text,          -- an account's photo, copied from its profile on sitting down
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

-- An account: somebody who signed in with Google and chose how the table
-- should call them. A guest has no row here, and never needs one — every
-- path below treats "no profile" as "play exactly as before".
--
-- The pseudo is unique *with* its case: « Moussa » and « moussa » are two
-- players. The shape is checked here as well as in the form, because the
-- form is only what one client believes. The characters are spelled out as
-- code point ranges rather than `[[:alpha:]]`, whose meaning depends on the
-- database locale: Latin letters with their accents, digits, a space, and
-- `_ . -`.
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  pseudo     text not null,
  -- A photo is a data URL, drawn to 128 px on the device that chose it.
  -- There is no file store to point at, and one small string travels with
  -- the roster for free. The cap keeps a hand-crafted request from parking a
  -- megabyte in every `get_room` answer.
  avatar     text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_pseudo_unique unique (pseudo),
  constraint profiles_pseudo_shape check (
    char_length(pseudo) between 3 and 14
    and pseudo = btrim(pseudo)
    and pseudo ~ '^[A-Za-z0-9À-ÖØ-öø-ÿĀ-ſ _.-]+$'
  ),
  constraint profiles_avatar_shape check (
    avatar is null
    or (avatar like 'data:image/%;base64,%' and char_length(avatar) <= 60000)
  )
);

-- One game, from kickoff to its last snapshot. A room is the evening and is
-- deleted when the evening is over; this is what is left of it afterwards.
--
-- `final` is the board as it ended, minus its journal. The ranking and the
-- evening's prizes are worked out from it on the device, by the same
-- selectors the end-of-game screen uses — writing the rules of Monopoly a
-- second time in SQL would give them a second place to drift.
create table if not exists public.games (
  id         uuid primary key default gen_random_uuid(),
  room_code  text not null,
  status     text not null default 'playing'
             check (status in ('playing', 'finished', 'unfinished')),
  started_at timestamptz not null default now(),
  ended_at   timestamptz,
  turn_count integer not null default 0,
  winner     smallint,
  final      jsonb
);

-- Who sat in each chair. A chair taken over halfway through gets a second
-- row with the turn it changed hands on, which is how the history can say
-- « a repris la place de X » — and why the game belongs to both of them.
create table if not exists public.game_seats (
  id         bigint generated always as identity primary key,
  game_id    uuid not null references public.games(id) on delete cascade,
  seat       smallint not null,                 -- engine player id
  -- A guest is recorded by the name they sat under and nothing else. So is
  -- an account once deleted: the game stays in everybody else's history,
  -- the person in it does not.
  account_id uuid references public.profiles(id) on delete set null,
  name       text not null,
  pawn       smallint not null,
  from_turn  integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists game_seats_account on public.game_seats (account_id, game_id);
create index if not exists game_seats_game on public.game_seats (game_id);

-- Deliberately not a foreign key. A game is closed by a trigger while its
-- room is being deleted, and a game with no account in it is deleted there
-- too — an `on delete set null` reaching back into the row being deleted is
-- an error that would fail the sweep carrying it.
alter table public.rooms add column if not exists game_id uuid;

-- Row level security is on with no policies at all. Nothing reaches these
-- tables except through the functions below, which run as the owner. Policies
-- granting what no path uses would only be somewhere for a mistake to hide —
-- and two of them were: `rooms_update` tested membership by subquerying
-- `room_players`, which is denied, so starting a game silently updated
-- nothing; and a plain delete on `room_players` was filtered to zero rows,
-- which PostgREST reports as success, so leaving a room did nothing at all.
alter table public.rooms enable row level security;
alter table public.room_players enable row level security;
alter table public.profiles enable row level security;
alter table public.games enable row level security;
alter table public.game_seats enable row level security;

-- --------------------------------------------------------------- functions
--
-- `SEAT_TIMEOUT` is 75 seconds, written inline below. Clients report in every
-- 20 seconds through `touch_seat`, so a chair survives three missed beats —
-- a tunnel, a locked phone, a reload — before anyone else is offered it.
-- A room itself outlives its last seated player by `idle_seconds` — ten
-- minutes unless the host chose otherwise. Past that, `release_empty_rooms`
-- deletes it and the cascade takes the roster along.

-- A room lives while somebody sits at it. "Sitting at it" is the same fact
-- the chair logic already trusts: a row whose `last_seen` is fresh. A room
-- where every seated player has gone quiet for its idle timeout — everyone
-- left for the evening, everyone's phone asleep — is nobody's game any more:
-- it is deleted, and the cascade takes the roster with it. Spectator rows do
-- not hold a room open: a table with nobody seated is not a game in play.
-- The `updated_at` guard protects the moment between a room being created
-- and its host claiming the first seat, and judges a room with no rows at
-- all by its last write. The fixed 30-second bound is the shortest timeout
-- the column allows, and lets the index on `updated_at` narrow the scan.
--
-- Every heartbeat from every device runs this, so two of them regularly run
-- it at the same moment. `skip locked` lets each one pass over the rooms the
-- other is already deleting instead of queueing behind it — waiting there is
-- how two sweeps end up deadlocked, and a deadlock would fail the read or the
-- heartbeat that carried the sweep.
create or replace function public.release_empty_rooms()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.rooms
   where code in (
     select r.code from public.rooms r
      where r.updated_at < now() - interval '30 seconds'
        and r.updated_at < now() - make_interval(secs => r.idle_seconds)
        and not exists (
          select 1 from public.room_players p
           where p.room_code = r.code
             and p.seat is not null
             and p.last_seen > now() - make_interval(secs => r.idle_seconds)
        )
      for update skip locked
   );
$$;

-- The only way to see a room. Demands the code, which is what makes the code
-- a key rather than a label. `absent` is computed here, not on a device.
--
-- It sweeps before it looks. Otherwise the sweep would only run when some
-- device somewhere wrote something, and a room whose players all left an
-- hour ago on a quiet evening would still open for whoever typed its code —
-- which is exactly what expiring it is meant to prevent.
create or replace function public.get_room(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.release_empty_rooms();

  return (
    select jsonb_build_object(
      'code', r.code,
      'status', r.status,
      'host_id', r.host_id,
      'seed', r.seed,
      'state', r.state,
      'version', r.version,
      'seat_order', r.seat_order,
      'spectator_voice', r.spectator_voice,
      'idle_seconds', r.idle_seconds,
      'seats', coalesce((
        select jsonb_agg(jsonb_build_object(
          'client_id', p.client_id, 'seat', p.seat, 'name', p.name,
          'pawn', p.pawn, 'avatar', p.avatar,
          'absent', p.last_seen < now() - interval '75 seconds'
        ) order by p.joined_at)
        from public.room_players p where p.room_code = r.code
      ), '[]'::jsonb)
    )
    from public.rooms r where r.code = p_code
  );
end;
$$;

-- Creating a room and seats its host. It also releases every room nobody has
-- been seated in for its idle timeout, so abandoned evenings do not pile up —
-- there is no scheduler to maintain, so the sweep rides the access paths.
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

  perform public.release_empty_rooms();

  insert into public.rooms (code, host_id) values (p_code, me);
end;
$$;

-- Sitting down in a lobby, or standing at the back when p_pawn is null.
--
-- An account sits down under its pseudo and with its photo, read from the
-- profile rather than from the request: the name typed on a form is only
-- what one client says, and a pseudo is unique precisely so that nobody
-- else can wear it.
create or replace function public.claim_seat(
  p_code text, p_client_id uuid, p_name text, p_pawn smallint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me          uuid := coalesce(auth.uid(), p_client_id);
  seat_name   text;
  seat_avatar text;
begin
  if me is null then
    raise exception 'Identité manquante' using errcode = '28000';
  end if;
  if not exists (select 1 from public.rooms where code = p_code) then
    raise exception 'Aucun salon avec ce code' using errcode = 'P0002';
  end if;

  -- A guest finds no profile, and the select leaves both empty.
  select pr.pseudo, pr.avatar into seat_name, seat_avatar
    from public.profiles pr where pr.id = me;
  seat_name := coalesce(seat_name, p_name);

  insert into public.room_players (room_code, client_id, seat, name, pawn, avatar, last_seen)
  values (p_code, me, p_pawn, seat_name, p_pawn, seat_avatar, now())
  on conflict (room_code, client_id)
  do update set seat = excluded.seat, name = excluded.name, pawn = excluded.pawn,
                avatar = excluded.avatar, last_seen = now();
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
  me          uuid := auth.uid();
  room        public.rooms%rowtype;
  holder      public.room_players%rowtype;
  held        boolean;
  seat_name   text;
  seat_pawn   smallint;
  seat_avatar text;
  account     uuid;
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
  --
  -- Except for an account, which answers to its pseudo wherever it sits. The
  -- board catches up through a `rename` the device plays once seated, so
  -- every client renames at the same point in the sequence. A guest finds no
  -- profile, and the select leaves all three empty.
  select pr.id, pr.pseudo, pr.avatar into account, seat_name, seat_avatar
    from public.profiles pr where pr.id = me;
  seat_name := coalesce(seat_name, room.state->'players'->(p_seat::int)->>'name', 'Joueur');
  seat_pawn := coalesce((room.state->'players'->(p_seat::int)->>'pawn')::smallint, p_seat);

  if held and holder.client_id <> me then
    delete from public.room_players
     where room_code = p_code and client_id = holder.client_id;
  end if;

  insert into public.room_players (room_code, client_id, seat, name, pawn, avatar, last_seen)
  values (p_code, me, p_seat, seat_name, seat_pawn, seat_avatar, now())
  on conflict (room_code, client_id)
  do update set seat = excluded.seat, name = excluded.name, pawn = excluded.pawn,
                avatar = excluded.avatar, last_seen = now();

  -- A chair changing hands is a new occupant in the record of the game;
  -- somebody reclaiming their own after a reload is not.
  if room.game_id is not null and room.seat_order->>(p_seat::int) is distinct from me::text then
    insert into public.game_seats (game_id, seat, account_id, name, pawn, from_turn)
    values (room.game_id, p_seat, account, seat_name, seat_pawn,
            coalesce((room.state->>'turnCount')::integer, 0));
  end if;

  -- The engine numbers players by their position in this list, so taking the
  -- chair means taking the index. Rebuilding the list instead would renumber
  -- everyone still at the table.
  update public.rooms
     set seat_order = jsonb_set(seat_order, array[p_seat::text], to_jsonb(me::text))
   where code = p_code;
end;
$$;

-- What a chair is called in the roster. The name on the board is the
-- engine's business — it froze that name at kickoff and every client carries
-- it — but the roster is what announcements and the room panel read, and a
-- late arrival who took somebody's abandoned chair would otherwise keep that
-- somebody's name on it for the rest of the evening.
--
-- Updating nobody is a success, not a failure: a spectator who came in
-- through the spectator door has no row anywhere. Their name lives in
-- presence, not in a table.
create or replace function public.rename_seat(p_code text, p_name text)
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
  if btrim(p_name) = '' then
    raise exception 'Il faut un nom' using errcode = '22023';
  end if;
  -- An account's name at the table is its pseudo, which is unique; renaming
  -- the chair would let it sit under somebody else's.
  if exists (select 1 from public.profiles where id = me) then
    raise exception 'Votre nom est votre pseudo : changez-le depuis votre profil' using errcode = '42501';
  end if;

  update public.room_players
     set name = left(btrim(p_name), 14), last_seen = now()
   where room_code = p_code and client_id = me;
end;
$$;

-- The host, and only the host, decides whether spectators get a microphone.
create or replace function public.set_spectator_voice(p_code text, p_allowed boolean)
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

  update public.rooms
     set spectator_voice = p_allowed, updated_at = now()
   where code = p_code and host_id = me;

  if not found then
    raise exception 'Seul l''hôte peut changer ce réglage' using errcode = '42501';
  end if;
end;
$$;

-- How long the room waits for somebody to sit back down before it closes.
-- The host's call, from the choices the interface offers — a table that
-- takes long breaks wants more than one that plays straight through.
create or replace function public.set_idle_timeout(p_code text, p_seconds integer)
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
  if p_seconds is null or p_seconds not in (300, 600, 900, 1200, 1800) then
    raise exception 'Durée non proposée' using errcode = '22023';
  end if;

  update public.rooms
     set idle_seconds = p_seconds, updated_at = now()
   where code = p_code and host_id = me;

  if not found then
    raise exception 'Seul l''hôte peut changer ce réglage' using errcode = '42501';
  end if;
end;
$$;

-- Still here. Called on a timer while a device is in a room — every twenty
-- seconds — so the empty-room release rides it continuously without a
-- scheduler: a room whose last seated player went quiet long enough ago is
-- swept by the very next heartbeat from anywhere.
--
-- The sweep runs *before* the beat is recorded. A device waking from a long
-- sleep must not revive a room that expired while it was away; it learns
-- instead, from the answer, that there is no room left to report to — which
-- is the only way a device can find out, since nobody tells a deleted room's
-- players anything.
drop function if exists public.touch_seat(text);
create function public.touch_seat(p_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.release_empty_rooms();

  update public.room_players
     set last_seen = now()
   where room_code = p_code and client_id = auth.uid();

  return exists (select 1 from public.rooms where code = p_code);
end;
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
--
-- The game's record opens here too, with one occupant per chair. It is
-- written by the database, never by a device: nothing a client sends says
-- who played, only which chairs its identity holds.
create or replace function public.open_room(
  p_code text, p_seed bigint, p_state jsonb, p_seat_order jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me  uuid := auth.uid();
  gid uuid;
begin
  if not exists (select 1 from public.rooms where code = p_code and host_id = me) then
    raise exception 'Seul l''hôte peut lancer la partie' using errcode = '42501';
  end if;

  update public.rooms
     set status = 'playing', seed = p_seed, state = p_state,
         version = 1, seat_order = p_seat_order, updated_at = now()
   where code = p_code and status = 'lobby';

  -- Already under way: a second kickoff changed nothing, so it records nothing.
  if not found then
    return;
  end if;

  -- In the lobby a chair is numbered by its pawn; from here on it is the
  -- engine's player number, its position in `seat_order` — which is what
  -- `seatOf`, `resume_seat` and every roster lookup compare it with. Left as
  -- pawns, a table that picked pawns 1 and 3 kicked off with both players
  -- reading as spectators of their own game, and a reload was refused a
  -- chair that "was still taken" by the other player's pawn number.
  --
  -- Anybody who sat down after the host's list was drawn up is not in the
  -- game, and stands. The renumbering goes through negative numbers because
  -- the seat index is checked row by row: moving pawn 2 onto seat 1 while
  -- pawn 1 still holds it would collide halfway through.
  update public.room_players p
     set seat = null
   where p.room_code = p_code
     and p.seat is not null
     and not (p_seat_order ? p.client_id::text);

  update public.room_players p
     set seat = -o.idx::smallint
    from jsonb_array_elements_text(p_seat_order) with ordinality as o(client, idx)
   where p.room_code = p_code and p.client_id::text = o.client;

  update public.room_players
     set seat = -seat - 1
   where room_code = p_code and seat < 0;

  insert into public.games (room_code) values (p_code) returning id into gid;
  update public.rooms set game_id = gid where code = p_code;

  insert into public.game_seats (game_id, seat, account_id, name, pawn, from_turn)
  select gid,
         (o.idx - 1)::smallint,
         pr.id,
         coalesce(p_state->'players'->(o.idx::int - 1)->>'name', 'Joueur'),
         coalesce((p_state->'players'->(o.idx::int - 1)->>'pawn')::smallint, (o.idx - 1)::smallint),
         0
    from jsonb_array_elements_text(p_seat_order) with ordinality as o(client, idx)
    left join public.profiles pr on pr.id::text = o.client;
end;
$$;

-- Closes a game's record: how it ended, and the board it ended on. Only a
-- game still in play is touched, so a finished game is never overwritten by
-- the room being swept afterwards.
--
-- A table nobody with an account sat at is nobody's history, and it is
-- dropped rather than kept for no one to read. Guests are most games.
create or replace function public.close_game(
  p_game uuid, p_state jsonb, p_status text, p_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.games
     set status = p_status,
         ended_at = p_at,
         turn_count = coalesce((p_state->>'turnCount')::integer, 0),
         winner = (p_state->>'winner')::smallint,
         final = p_state - 'log'
   where id = p_game and status = 'playing';

  delete from public.games g
   where g.id = p_game
     and not exists (
       select 1 from public.game_seats s
        where s.game_id = g.id and s.account_id is not null
     );
end;
$$;

-- A room being deleted — swept for idleness, or closed by hand — takes its
-- game with it into the history as unfinished, on the last board anybody
-- wrote. `updated_at` is when that was, which is when play really stopped.
create or replace function public.close_game_with_room()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.game_id is not null and old.state is not null then
    perform public.close_game(old.game_id, old.state, 'unfinished', old.updated_at);
  end if;
  return old;
end;
$$;

drop trigger if exists rooms_close_game on public.rooms;
create trigger rooms_close_game
  before delete on public.rooms
  for each row execute function public.close_game_with_room();

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
  gid uuid;
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
   where code = p_code and version = p_from
  returning game_id into gid;
  get diagnostics hit = row_count;

  -- The last snapshot of a game is the one its record keeps.
  if hit = 1 and gid is not null and p_state->>'phase' = 'game-over' then
    perform public.close_game(gid, p_state, 'finished', now());
  end if;

  return hit = 1;
end;
$$;

-- ---------------------------------------------------------------- accounts
--
-- A guest is an anonymous session; an account is a session signed in with
-- Google that has saved a profile. Only the second kind can write one —
-- asked of `auth.users` rather than of a claim in the request, which is the
-- whole reason these are functions and not policies.

-- Whether a pseudo can be taken. The caller's own counts as free, so that
-- saving a profile without changing the pseudo is not refused by itself.
-- The answer is advice for the form: `save_profile` settles it for real.
create or replace function public.pseudo_available(p_pseudo text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.profiles
     where pseudo = btrim(p_pseudo) and id is distinct from auth.uid()
  );
$$;

-- This session's profile, or null — a guest, or an account that has not
-- chosen its pseudo yet.
create or replace function public.get_my_profile()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('pseudo', pr.pseudo, 'avatar', pr.avatar)
    from public.profiles pr
   where pr.id = auth.uid();
$$;

-- Creating the profile, or changing it. Two people reaching for the same
-- pseudo at the same second are settled by the unique constraint: the second
-- is told plainly, which is the one answer the form cannot give on its own.
create or replace function public.save_profile(p_pseudo text, p_avatar text)
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
  if not exists (select 1 from auth.users where id = me and is_anonymous is not true) then
    raise exception 'Connectez-vous avec Google pour créer un profil' using errcode = '42501';
  end if;

  begin
    insert into public.profiles (id, pseudo, avatar)
    values (me, btrim(p_pseudo), p_avatar)
    on conflict (id)
    do update set pseudo = excluded.pseudo, avatar = excluded.avatar, updated_at = now();
  exception
    when unique_violation then
      raise exception 'Ce pseudo existe déjà' using errcode = '23505';
    when check_violation then
      raise exception 'Ce pseudo ou cette photo ne convient pas' using errcode = '23514';
  end;
end;
$$;

-- Deleting the account, for good. The profile goes with the user row; every
-- seat it held in somebody's history keeps the name it sat under and loses
-- the link to a person. A game nobody with an account is left in has no one
-- to be read by, and goes too.
create or replace function public.delete_account()
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

  delete from auth.users where id = me;

  delete from public.games g
   where g.status <> 'playing'
     and not exists (
       select 1 from public.game_seats s
        where s.game_id = g.id and s.account_id is not null
     );
end;
$$;

-- The history: this account's most recent games, newest first.
--
-- The people in them come back once each, apart from the games. A photo is
-- a few kilobytes, and repeating it at every seat of twenty games is how an
-- evening's opponents turned into a megabyte.
create or replace function public.get_my_games(p_limit integer default 20)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Identité manquante' using errcode = '28000';
  end if;

  return (
    with mine as (
      select g.*
        from public.games g
       where exists (
         select 1 from public.game_seats s where s.game_id = g.id and s.account_id = me
       )
       order by g.started_at desc
       limit least(greatest(coalesce(p_limit, 20), 1), 50)
    ),
    seats as (
      select s.* from public.game_seats s join mine m on m.id = s.game_id
    )
    select jsonb_build_object(
      'games', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', m.id,
          'status', m.status,
          'started_at', m.started_at,
          'ended_at', m.ended_at,
          'turn_count', m.turn_count,
          'winner', m.winner,
          'final', m.final,
          'seats', coalesce((
            select jsonb_agg(jsonb_build_object(
              'seat', s.seat, 'account_id', s.account_id, 'name', s.name,
              'pawn', s.pawn, 'from_turn', s.from_turn
            ) order by s.seat, s.from_turn, s.id)
            from seats s where s.game_id = m.id
          ), '[]'::jsonb)
        ) order by m.started_at desc)
        from mine m
      ), '[]'::jsonb),
      'people', coalesce((
        select jsonb_object_agg(pr.id::text, jsonb_build_object('pseudo', pr.pseudo, 'avatar', pr.avatar))
          from public.profiles pr
         where pr.id in (select account_id from seats)
      ), '{}'::jsonb)
    )
  );
end;
$$;

-- ------------------------------------------------------------------ grants
--
-- Every one of these refuses an anonymous caller on its own terms already;
-- saying so at the grant keeps the rule in one readable place. Anonymous
-- sign-in must be enabled in the project (Authentication -> Providers):
-- without an identity there is nothing to check a seat against. (Signing in
-- anonymously makes a device `authenticated`; `anon` is a request carrying
-- no session at all.)
--
-- The revoke names `public` as well as `anon`: every new function is
-- executable by `public`, which `anon` belongs to, so revoking from `anon`
-- alone changed nothing — six of these stayed callable without a session.
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.get_room(text)',
    'public.release_empty_rooms()',
    'public.create_room(text)',
    'public.claim_seat(text, uuid, text, smallint)',
    'public.resume_seat(text, smallint)',
    'public.rename_seat(text, text)',
    'public.touch_seat(text)',
    'public.set_spectator_voice(text, boolean)',
    'public.set_idle_timeout(text, integer)',
    'public.leave_room(text)',
    'public.open_room(text, bigint, jsonb, jsonb)',
    'public.advance_room(text, jsonb, integer)',
    'public.pseudo_available(text)',
    'public.get_my_profile()',
    'public.save_profile(text, text)',
    'public.delete_account()',
    'public.get_my_games(integer)'
  ] loop
    execute format('revoke execute on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;

  -- Reached only from the functions above, which run as the owner. Callable
  -- from outside, closing a game would let anybody end somebody else's.
  foreach fn in array array[
    'public.close_game(uuid, jsonb, text, timestamptz)',
    'public.close_game_with_room()'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', fn);
  end loop;
end;
$$;
