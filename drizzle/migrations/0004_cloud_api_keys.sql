-- Each client pays API2Trade directly and saves their OWN API2Trade key here.
-- Row-level security is on with NO policies, so the browser can never read or write this table:
-- only server code using the service-role key can. Keys are never sent back to the page.
CREATE TABLE IF NOT EXISTS public.cloud_api_keys (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  api_key text NOT NULL CHECK (char_length(api_key) BETWEEN 16 AND 256),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cloud_api_keys ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cloud_api_keys FROM anon, authenticated;
