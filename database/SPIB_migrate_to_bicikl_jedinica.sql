
BEGIN;


CREATE TABLE IF NOT EXISTS bicikl_jedinica (
    jedinica_id SERIAL PRIMARY KEY,
    bicikl_id INT NOT NULL
        REFERENCES bicikl(bicikl_id)
        ON DELETE CASCADE,
    inventarni_broj VARCHAR(64) NOT NULL,
    status VARCHAR(30) NOT NULL
        CONSTRAINT chk_jedinica_status
        CHECK (status IN ('DOSTUPAN', 'IZNAJMLJEN', 'PRODAN', 'U_SERVISU', 'NEDOSTUPAN')),
    CONSTRAINT uq_jedinica_inventarni UNIQUE (inventarni_broj)
);

CREATE INDEX IF NOT EXISTS idx_jedinica_bicikl ON bicikl_jedinica (bicikl_id);
CREATE INDEX IF NOT EXISTS idx_jedinica_status ON bicikl_jedinica (status);

COMMENT ON TABLE bicikl_jedinica IS 'Pojedinačna skladišna jedinica (inventar, status).';


DO $$
DECLARE
  has_kolicina boolean;
  has_status boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bicikl' AND column_name = 'kolicina'
  ) INTO has_kolicina;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bicikl' AND column_name = 'status'
  ) INTO has_status;

  IF has_kolicina
     OR has_status
     OR EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'bicikl' AND column_name = 'inventarni_broj'
     ) THEN
    INSERT INTO bicikl_jedinica (bicikl_id, inventarni_broj, status)
    SELECT
      b.bicikl_id,
      'MIG-' || b.bicikl_id::text || '-' || gs::text,
      CASE
        WHEN has_status AND b.status::text IN ('DOSTUPAN', 'IZNAJMLJEN', 'PRODAN', 'U_SERVISU', 'NEDOSTUPAN')
          THEN b.status::text
        ELSE 'DOSTUPAN'
      END
    FROM bicikl b
    CROSS JOIN LATERAL (
      SELECT GREATEST(
        CASE WHEN has_kolicina THEN COALESCE(b.kolicina, 1) ELSE 1 END,
        1
      ) AS max_n
    ) mx
    CROSS JOIN LATERAL generate_series(
      (SELECT count(*)::int FROM bicikl_jedinica j WHERE j.bicikl_id = b.bicikl_id) + 1,
      mx.max_n
    ) AS gs
    WHERE mx.max_n > (SELECT count(*)::int FROM bicikl_jedinica j WHERE j.bicikl_id = b.bicikl_id);
  ELSIF NOT EXISTS (SELECT 1 FROM bicikl_jedinica LIMIT 1) THEN
    INSERT INTO bicikl_jedinica (bicikl_id, inventarni_broj, status)
    SELECT b.bicikl_id, 'MIG-SOLO-' || b.bicikl_id::text, 'DOSTUPAN'
    FROM bicikl b;
  END IF;
END $$;


UPDATE bicikl_jedinica j
SET inventarni_broj = 'JB-' || lpad(j.jedinica_id::text, 6, '0');


INSERT INTO bicikl_jedinica (bicikl_id, inventarni_broj, status)
SELECT v.bicikl_id, 'MIG-X-' || v.bicikl_id::text || '-' || gs::text, 'DOSTUPAN'
FROM (
  SELECT sn.bicikl_id,
         SUM(sn.kolicina)::int AS st_sum,
         COALESCE(j.j_cnt, 0) AS j_cnt
  FROM stavkanarudzbe sn
  LEFT JOIN (SELECT bicikl_id, COUNT(*)::int AS j_cnt FROM bicikl_jedinica GROUP BY bicikl_id) j ON j.bicikl_id = sn.bicikl_id
  GROUP BY sn.bicikl_id, j.j_cnt
) v
CROSS JOIN LATERAL generate_series(1, GREATEST(0, v.st_sum - v.j_cnt)) AS gs
WHERE EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = 'stavkanarudzbe' AND c.column_name = 'bicikl_id'
  )
  AND GREATEST(0, v.st_sum - v.j_cnt) > 0;

UPDATE bicikl_jedinica j
SET inventarni_broj = 'JB-' || lpad(j.jedinica_id::text, 6, '0');


