-- 계약서 저장소 업로드 제한 (Supabase 대시보드 SQL Editor에서 schema.sql 다음에 실행)
-- 5MB 이하, 사진 · PDF만 허용
update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']
where id = 'contracts';
