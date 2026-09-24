-- Kotoba: all user-owned data is private. Scheduling runs in one database transaction.
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 email text not null, created_at timestamptz not null default now()
);
create table public.user_settings (
 user_id uuid primary key references auth.users(id) on delete cascade,
 daily_new_words int not null default 20 check (daily_new_words between 0 and 500),
 daily_review_limit int not null default 100 check (daily_review_limit between 0 and 2000),
 preferred_language text not null default 'zh' check (preferred_language in ('zh','en')),
 timezone text not null default 'Asia/Shanghai', show_romaji boolean not null default false,
 show_translation boolean not null default true,
 jlpt_levels text[] not null default array['N1','N2','N3','N4','N5','Custom'] check (jlpt_levels <@ array['N1','N2','N3','N4','N5','Custom']),
 theme text not null default 'light' check (theme in ('light','dark','system'))
);
create table public.vocabulary (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 word text not null check (length(trim(word)) between 1 and 200), kana text not null default '' check(length(kana)<=200),
 romaji text not null default '', meaning_zh text not null default '', meaning_en text not null default '',
 jlpt_level text not null default 'N1' check(jlpt_level in ('N1','N2','N3','N4','N5','Custom')),
 part_of_speech text not null default '', example_sentence text not null default '', example_kana text not null default '',
 example_translation text not null default '', notes text not null default '', tags text[] not null default '{}',
 created_at timestamptz not null default now(), unique(user_id,word,kana), unique(user_id,id)
);
create table public.user_vocabulary (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 vocabulary_id uuid not null, status text not null default 'new' check(status in ('new','learning','review','mastered')),
 favorite boolean not null default false, difficulty numeric not null default 5,
 stability numeric not null default 0, ease numeric not null default 2.5, interval_days numeric not null default 0,
 repetitions int not null default 0, review_count int not null default 0, correct_count int not null default 0,
 incorrect_count int not null default 0, first_learned_at timestamptz, last_reviewed_at timestamptz,
 last_forgotten_at timestamptz, next_review_at timestamptz, version int not null default 0,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(user_id,vocabulary_id), foreign key(user_id,vocabulary_id) references public.vocabulary(user_id,id) on delete cascade
);
create table public.study_sessions (
 id uuid not null, user_id uuid not null references auth.users(id) on delete cascade,
 started_at timestamptz not null default now(), ended_at timestamptz,
 new_words int not null default 0, reviews int not null default 0,
 correct_answers int not null default 0, incorrect_answers int not null default 0,
 duration_ms bigint not null default 0, primary key(user_id,id)
);
create table public.review_logs (
 id uuid primary key default gen_random_uuid(), action_id uuid not null,
 user_id uuid not null references auth.users(id) on delete cascade, vocabulary_id uuid not null,
 session_id uuid not null, rating int not null check(rating between 1 and 4),
 reviewed_at timestamptz not null default now(), client_reviewed_at timestamptz not null,
 study_date date not null, was_new boolean not null,
 previous_interval numeric not null, next_interval numeric not null, duration_ms int not null,
 unique(user_id,action_id), foreign key(user_id,vocabulary_id) references public.vocabulary(user_id,id) on delete cascade,
 foreign key(user_id,session_id) references public.study_sessions(user_id,id) on delete cascade
);
create table public.daily_statistics (
 user_id uuid not null references auth.users(id) on delete cascade, study_date date not null,
 new_words int not null default 0, reviews int not null default 0, correct_answers int not null default 0,
 incorrect_answers int not null default 0, duration_ms bigint not null default 0,
 primary key(user_id,study_date)
);
create index vocabulary_level_idx on public.vocabulary(user_id,jlpt_level);
create index vocabulary_tags_idx on public.vocabulary using gin(tags);
create index due_words_idx on public.user_vocabulary(user_id,next_review_at) where status <> 'new';
create index review_history_idx on public.review_logs(user_id,vocabulary_id,reviewed_at desc);
create index review_day_idx on public.review_logs(user_id,study_date);
create index sessions_user_idx on public.study_sessions(user_id,started_at desc);

alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.vocabulary enable row level security;
alter table public.user_vocabulary enable row level security;
alter table public.study_sessions enable row level security;
alter table public.review_logs enable row level security;
alter table public.daily_statistics enable row level security;
create policy own_profile on public.profiles for select to authenticated using ((select auth.uid())=id);
create policy own_settings on public.user_settings for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy own_vocabulary on public.vocabulary for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy own_progress on public.user_vocabulary for select to authenticated using ((select auth.uid())=user_id);
create policy own_sessions on public.study_sessions for select to authenticated using ((select auth.uid())=user_id);
create policy own_logs on public.review_logs for select to authenticated using ((select auth.uid())=user_id);
create policy own_days on public.daily_statistics for select to authenticated using ((select auth.uid())=user_id);
grant usage on schema public to authenticated;
grant select on public.profiles,public.user_vocabulary,public.study_sessions,public.review_logs,public.daily_statistics to authenticated;
grant select,insert,update,delete on public.vocabulary,public.user_settings to authenticated;
-- Explicit revocation also protects projects with permissive default privileges.
revoke insert,update,delete on public.user_vocabulary,public.review_logs,public.daily_statistics,public.study_sessions,public.profiles from anon,authenticated;
revoke all on public.vocabulary,public.user_settings from anon;

