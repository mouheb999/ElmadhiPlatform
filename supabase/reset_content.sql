-- Empty the content-library tables so you (or your partner) can fill them
-- manually from the admin panel, or via generated INSERTs from a data file.
--
-- This ONLY clears the reference libraries (foods, exercises). It does NOT
-- touch user accounts, profiles, payments, or generated plans.
--
-- Run this in the Supabase SQL editor. Safe to run more than once.
-- `search_vector` is trigger-maintained and will simply be empty again.

TRUNCATE TABLE public.foods RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.exercises RESTART IDENTITY CASCADE;
