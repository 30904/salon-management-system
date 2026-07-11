import AppRoutes from "./routes/index.jsx";
import { PermissionProvider } from "./context/PermissionContext.jsx";
import "./App.css";

export default function App() {
  return (
    <PermissionProvider>
      <AppRoutes />
    </PermissionProvider>
  );
}
