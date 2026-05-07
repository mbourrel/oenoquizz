-- =========================================
-- OenoQuizz — Migration Supabase
-- À exécuter dans l'éditeur SQL de Supabase
-- =========================================

-- 1. Table game_state (état global de la partie)
CREATE TABLE IF NOT EXISTS game_state (
  id integer PRIMARY KEY DEFAULT 1,
  status text NOT NULL DEFAULT 'setup'
  -- status: 'setup' | 'playing' | 'finished'
);
INSERT INTO game_state (id, status)
VALUES (1, 'setup')
ON CONFLICT (id) DO NOTHING;

-- 2. Colonnes supplémentaires pour game_config
ALTER TABLE game_config
  ADD COLUMN IF NOT EXISTS is_completed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS nom_bouteille text;

-- 3. Colonnes plates pour answers (remplace le champ data JSONB)
ALTER TABLE answers
  ADD COLUMN IF NOT EXISTS pays text,
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS appellation text,
  ADD COLUMN IF NOT EXISTS cepage text,
  ADD COLUMN IF NOT EXISTS millesime integer,
  ADD COLUMN IF NOT EXISTS commentaire text,
  ADD COLUMN IF NOT EXISTS score integer;

-- 3b. Millésime pour la bonne réponse (game_config)
ALTER TABLE game_config
  ADD COLUMN IF NOT EXISTS millesime integer;

-- 4. Activer Realtime sur toutes les tables utilisées
-- (à faire dans le dashboard Supabase : Database > Replication > Tables)
-- Tables concernées : game_config, game_state, players, answers