create function public.on_signup() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.profiles(id,email) values(new.id,coalesce(new.email,''));
 insert into public.user_settings(user_id) values(new.id);
 return new;
end; $$;
create trigger kotoba_signup after insert on auth.users for each row execute function public.on_signup();
create function public.on_word_added() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.user_vocabulary(user_id,vocabulary_id) values(new.user_id,new.id);
 return new;
end; $$;
create trigger kotoba_word_added after insert on public.vocabulary for each row execute function public.on_word_added();
create function public.validate_timezone() returns trigger language plpgsql set search_path = '' as $$
begin
 if not exists(select 1 from pg_catalog.pg_timezone_names where name=new.timezone) then raise exception 'Invalid timezone'; end if;
 return new;
end; $$;
create trigger kotoba_timezone before insert or update on public.user_settings for each row execute function public.validate_timezone();

-- SM-2-style schedule: Again=10m, Hard=1.2x, Good=1d/6d/ease*x, Easy=4d/ease*1.3*x.
-- Lock the progress row, reject stale device versions, and deduplicate before any mutation.
create function public.submit_review(p_action_id uuid,p_vocabulary_id uuid,p_session_id uuid,p_rating int,p_expected_version int,p_client_reviewed_at timestamptz,p_duration_ms int)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); r public.user_vocabulary; old_interval numeric; next_interval numeric;
 reps int; new_ease numeric; stamp timestamptz := now(); day date; tz text; is_new boolean; duration int;
begin
 if u is null then raise exception 'Authentication required'; end if;
 if p_rating not between 1 and 4 or p_rating is null then raise exception 'Invalid rating'; end if;
 if p_client_reviewed_at is null or p_client_reviewed_at > stamp + interval '5 minutes' then raise exception 'Invalid review time'; end if;
 select * into r from public.user_vocabulary where user_id=u and vocabulary_id=p_vocabulary_id for update;
 if not found then raise exception 'Word not found'; end if;
 if exists(select 1 from public.review_logs where user_id=u and action_id=p_action_id) then
   return jsonb_build_object('duplicate',true,'progress',to_jsonb(r));
 end if;
 if r.version <> p_expected_version or p_expected_version is null then raise exception 'STALE_REVIEW: this word changed on another device'; end if;
 old_interval := r.interval_days; is_new := r.status='new'; reps := r.repetitions; new_ease := r.ease;
 if p_rating=1 then next_interval:=10.0/1440; reps:=0; new_ease:=greatest(1.3,r.ease-0.2);
 elsif p_rating=2 then next_interval:=greatest(1,r.interval_days*1.2); new_ease:=greatest(1.3,r.ease-0.15);
 elsif p_rating=3 then next_interval:=case when reps=0 then 1 when reps=1 then 6 else greatest(1,round(r.interval_days*r.ease)) end; reps:=reps+1;
 else next_interval:=case when reps=0 then 4 else greatest(4,round(r.interval_days*r.ease*1.3)) end; reps:=reps+1; new_ease:=r.ease+0.15;
 end if;
 next_interval:=least(next_interval,36500);
 select timezone into tz from public.user_settings where user_id=u;
 -- Preserve offline study dates, but never schedule into the past after synchronization.
 day := (least(p_client_reviewed_at,stamp) at time zone coalesce(tz,'UTC'))::date;
 duration:=greatest(0,least(coalesce(p_duration_ms,0),600000));
 insert into public.study_sessions(id,user_id,started_at) values(p_session_id,u,least(p_client_reviewed_at,stamp)) on conflict do nothing;
 insert into public.review_logs(action_id,user_id,vocabulary_id,session_id,rating,client_reviewed_at,study_date,was_new,previous_interval,next_interval,duration_ms)
 values(p_action_id,u,p_vocabulary_id,p_session_id,p_rating,p_client_reviewed_at,day,is_new,old_interval,next_interval,duration);
 update public.user_vocabulary set status=case when p_rating=1 then 'learning' when next_interval>=30 then 'mastered' else 'review' end,
 interval_days=next_interval, stability=next_interval, difficulty=greatest(1,least(10,5+(2.5-new_ease)*3)),ease=new_ease,repetitions=reps,
 review_count=review_count+1,correct_count=correct_count+case when p_rating>1 then 1 else 0 end,incorrect_count=incorrect_count+case when p_rating=1 then 1 else 0 end,
 first_learned_at=coalesce(first_learned_at,least(p_client_reviewed_at,stamp)),last_reviewed_at=stamp,
 last_forgotten_at=case when p_rating=1 then stamp else last_forgotten_at end,
 next_review_at=stamp+next_interval*interval '1 day',updated_at=stamp,version=version+1
 where user_id=u and vocabulary_id=p_vocabulary_id returning * into r;
 update public.study_sessions set ended_at=stamp,new_words=new_words+is_new::int,reviews=reviews+(not is_new)::int,
 correct_answers=correct_answers+(p_rating>1)::int,incorrect_answers=incorrect_answers+(p_rating=1)::int,duration_ms=duration_ms+duration where user_id=u and id=p_session_id;
 insert into public.daily_statistics(user_id,study_date,new_words,reviews,correct_answers,incorrect_answers,duration_ms)
 values(u,day,is_new::int,(not is_new)::int,(p_rating>1)::int,(p_rating=1)::int,duration)
 on conflict(user_id,study_date) do update set new_words=daily_statistics.new_words+excluded.new_words,reviews=daily_statistics.reviews+excluded.reviews,
 correct_answers=daily_statistics.correct_answers+excluded.correct_answers,incorrect_answers=daily_statistics.incorrect_answers+excluded.incorrect_answers,duration_ms=daily_statistics.duration_ms+excluded.duration_ms;
 return jsonb_build_object('duplicate',false,'progress',to_jsonb(r));
