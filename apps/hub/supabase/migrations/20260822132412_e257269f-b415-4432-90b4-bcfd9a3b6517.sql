REVOKE ALL ON FUNCTION public.prevent_role_escalation() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_profile_insert_role() FROM public, anon, authenticated;