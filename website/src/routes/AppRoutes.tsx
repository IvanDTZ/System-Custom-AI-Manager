import { Navigate, Route, Routes } from 'react-router-dom'
import Login from '../pages/Login'
import PendingApproval from '../pages/PendingApproval'
import AuthCallback from '../pages/AuthCallback'
import ChatPage from '../pages/Chat'
import AdminDashboard from '../pages/AdminDashboard'
import AdminUsers from '../pages/AdminUsers'
import AdminModels from '../pages/AdminModels'
import AdminCategories from '../pages/AdminCategories'
import AdminChats from '../pages/AdminChats'
import { AdminLayout } from '../components/admin/AdminLayout'
import { ProtectedRoute } from '../auth/ProtectedRoute'

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/chat" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/auth/pending" element={<PendingApproval />} />
      <Route path="/auth/callback" element={<AuthCallback />} />

      <Route
        path="/chat"
        element={<ProtectedRoute><ChatPage /></ProtectedRoute>}
      />
      <Route
        path="/chat/:id"
        element={<ProtectedRoute><ChatPage /></ProtectedRoute>}
      />

      <Route
        path="/admin"
        element={
          <ProtectedRoute requireRoles={['ADMIN', 'SUPER_ADMIN']}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="models" element={<AdminModels />} />
        <Route path="categories" element={<AdminCategories />} />
        <Route path="chats" element={<AdminChats />} />
      </Route>

      <Route path="*" element={<Navigate to="/chat" replace />} />
    </Routes>
  )
}
