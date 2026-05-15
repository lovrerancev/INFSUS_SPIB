

ALTER TABLE bicikl ADD COLUMN IF NOT EXISTS inventarni_broj VARCHAR(64);

UPDATE bicikl SET inventarni_broj = 'JB-' || lpad(bicikl_id::text, 6, '0') WHERE inventarni_broj IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_bicikl_inventarni_broj ON bicikl (inventarni_broj);

ALTER TABLE bicikl ALTER COLUMN inventarni_broj SET NOT NULL;
