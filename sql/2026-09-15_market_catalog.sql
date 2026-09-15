-- ============================================================================
-- Catalogue marché mondial — couche GitHub-first (free-ticker-database)
--
-- Deux tables :
--   market_catalog_imports  : une ligne par exécution du script d'import
--                              (scripts/import-catalog.js), pour tracer la
--                              provenance et l'horodatage du lot entier.
--   market_catalog_listings : une ligne par instrument importé.
--
-- Aucune donnée de marché (prix, variation, score...) n'est stockée ici :
-- uniquement de l'identité (ticker, nom, ISIN, place, secteur). Les prix
-- restent exclusivement obtenus en direct via api/market/quotes.js et
-- api/market/company.js, jamais depuis cette table.
--
-- Sécurité : RLS activée, AUCUNE policy définie. Seule la clé
-- SUPABASE_SERVICE_ROLE_KEY (qui contourne RLS) peut lire/écrire ces tables,
-- exactement comme pour `profiles`/`ai_usage`. La clé anon publique n'a
-- aucun accès.
--
-- À exécuter une fois, manuellement, dans l'éditeur SQL Supabase.
-- Idempotent (IF NOT EXISTS partout) : peut être rejoué sans risque.
-- ============================================================================

create table if not exists market_catalog_imports (
  id uuid primary key default gen_random_uuid(),

  source text not null,
  source_url text not null,

  started_at timestamptz not null default now(),
  finished_at timestamptz,

  status text not null default 'running'
    check (status in ('running', 'ok', 'failed')),

  rows_read integer,
  rows_upserted integer,
  rows_skipped integer,

  error_message text,

  -- Diagnostic : { "ADX": 86, "SET": 773, ... } — places du dataset sans
  -- correspondance vérifiée vers un code NovaBourse (exchange_code = null).
  -- Sert à faire grandir le crosswalk (api/market/_exchangeCrosswalk.js)
  -- au fur et à mesure que de nouveaux fournisseurs sont vérifiés.
  unmapped_exchanges jsonb
);

create table if not exists market_catalog_listings (
  -- Clé stable telle que fournie par le dataset source (ex. "NASDAQ::AAPL",
  -- "Euronext::MC"). Jamais le ticker seul : voir le cas réel MC (LVMH sur
  -- Euronext, Moelis & Co sur NYSE, MC Group sur SET) confirmé lors de
  -- l'analyse de ce dataset.
  listing_key text primary key,

  ticker text not null,
  name text not null,

  -- 'stock' | 'etf' — normalisé depuis asset_type ('Stock'/'ETF' dans le
  -- dataset source, seules valeurs présentes à ce jour).
  asset_type text not null,

  -- Valeur brute du dataset (ex. "Euronext", "XETRA", "ADX").
  exchange_raw text not null,

  -- Code canonique NovaBourse (ex. "PA", "NASDAQ", "DE"), tel qu'utilisé par
  -- api/market/_providers.js (SUFFIX/TD_EXCHANGE). NULL explicite si la
  -- place n'a pas de correspondance vérifiée — l'instrument reste
  -- identifiable mais n'aura pas de cotation en direct tant qu'aucun
  -- fournisseur confirmé ne le couvre.
  exchange_code text,

  stock_sector text,
  etf_category text,

  country text,
  country_code text,

  isin text,
  aliases text,

  instrument_group_key text,
  scope_reason text,

  source text not null default 'free-ticker-database',
  source_url text not null,

  import_batch_id uuid references market_catalog_imports(id),

  -- Horodatage réel de récupération (pas une date de marché) : distingue
  -- une donnée de référence (REFERENCE) d'une cotation (LIVE/END_OF_DAY).
  retrieved_at timestamptz not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists market_catalog_listings_ticker_idx
  on market_catalog_listings (upper(ticker));

create index if not exists market_catalog_listings_isin_idx
  on market_catalog_listings (isin);

create index if not exists market_catalog_listings_name_idx
  on market_catalog_listings (lower(name));

create index if not exists market_catalog_listings_exchange_code_idx
  on market_catalog_listings (exchange_code);

alter table market_catalog_imports enable row level security;
alter table market_catalog_listings enable row level security;
-- Volontairement aucune policy : par défaut, RLS activée + aucune policy =
-- accès refusé à tout le monde SAUF la clé service_role, qui contourne RLS.
-- Ces tables ne sont jamais lues via la clé anon depuis le frontend.
