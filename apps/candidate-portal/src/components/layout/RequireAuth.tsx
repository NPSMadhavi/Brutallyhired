import { Navigate, Outlet, useLocation, useParams } from "react-router-dom";
import { useMe } from "@/api/hooks";
import { PageLoader } from "@/components/ui/feedback";

export function RequireAuth() {
  const me = useMe();
  const { tenant = "" } = useParams();
  const loc = useLocation();
  if (me.isPending) return <PageLoader />;
  if (!me.data) {
    const returnTo = `${loc.pathname}${loc.search}`;
    return <Navigate to={`/${tenant}/signin?${new URLSearchParams({ returnTo })}`} replace />;
  }
  return <Outlet />;
}
