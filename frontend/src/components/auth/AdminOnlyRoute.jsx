import { Navigate } from "react-router-dom";
import { useWallet } from "@provablehq/aleo-wallet-adaptor-react";
import { isPlatformOwner } from "@/services/aleoServiceV2";

export default function AdminOnlyRoute({ children }) {
  const { address } = useWallet();

  if (!address || !isPlatformOwner(address)) {
    return <Navigate to="/standard" replace />;
  }

  return children;
}
