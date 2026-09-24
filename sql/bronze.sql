-- Bronze layer: every line the recorder wrote, read straight from the JSONL
-- landing files. Run from the repo root (paths are relative to it).
--
-- GEP often sends payloads as JSON-encoded strings ("{\"inUse\":\"R-99\"}");
-- `payload` decodes those so silver views can use ->> directly, while `value`
-- keeps exactly what was received.

CREATE OR REPLACE VIEW bronze_lines AS
SELECT
    l.*,
    CASE
        WHEN json_type(l.value) = 'VARCHAR' AND json_valid(l.value ->> '$')
            THEN (l.value ->> '$')::JSON
        ELSE l.value
    END AS payload
FROM read_json(
    'recordings/*.jsonl',
    format = 'newline_delimited',
    columns = {
        schema: 'INTEGER',
        session_id: 'VARCHAR',
        seq: 'BIGINT',
        received_at: 'TIMESTAMPTZ',
        kind: 'VARCHAR',
        match_id: 'VARCHAR',
        feature: 'VARCHAR',
        category: 'VARCHAR',
        key: 'VARCHAR',
        value: 'JSON'
    },
    filename = true
) AS l;
