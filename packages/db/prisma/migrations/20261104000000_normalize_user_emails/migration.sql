-- Normalise stored emails to trim + lower-case (packages/api/src/validators/email.ts).
-- Login and lookups now normalise their input, so un-normalised rows
-- would become unreachable.
--
-- If two accounts differ only by case/whitespace this fails on
-- users_email_key, which is intended: merge or rename those accounts by
-- hand, then re-run. Find them with:
--   SELECT lower(trim(email)), array_agg(id) FROM users
--   GROUP BY 1 HAVING count(*) > 1;
UPDATE "users"
SET "email" = lower(trim("email"))
WHERE "email" <> lower(trim("email"));
