import { Navigate, useParams } from "react-router-dom";

export default function ProductForm() {
  const { id } = useParams();
  const target = id
    ? `/inventory?tab=products&editId=${encodeURIComponent(id)}`
    : `/inventory?tab=products&action=new`;

  return <Navigate to={target} replace />;
}
