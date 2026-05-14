import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'

import LandingPage from './pages/public/LandingPage'
import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'

import PatientLayout from './pages/patient/PatientLayout'
import PatientDashboard from './pages/patient/PatientDashboard'
import SearchDoctors from './pages/patient/SearchDoctors'
import DoctorProfile from './pages/patient/DoctorProfile'
import BookAppointment from './pages/patient/BookAppointment'
import MyAppointments from './pages/patient/MyAppointments'
import Reschedule from './pages/patient/Reschedule'
import PatientProfile from './pages/patient/PatientProfile'
import MoodHistory from './pages/patient/MoodHistory'
import HomeworkPage from './pages/patient/HomeworkPage'
import QuestionnairesPage from './pages/patient/QuestionnairesPage'

import DoctorLayout from './pages/doctor/DoctorLayout'
import DoctorDashboard from './pages/doctor/DoctorDashboard'
import DoctorSchedule from './pages/doctor/DoctorSchedule'
import DoctorAvailability from './pages/doctor/DoctorAvailability'
import DoctorOwnProfile from './pages/doctor/DoctorOwnProfile'
import DoctorPatientsList from './pages/doctor/DoctorPatientsList'
import DoctorTutorsList from './pages/doctor/DoctorTutorsList'

import AdminLayout from './pages/admin/AdminLayout'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminUsers from './pages/admin/AdminUsers'
import AdminDoctors from './pages/admin/AdminDoctors'
import AdminReceptionists from './pages/admin/AdminReceptionists'
import AdminAppointments from './pages/admin/AdminAppointments'
import AdminSpecialties from './pages/admin/AdminSpecialties'

import ReceptionLayout from './pages/reception/ReceptionLayout'
import ReceptionDashboard from './pages/reception/ReceptionDashboard'
import ReceptionAppointments from './pages/reception/ReceptionAppointments'
import ReceptionBook from './pages/reception/ReceptionBook'
import ReceptionPatients from './pages/reception/ReceptionPatients'

import MeetingRoom from './pages/teleconsulta/MeetingRoom'
import PatientFullProfile from './pages/shared/PatientFullProfile'
import ChatWidget from './components/ChatWidget'

import TutorLayout from './pages/tutor/TutorLayout'
import TutorDashboard from './pages/tutor/TutorDashboard'

import CompanyLayout from './pages/company/CompanyLayout'
import CompanyDashboard from './pages/company/CompanyDashboard'
import AdminCompanies from './pages/admin/AdminCompanies'

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="w-9 h-9 rounded-full border-[3px] border-ink-200 border-t-brand-600 animate-spin" /></div>
  if (!user) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />
  return children
}

function RootEntry() {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="w-9 h-9 rounded-full border-[3px] border-ink-200 border-t-brand-600 animate-spin" /></div>
  if (!user) return <LandingPage />
  if (user.role === 'admin')         return <Navigate to="/admin" replace />
  if (user.role === 'doctor')        return <Navigate to="/doctor" replace />
  if (user.role === 'receptionist')  return <Navigate to="/reception" replace />
  if (user.role === 'tutor')         return <Navigate to="/tutor" replace />
  if (user.role === 'company_admin') return <Navigate to="/company" replace />
  return <Navigate to="/patient" replace />
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<RootEntry />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route path="/teleconsulta/:id" element={
          <ProtectedRoute>
            <MeetingRoom />
          </ProtectedRoute>
        } />

        <Route path="/patient" element={
          <ProtectedRoute roles={['patient', 'admin']}>
            <PatientLayout />
          </ProtectedRoute>
        }>
          <Route index element={<PatientDashboard />} />
          <Route path="search" element={<SearchDoctors />} />
          <Route path="doctors/:id" element={<DoctorProfile />} />
          <Route path="book/:doctorId" element={<BookAppointment />} />
          <Route path="reschedule/:id" element={<Reschedule />} />
          <Route path="appointments" element={<MyAppointments />} />
          <Route path="mood" element={<MoodHistory />} />
          <Route path="homework" element={<HomeworkPage />} />
          <Route path="questionnaires" element={<QuestionnairesPage />} />
          <Route path="questionnaires/:id" element={<QuestionnairesPage />} />
          <Route path="profile" element={<PatientProfile />} />
        </Route>

        <Route path="/doctor" element={
          <ProtectedRoute roles={['doctor', 'admin']}>
            <DoctorLayout />
          </ProtectedRoute>
        }>
          <Route index element={<DoctorDashboard />} />
          <Route path="schedule" element={<DoctorSchedule />} />
          <Route path="patients" element={<DoctorPatientsList />} />
          <Route path="tutors" element={<DoctorTutorsList />} />
          <Route path="availability" element={<DoctorAvailability />} />
          <Route path="profile" element={<DoctorOwnProfile />} />
          <Route path="patients/:id" element={<PatientFullProfile />} />
        </Route>

        <Route path="/admin" element={
          <ProtectedRoute roles={['admin']}>
            <AdminLayout />
          </ProtectedRoute>
        }>
          <Route index element={<AdminDashboard />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="doctors" element={<AdminDoctors />} />
          <Route path="receptionists" element={<AdminReceptionists />} />
          <Route path="appointments" element={<AdminAppointments />} />
          <Route path="specialties" element={<AdminSpecialties />} />
          <Route path="companies" element={<AdminCompanies />} />
          <Route path="patients/:id" element={<PatientFullProfile />} />
        </Route>

        <Route path="/reception" element={
          <ProtectedRoute roles={['receptionist', 'admin']}>
            <ReceptionLayout />
          </ProtectedRoute>
        }>
          <Route index element={<ReceptionDashboard />} />
          <Route path="book" element={<ReceptionBook />} />
          <Route path="appointments" element={<ReceptionAppointments />} />
          <Route path="patients" element={<ReceptionPatients />} />
          <Route path="patients/:id" element={<PatientFullProfile />} />
        </Route>

        <Route path="/tutor" element={
          <ProtectedRoute roles={['tutor', 'admin']}>
            <TutorLayout />
          </ProtectedRoute>
        }>
          <Route index element={<TutorDashboard />} />
          <Route path="patients/:id" element={<PatientFullProfile />} />
        </Route>

        <Route path="/company" element={
          <ProtectedRoute roles={['company_admin', 'admin']}>
            <CompanyLayout />
          </ProtectedRoute>
        }>
          <Route index element={<CompanyDashboard />} />
        </Route>
      </Routes>
      <ChatWidget />
    </AuthProvider>
  )
}
