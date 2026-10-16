import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider } from './context/AuthContext';

import { PublicLayout } from './components/layout/PublicLayout';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { RoleRoute } from './components/layout/RoleRoute';

import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { StudentDashboard } from './pages/student/StudentDashboard';
import { OfficerDashboard } from './pages/officer/OfficerDashboard';
import { RecruiterDashboard } from './pages/recruiter/RecruiterDashboard';
import { NotFoundPage } from './pages/NotFoundPage';

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              {/* Public Routes with Navbar and Footer */}
              <Route element={<PublicLayout />}>
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/404" element={<NotFoundPage />} />
              </Route>

              {/* Authenticated Dashboard Routes */}
              <Route element={<ProtectedRoute />}>
                <Route element={<DashboardLayout />}>
                  {/* Student Routes */}
                  <Route element={<RoleRoute allowedRoles={['student']} />}>
                    <Route path="/student/dashboard" element={<StudentDashboard />} />
                    <Route path="/student/evidence" element={<StudentDashboard />} />
                    <Route path="/student/skills" element={<StudentDashboard />} />
                    <Route path="/student/jobs" element={<StudentDashboard />} />
                  </Route>

                  {/* Placement Officer & Admin Routes */}
                  <Route element={<RoleRoute allowedRoles={['placement_officer', 'admin']} />}>
                    <Route path="/officer/dashboard" element={<OfficerDashboard />} />
                    <Route path="/officer/evidence-reviews" element={<OfficerDashboard />} />
                    <Route path="/officer/matching" element={<OfficerDashboard />} />
                    <Route path="/officer/jobs" element={<OfficerDashboard />} />
                    <Route path="/officer/students" element={<OfficerDashboard />} />
                  </Route>

                  {/* Recruiter Routes */}
                  <Route element={<RoleRoute allowedRoles={['recruiter', 'admin']} />}>
                    <Route path="/recruiter/dashboard" element={<RecruiterDashboard />} />
                    <Route path="/recruiter/jobs" element={<RecruiterDashboard />} />
                    <Route path="/recruiter/candidates" element={<RecruiterDashboard />} />
                  </Route>
                </Route>
              </Route>

              {/* Fallback Catch-all */}
              <Route path="*" element={<Navigate to="/404" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
};

export default App;
