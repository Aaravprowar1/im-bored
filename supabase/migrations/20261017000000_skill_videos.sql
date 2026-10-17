-- im bored. — YouTube tutorials for skill activities
--
-- Activities that teach a skill carry a short YouTube search. The app uses it
-- to show the most-viewed relevant tutorial (or, without a YouTube API key, a
-- link to YouTube's results sorted by view count). Re-run supabase/seed.sql
-- (or npm run db:seed) after this migration to fill it in for seed activities.

alter table public.activities
  add column video_query text check (video_query is null or char_length(btrim(video_query)) between 3 and 120);
