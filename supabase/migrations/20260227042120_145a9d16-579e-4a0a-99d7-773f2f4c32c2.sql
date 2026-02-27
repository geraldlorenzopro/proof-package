
UPDATE auth.users 
SET 
  email_change = COALESCE(email_change, ''),
  phone = COALESCE(phone, ''),
  phone_change = COALESCE(phone_change, '')
WHERE email = 'geraldlorenzopro@gmail.com';
