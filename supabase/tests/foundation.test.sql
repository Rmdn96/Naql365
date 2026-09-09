-- Reuse the exact transaction and assertions run by local integration tests.
\ir ../../tests/database/foundation.sql
begin;
select plan(1);
select pass('All shared foundation security and relational assertions passed on Supabase');
select * from finish();
rollback;
