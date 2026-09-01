UPDATE users
SET role = 'admin'
WHERE role = 'super_admin' AND lower(email) != 'ahmad169qyp12q@gmail.com';

UPDATE users
SET role = 'super_admin', account_status = 'active', updated_at = datetime('now')
WHERE lower(email) = 'ahmad169qyp12q@gmail.com';
