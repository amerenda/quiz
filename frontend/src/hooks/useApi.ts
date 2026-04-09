import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { QuizInfo, QuizStatus, ResultsResponse, AdminQuizSummary } from '../types'

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(path, { credentials: 'include', ...options })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw Object.assign(new Error(text), { status: res.status })
  }
  return res.json()
}

// Auth

export function useAuth() {
  return useQuery<{ authenticated: boolean; username?: string }>({
    queryKey: ['auth-me'],
    queryFn: () => apiFetch('/auth/me'),
  })
}

// Quiz

export function useQuizInfo(quizId: string) {
  return useQuery<QuizInfo>({
    queryKey: ['quiz', quizId],
    queryFn: () => apiFetch(`/api/quizzes/${quizId}`),
    enabled: !!quizId,
  })
}

export function useQuizStatus(quizId: string, enabled = true) {
  return useQuery<QuizStatus>({
    queryKey: ['quiz-status', quizId],
    queryFn: () => apiFetch(`/api/quizzes/${quizId}/status`),
    enabled: !!quizId && enabled,
    refetchInterval: (query) => (query.state.data?.all_submitted ? false : 4000),
  })
}

export function useResults(quizId: string, enabled = true) {
  return useQuery<ResultsResponse>({
    queryKey: ['quiz-results', quizId],
    queryFn: () => apiFetch(`/api/quizzes/${quizId}/results`),
    enabled: !!quizId && enabled,
    retry: false,
  })
}

export function useCreateQuiz() {
  return useMutation<{ id: string; share_url: string }, Error, {
    categories: string[]
    password?: string
    max_participants?: number
  }>({
    mutationFn: (body) =>
      apiFetch('/api/quizzes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
  })
}

export function useJoinQuiz(quizId: string) {
  return useMutation<{ participant_token: string; participant_id: string }, Error, {
    name: string
    password?: string
  }>({
    mutationFn: (body) =>
      apiFetch(`/api/quizzes/${quizId}/participants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
  })
}

export function useSubmitQuiz(quizId: string) {
  return useMutation<{ submitted: boolean; all_submitted: boolean }, Error, {
    responses: { category_id: string; answer: string }[]
    token: string
  }>({
    mutationFn: ({ responses, token }) =>
      apiFetch(`/api/quizzes/${quizId}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ responses }),
      }),
  })
}

// Admin

export function useAdminQuizzes() {
  return useQuery<AdminQuizSummary[]>({
    queryKey: ['admin-quizzes'],
    queryFn: () => apiFetch('/api/admin/quizzes'),
  })
}

export function useDeleteQuiz() {
  const qc = useQueryClient()
  return useMutation<void, Error, string>({
    mutationFn: (quizId) =>
      apiFetch(`/api/admin/quizzes/${quizId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-quizzes'] }),
  })
}