DO $$
DECLARE
  has_bicikl_on_stavka boolean;
  has_jedinica_on_stavka boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'stavkanarudzbe' AND column_name = 'bicikl_id'
  ) INTO has_bicikl_on_stavka;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'stavkanarudzbe' AND column_name = 'jedinica_id'
  ) INTO has_jedinica_on_stavka;

  IF has_bicikl_on_stavka AND NOT has_jedinica_on_stavka THEN
    ALTER TABLE stavkanarudzbe ADD COLUMN jedinica_id INT;
  END IF;

  IF has_bicikl_on_stavka THEN
    INSERT INTO stavkanarudzbe (kolicina, cijena, bicikl_id, narudzba_id)
    SELECT 1, sn.cijena, sn.bicikl_id, sn.narudzba_id
    FROM stavkanarudzbe sn
    CROSS JOIN LATERAL generate_series(2, sn.kolicina) AS gs
    WHERE sn.kolicina > 1;

    UPDATE stavkanarudzbe SET kolicina = 1 WHERE kolicina > 1;

    UPDATE stavkanarudzbe sn
    SET jedinica_id = x.jedinica_id
    FROM (
      WITH ranked_stavke AS (
        SELECT stavka_id,
               bicikl_id,
               row_number() OVER (PARTITION BY bicikl_id ORDER BY stavka_id) AS rn
        FROM stavkanarudzbe
        WHERE jedinica_id IS NULL AND bicikl_id IS NOT NULL
      ),
      ranked_jed AS (
        SELECT jedinica_id,
               bicikl_id,
               row_number() OVER (PARTITION BY bicikl_id ORDER BY jedinica_id) AS rn
        FROM bicikl_jedinica
      )
      SELECT rs.stavka_id, j.jedinica_id
      FROM ranked_stavke rs
      JOIN ranked_jed j ON j.bicikl_id = rs.bicikl_id AND j.rn = rs.rn
    ) x
    WHERE sn.stavka_id = x.stavka_id;

    IF EXISTS (SELECT 1 FROM stavkanarudzbe WHERE jedinica_id IS NULL) THEN
      RAISE EXCEPTION
        'Migracija stavki nije uspjela (nedovoljno jedinica po bicikl_id ili neusklađeni podaci).';
    END IF;

    ALTER TABLE stavkanarudzbe ALTER COLUMN jedinica_id SET NOT NULL;

    ALTER TABLE stavkanarudzbe DROP CONSTRAINT IF EXISTS stavkanarudzbe_bicikl_id_fkey;
    ALTER TABLE stavkanarudzbe DROP CONSTRAINT IF EXISTS fk_stavka_bicikl;
    ALTER TABLE stavkanarudzbe DROP COLUMN bicikl_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'stavkanarudzbe'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'jedinica_id'
  ) THEN
    ALTER TABLE stavkanarudzbe DROP CONSTRAINT IF EXISTS fk_stavka_jedinica;
    ALTER TABLE stavkanarudzbe
      ADD CONSTRAINT fk_stavka_jedinica
      FOREIGN KEY (jedinica_id) REFERENCES bicikl_jedinica(jedinica_id) ON DELETE RESTRICT;
  END IF;
END $$;


DO $$
DECLARE
  has_bicikl_on_najam boolean;
  has_jedinica_on_najam boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'najam' AND column_name = 'bicikl_id'
  ) INTO has_bicikl_on_najam;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'najam' AND column_name = 'jedinica_id'
  ) INTO has_jedinica_on_najam;

  IF has_bicikl_on_najam AND NOT has_jedinica_on_najam THEN
    ALTER TABLE najam ADD COLUMN jedinica_id INT;
  END IF;

  IF has_bicikl_on_najam THEN
    UPDATE najam n
    SET jedinica_id = sub.jedinica_id
    FROM (
      SELECT n2.najam_id,
             (SELECT min(j.jedinica_id) FROM bicikl_jedinica j WHERE j.bicikl_id = n2.bicikl_id) AS jedinica_id
      FROM najam n2
      WHERE n2.jedinica_id IS NULL
    ) sub
    WHERE n.najam_id = sub.najam_id;

    IF EXISTS (SELECT 1 FROM najam WHERE jedinica_id IS NULL) THEN
      RAISE EXCEPTION 'Migracija najma: nema jedinice za neki bicikl_id.';
    END IF;

    ALTER TABLE najam ALTER COLUMN jedinica_id SET NOT NULL;

    ALTER TABLE najam DROP CONSTRAINT IF EXISTS najam_bicikl_id_fkey;
    ALTER TABLE najam DROP CONSTRAINT IF EXISTS fk_najam_bicikl;
    ALTER TABLE najam DROP COLUMN bicikl_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'najam'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'jedinica_id'
  ) THEN
    ALTER TABLE najam DROP CONSTRAINT IF EXISTS fk_najam_jedinica;
    ALTER TABLE najam
      ADD CONSTRAINT fk_najam_jedinica
      FOREIGN KEY (jedinica_id) REFERENCES bicikl_jedinica(jedinica_id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_stavka_jedinica ON stavkanarudzbe (jedinica_id);
CREATE INDEX IF NOT EXISTS idx_najam_jedinica ON najam (jedinica_id);


ALTER TABLE bicikl DROP COLUMN IF EXISTS kolicina;
ALTER TABLE bicikl DROP COLUMN IF EXISTS status;
ALTER TABLE bicikl DROP COLUMN IF EXISTS inventarni_broj;

COMMIT;
