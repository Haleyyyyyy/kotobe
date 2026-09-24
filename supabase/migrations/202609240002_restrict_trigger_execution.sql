-- Supabase grants EXECUTE on new public functions to authenticated by default.
-- These trigger functions are invoked by PostgreSQL, not by the client API.
revoke execute on function public.on_signup(), public.on_word_added() from authenticated;
