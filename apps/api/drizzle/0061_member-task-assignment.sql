-- Upgrade only the unchanged, serialized member payload written by the old
-- default-role seed. Preserve administrator-edited permissions and custom roles.
UPDATE "workspace_role"
SET "permission" = '{"organization":[],"member":[],"invitation":[],"team":[],"ac":["read"],"project":["create","read"],"task":["create","read","update","assign"],"label":["create","read","update","delete"],"workspace":["read"]}',
    "updated_at" = now()
WHERE "role" = 'member'
  AND "permission" = '{"organization":[],"member":[],"invitation":[],"team":[],"ac":["read"],"project":["create","read"],"task":["create","read","update"],"label":["create","read","update","delete"],"workspace":["read"]}';
