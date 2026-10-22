-- Restore the signup trigger: handle_new_user exists but no trigger fired it after the remix,
-- so new signups would not receive a profile or a client role.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();