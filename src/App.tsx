import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import Login from "./pages/Login"
import Dashboard from "./pages/Dashboard"
import StravaCallback from "./pages/strava-callback"
import { useAuth } from "./hooks/useAuth"
import ActivityPage from "./pages/ActivityPage"

function App() {
  const { user, loading } = useAuth()
  if (loading) return null

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
        <Route path="/dashboard" element={user ? <Dashboard /> : <Navigate to="/" replace />} />
        <Route path="/activity/:id" element={<ActivityPage />} />
        <Route path="/strava-callback" element={<StravaCallback />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App