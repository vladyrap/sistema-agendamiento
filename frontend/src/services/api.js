import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export const authApi = {
  login:    (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  me:       ()     => api.get('/auth/me'),
  updateMe: (data) => api.put('/auth/me', data),
}

export const chatApi = {
  status:  ()                 => api.get('/chat/status'),
  send:    (message, history) => api.post('/chat/message', { message, history }),
}

export const tutorsApi = {
  // Gestión de tutores
  add:           (patientId, data)         => api.post(`/tutors/patient/${patientId}`, data),
  update:        (tutorId, data)           => api.patch(`/tutors/${tutorId}`, data),
  remove:        (tutorId)                 => api.delete(`/tutors/${tutorId}`),
  listForPatient:(patientId)               => api.get(`/tutors/patient/${patientId}`),
  alert:         (tutorId, message)        => api.post(`/tutors/${tutorId}/alert`, { message }),
  // Portal tutor
  myPatients:    ()                        => api.get('/tutors/me/patients'),
  // Doctor cruzada
  doctorTutors:  ()                        => api.get('/tutors/doctor/me'),
  // Buscar usuarios tutores ya registrados (autocompletar)
  searchUsers:   (q)                       => api.get('/tutors/search-users', { params: { q } }),
}

export const myPatientsApi = {
  forDoctor:     ()                        => api.get('/patients/doctor/me'),
}

export const companiesApi = {
  // Admin
  list:        ()                     => api.get('/companies/'),
  get:         (id)                   => api.get(`/companies/${id}`),
  create:      (data)                 => api.post('/companies/', data),
  update:      (id, data)             => api.patch(`/companies/${id}`, data),
  remove:      (id)                   => api.delete(`/companies/${id}`),
  topup:       (id, sessions, note)   => api.post(`/companies/${id}/topup`, { sessions, note }),
  assignAdmin: (id, admin_email)      => api.post(`/companies/${id}/assign-admin`, { admin_email }),
  members:     (id)                   => api.get(`/companies/${id}/members`),
  addMember:   (id, patient_email)    => api.post(`/companies/${id}/members`, { patient_email }),
  removeMember:(membershipId)         => api.delete(`/companies/memberships/${membershipId}`),
  // Patient
  myBenefit:   ()                     => api.get('/companies/me/benefit'),
  // Company admin portal
  myStats:     ()                     => api.get('/companies/me/stats'),
  myUsage:     (days = 60, anonymized = true) => api.get('/companies/me/usage', { params: { days, anonymized } }),
  myMembers:   ()                     => api.get('/companies/me/members'),
}

export const questionnairesApi = {
  list:          ()                                    => api.get('/questionnaires/'),
  get:           (code)                                => api.get(`/questionnaires/${code}`),
  // Asignaciones
  assign:        (data)                                => api.post('/questionnaires/assignments', data),
  remove:        (id)                                  => api.delete(`/questionnaires/assignments/${id}`),
  getAssignment: (id)                                  => api.get(`/questionnaires/assignments/${id}`),
  submit:        (id, answers, comment = '')           => api.post(`/questionnaires/assignments/${id}/submit`, { answers, patient_comment: comment }),
  mine:          (status)                              => api.get('/questionnaires/assignments/me', { params: { status } }),
  forPatient:    (patientId, status, code)             => api.get(`/questionnaires/assignments/patient/${patientId}`, { params: { status, code } }),
  history:       (patientId, code)                     => api.get(`/questionnaires/assignments/patient/${patientId}/history/${code}`),
  doctorRecent:  (days = 30)                           => api.get('/questionnaires/assignments/doctor/recent', { params: { days } }),
}

export const homeworkApi = {
  // doctor
  create:        (data)                  => api.post('/homework/', data),
  update:        (id, data)              => api.patch(`/homework/${id}`, data),
  remove:        (id)                    => api.delete(`/homework/${id}`),
  doctorRecent:  (days = 30)             => api.get('/homework/doctor/recent', { params: { days } }),
  byPatient:     (patientId, status)     => api.get(`/homework/patient/${patientId}`, { params: { status } }),
  // paciente
  mine:          (status)                => api.get('/homework/me', { params: { status } }),
  myStats:       ()                      => api.get('/homework/me/stats'),
  complete:      (id, patient_feedback)  => api.patch(`/homework/${id}/complete`, { patient_feedback }),
  uncomplete:    (id)                    => api.patch(`/homework/${id}/uncomplete`),
}

export const moodApi = {
  // paciente
  checkIn:     (data)               => api.post('/mood/', data),
  myEntries:   (days = 90)          => api.get('/mood/me', { params: { days } }),
  mySummary:   ()                   => api.get('/mood/me/summary'),
  myToday:     ()                   => api.get('/mood/me/today'),
  delete:      (id)                 => api.delete(`/mood/${id}`),
  // doctor / admin
  patientEntries: (patientId, days = 90) => api.get(`/mood/patient/${patientId}`, { params: { days } }),
  patientSummary: (patientId)            => api.get(`/mood/patient/${patientId}/summary`),
  // doctor feed
  doctorFeed:     (days = 7)             => api.get('/mood/doctor/feed', { params: { days } }),
}

export const specialtiesApi = {
  list:    ()         => api.get('/specialties/'),
  get:     (id)       => api.get(`/specialties/${id}`),
  create:  (data)     => api.post('/specialties/', data),
  update:  (id, data) => api.put(`/specialties/${id}`, data),
  remove:  (id)       => api.delete(`/specialties/${id}`),
}

export const clinicsApi = {
  list:   ()         => api.get('/clinics/'),
  create: (data)     => api.post('/clinics/', data),
  update: (id, data) => api.put(`/clinics/${id}`, data),
}

export const doctorsApi = {
  list:               (params)   => api.get('/doctors/', { params }),
  me:                 ()         => api.get('/doctors/me'),
  get:                (id)       => api.get(`/doctors/${id}`),
  create:             (data)     => api.post('/doctors/', data),
  update:             (id, data) => api.put(`/doctors/${id}`, data),
  getAvailability:    (id)       => api.get(`/doctors/${id}/availability`),
  setAvailability:    (id, data) => api.post(`/doctors/${id}/availability`, data),
  getAvailableSlots:  (id, date) => api.get(`/doctors/${id}/available-slots`, { params: { date } }),
}

export const appointmentsApi = {
  create:     (data)         => api.post('/appointments/', data),
  list:       (params)       => api.get('/appointments/', { params }),
  get:        (id)           => api.get(`/appointments/${id}`),
  cancel:     (id, data)     => api.put(`/appointments/${id}/cancel`, data),
  confirm:    (id)           => api.put(`/appointments/${id}/confirm`),
  complete:   (id, notes)    => api.put(`/appointments/${id}/complete`, null, { params: { notes } }),
  reschedule: (id, data)     => api.put(`/appointments/${id}/reschedule`, data),
  meeting:    (id)           => api.get(`/appointments/${id}/meeting`),
  icsUrl:     (id)           => `/api/appointments/${id}/calendar.ics`,
  cancelDay:  (data)         => api.post('/appointments/cancel-day', data),
}

export const doctorBlocksApi = {
  list:    ()      => api.get('/doctor-blocks/me'),
  create:  (data)  => api.post('/doctor-blocks/me', data),
  remove:  (id)    => api.delete(`/doctor-blocks/me/${id}`),
}

export const waitlistApi = {
  join:   (data)   => api.post('/waitlist/', data),
  mine:   ()       => api.get('/waitlist/me'),
  leave:  (id)     => api.delete(`/waitlist/${id}`),
}

export const attachmentsApi = {
  uploadMine: (file, { category, note, appointment_id } = {}) => {
    const fd = new FormData()
    fd.append('file', file)
    if (category)       fd.append('category', category)
    if (note)           fd.append('note', note)
    if (appointment_id) fd.append('appointment_id', appointment_id)
    return api.post('/me/attachments', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  uploadFor: (patientId, file, { category, note, appointment_id } = {}) => {
    const fd = new FormData()
    fd.append('file', file)
    if (category)       fd.append('category', category)
    if (note)           fd.append('note', note)
    if (appointment_id) fd.append('appointment_id', appointment_id)
    return api.post(`/patients/${patientId}/attachments`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  listMine:    ()           => api.get('/me/attachments'),
  listFor:     (patientId)  => api.get(`/patients/${patientId}/attachments`),
  downloadBlob:(id)         => api.get(`/attachments/${id}/download`, { responseType: 'blob' }),
  remove:      (id)         => api.delete(`/attachments/${id}`),
}

export const medicalRecordApi = {
  mine:        ()             => api.get('/me/medical-record'),
  updateMine:  (data)         => api.put('/me/medical-record', data),
  forPatient:  (patientId)    => api.get(`/patients/${patientId}/medical-record`),
}

export const patientNotesApi = {
  get:   (patientId)        => api.get(`/patient-notes/${patientId}`),
  save:  (patientId, data)  => api.put(`/patient-notes/${patientId}`, data),
}

export const adminApi = {
  getStats:           ()       => api.get('/admin/stats'),
  listUsers:          (params) => api.get('/admin/users', { params }),
  toggleUserActive:   (id)     => api.put(`/admin/users/${id}/toggle-active`),
  listAppointments:   (params) => api.get('/admin/appointments', { params }),
  createDoctor:       (data)   => api.post('/admin/doctors', data),
  createReceptionist: (data)   => api.post('/admin/receptionists', data),
}

export const patientsApi = {
  search:         (q, limit = 20)    => api.get('/patients/search', { params: { q, limit } }),
  create:         (data)             => api.post('/patients/', data),
  getFull:        (patientId)        => api.get(`/patients/${patientId}/full`),
  updateClinical: (patientId, data)  => api.put(`/patients/${patientId}/clinical`, data),
}

export const sessionLogsApi = {
  get:   (appointmentId)        => api.get(`/appointments/${appointmentId}/session-log`),
  save:  (appointmentId, data)  => api.put(`/appointments/${appointmentId}/session-log`, data),
}

export const reviewsApi = {
  create:           (data)            => api.post('/reviews/', data),
  listForDoctor:    (doctorId)        => api.get(`/reviews/doctor/${doctorId}`),
  forAppointment:   (appointmentId)   => api.get(`/reviews/appointment/${appointmentId}`),
}

export default api
