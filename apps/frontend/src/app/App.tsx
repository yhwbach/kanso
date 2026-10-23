import { Navigate, Route, Routes } from "react-router-dom";
import { LandingPage } from "@/features/landing/LandingPage";
import { AppShell } from "@/features/shell/AppShell";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/app/*" element={<AppShell />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
