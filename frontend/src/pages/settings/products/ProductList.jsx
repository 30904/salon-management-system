import { Navigate } from "react-router-dom";

export default function ProductList() {
  return <Navigate to="/inventory?tab=products" replace />;
}
