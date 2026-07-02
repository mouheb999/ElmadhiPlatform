-- 007_search_triggers.sql
-- Maintain the search_vector tsvector for foods + recipes.

CREATE OR REPLACE FUNCTION foods_search_update() RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('simple', COALESCE(NEW.name_ar, '')), 'A') ||
    setweight(to_tsvector('french', COALESCE(NEW.name_fr, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.name_en, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(NEW.category, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER foods_search_trigger
  BEFORE INSERT OR UPDATE ON foods
  FOR EACH ROW EXECUTE FUNCTION foods_search_update();

CREATE OR REPLACE FUNCTION recipes_search_update() RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('simple', COALESCE(NEW.name_ar, '')), 'A') ||
    setweight(to_tsvector('french', COALESCE(NEW.name_fr, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.name_en, '')), 'A');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER recipes_search_trigger
  BEFORE INSERT OR UPDATE ON recipes
  FOR EACH ROW EXECUTE FUNCTION recipes_search_update();
