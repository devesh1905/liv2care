-- The two report-storage helpers were granted to signed-in users but kept the default right for everyone to run them.
-- They only return true or false from the caller's own identity, so an anonymous call learned nothing, but the rule is
-- that anonymous users can call no function in public, and a test now enforces it.
revoke execute on function public.can_upload_report_path(text), public.can_read_report_file(text, uuid) from public, anon;
grant execute on function public.can_upload_report_path(text), public.can_read_report_file(text, uuid) to authenticated;
