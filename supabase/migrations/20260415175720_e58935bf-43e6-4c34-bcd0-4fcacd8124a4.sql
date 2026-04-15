UPDATE public.office_config
SET ghl_api_key = (
  SELECT decrypted_secret
  FROM vault.decrypted_secrets
  WHERE name = 'MRVISA_API_KEY'
  LIMIT 1
)
WHERE account_id = '443d8719-94c7-47f9-9bef-3d911ba4c174'
  AND (ghl_api_key IS NULL OR ghl_api_key = '');