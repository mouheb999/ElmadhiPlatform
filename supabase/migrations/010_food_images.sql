-- 010_food_images.sql
-- Image support for content tables + public storage buckets.

-- Foods get an image; exercises already have thumbnail_url/video_url.
ALTER TABLE foods
  ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Public buckets for admin-uploaded content images. Uploads are performed by
-- the service-role client (bypasses storage RLS) after a server-side is_admin
-- check; public = TRUE lets the app render the images via getPublicUrl.
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('food-images', 'food-images', TRUE),
  ('exercise-images', 'exercise-images', TRUE)
ON CONFLICT (id) DO NOTHING;