end; $$;

create function public.set_word_state(p_vocabulary_id uuid,p_status text default null,p_favorite boolean default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if p_status is not null and p_status not in ('new','mastered') then raise exception 'Invalid status'; end if;
 update public.user_vocabulary set favorite=coalesce(p_favorite,favorite),status=coalesce(p_status,status),
 next_review_at=case when p_status='new' then null when p_status='mastered' then now()+interval '30 days' else next_review_at end,
 repetitions=case when p_status='new' then 0 else repetitions end,
 interval_days=case when p_status='new' then 0 when p_status='mastered' then 30 else interval_days end,
 version=version+case when p_status is not null then 1 else 0 end,updated_at=now()
 where user_id=auth.uid() and vocabulary_id=p_vocabulary_id;
 if not found then raise exception 'Word not found'; end if;
end; $$;

create function public.import_vocabulary(p_rows jsonb,p_replace boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare item jsonb; inserted_count int:=0; replaced_count int:=0; skipped_count int:=0; existing_id uuid; u uuid:=auth.uid();
begin
 if u is null then raise exception 'Authentication required'; end if;
 if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows)>5000 then raise exception 'Import 1–5000 rows at a time'; end if;
 -- Serialize imports for an account to make duplicate handling deterministic.
 perform pg_advisory_xact_lock(hashtext(u::text));
 for item in select value from jsonb_array_elements(p_rows) loop
 if length(trim(coalesce(item->>'word','')))=0 then raise exception 'Every row needs a word'; end if;
 select id into existing_id from public.vocabulary where user_id=u and word=trim(item->>'word') and kana=trim(coalesce(item->>'kana',''));
 if existing_id is not null and not p_replace then skipped_count:=skipped_count+1; continue; end if;
 insert into public.vocabulary(user_id,word,kana,romaji,meaning_zh,meaning_en,jlpt_level,part_of_speech,example_sentence,example_kana,example_translation,notes,tags)
 values(u,trim(item->>'word'),trim(coalesce(item->>'kana','')),coalesce(item->>'romaji',''),coalesce(item->>'meaning_zh',''),coalesce(item->>'meaning_en',''),coalesce(nullif(item->>'jlpt_level',''),'N1'),coalesce(item->>'part_of_speech',''),coalesce(item->>'example_sentence',''),coalesce(item->>'example_kana',''),coalesce(item->>'example_translation',''),coalesce(item->>'notes',''),array(select jsonb_array_elements_text(coalesce(item->'tags','[]'::jsonb))))
 on conflict(user_id,word,kana) do update set romaji=excluded.romaji,meaning_zh=excluded.meaning_zh,meaning_en=excluded.meaning_en,jlpt_level=excluded.jlpt_level,part_of_speech=excluded.part_of_speech,example_sentence=excluded.example_sentence,example_kana=excluded.example_kana,example_translation=excluded.example_translation,notes=excluded.notes,tags=excluded.tags;
 if existing_id is null then inserted_count:=inserted_count+1; else replaced_count:=replaced_count+1; end if;
 end loop;
 return jsonb_build_object('inserted',inserted_count,'replaced',replaced_count,'skipped',skipped_count);
end; $$;

revoke all on function public.on_signup(),public.on_word_added(),public.validate_timezone(),public.submit_review(uuid,uuid,uuid,int,int,timestamptz,int),public.set_word_state(uuid,text,boolean),public.import_vocabulary(jsonb,boolean) from public,anon;
grant execute on function public.submit_review(uuid,uuid,uuid,int,int,timestamptz,int),public.set_word_state(uuid,text,boolean),public.import_vocabulary(jsonb,boolean) to authenticated;
-- Live refresh on other devices. Clients also refresh on focus and every 30 seconds.
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
 alter publication supabase_realtime add table public.user_vocabulary,public.vocabulary,public.user_settings,public.daily_statistics;
 end if;
end $$;
