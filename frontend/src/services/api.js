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
