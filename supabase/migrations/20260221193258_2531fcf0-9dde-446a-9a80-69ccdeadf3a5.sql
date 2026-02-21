-- Add webhook_url to client_cases for GHL automation
ALTER TABLE public.client_cases 
ADD COLUMN webhook_url text DEFAULT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.client_cases.webhook_url IS 'GHL webhook URL to notify when client completes evidence upload';