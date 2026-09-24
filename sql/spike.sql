-- Exploration queries for the recorder spike (DESIGN.md §7).
-- Usage: load bronze.sql first, then run these one by one.

-- Sessions and matches recorded
SELECT session_id, count(*) AS lines, count(DISTINCT match_id) AS matches,
       min(received_at) AS started, max(received_at) AS ended
FROM bronze_lines GROUP BY ALL ORDER BY started;

-- What each feature sends, and how often (Q2, Q3)
SELECT kind, feature, category, key, count(*) AS n, any_value(value) AS example
FROM bronze_lines WHERE kind IN ('event', 'info')
GROUP BY ALL ORDER BY feature, key;

-- Q1: how is ranked labelled?
SELECT match_id, key, value
FROM bronze_lines
WHERE category = 'match_info' AND key IN ('game_mode', 'mode_name', 'map_name')
ORDER BY match_id, key;

-- Phase timeline per session
SELECT session_id, received_at, match_id, value AS phase
FROM bronze_lines WHERE category = 'game_info' AND key = 'phase'
ORDER BY session_id, seq;

-- Q3: weapon in use vs damage events, in order, for one match
-- (replace the id with one from the first query)
SELECT seq, received_at, feature, key, value
FROM bronze_lines
WHERE match_id = '<match id>' AND (feature IN ('damage', 'kill_feed') OR key = 'inUse')
ORDER BY seq;

-- Q7/Q8: RP snapshots and ranked stats snapshots over time
SELECT received_at, key AS trigger, value ->> 'player_name' AS player,
       value -> 'body' -> 'global' -> 'rank' AS rank, value ->> 'error' AS error
FROM bronze_lines WHERE kind = 'rp_snapshot' ORDER BY received_at;

SELECT received_at, match_id, value
FROM bronze_lines WHERE key = 'player_stats_br_ranked_latest' ORDER BY seq;

-- Recorder health: GEP errors and lifecycle
SELECT received_at, key, value FROM bronze_lines WHERE kind = 'lifecycle' ORDER BY seq;
