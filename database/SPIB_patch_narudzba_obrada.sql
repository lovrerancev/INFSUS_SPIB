UPDATE narudzba
SET status = 'NOVA'
WHERE status NOT IN (
  'NOVA', 'POTVRDJENA', 'U_OBRADI', 'ZAVRSENA', 'OTKAZANA',
  'CEKA_ADMIN', 'NA_DORADI'
);

ALTER TABLE narudzba DROP CONSTRAINT IF EXISTS chk_narudzba_status;
ALTER TABLE narudzba ADD CONSTRAINT chk_narudzba_status
  CHECK (status IN (
    'NOVA', 'POTVRDJENA', 'U_OBRADI', 'ZAVRSENA', 'OTKAZANA',
    'CEKA_ADMIN', 'NA_DORADI'
  ));
