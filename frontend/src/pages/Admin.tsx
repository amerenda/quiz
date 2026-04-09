import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trash2, Lock, ArrowLeft, Copy, Check } from 'lucide-react'
import { useAuth, useAdminQuizzes, useDeleteQuiz } from '../hooks/useApi'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function Admin() {
  const navigate = useNavigate()
  const auth = useAuth()
  const quizzes = useAdminQuizzes()
  const deleteQuiz = useDeleteQuiz()
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const copyUrl = (id: string) => {
    navigator.clipboard.writeText(window.location.origin + '/quiz/' + id)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  useEffect(() => {
    if (auth.data && !auth.data.authenticated) {
      window.location.href = '/auth/login'
    }
  }, [auth.data])

  if (auth.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400 text-sm">Loading…</p>
      </div>
    )
  }

  if (!auth.data?.authenticated) return null

  const handleDelete = (id: string) => {
    if (!confirm('Delete this quiz and all its responses?')) return
    deleteQuiz.mutate(id)
  }

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="p-2 text-gray-400 hover:text-gray-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Admin Portal</h1>
              <p className="text-xs text-gray-500">{auth.data.username}</p>
            </div>
          </div>
          <button
            onClick={() => fetch('/auth/logout', { method: 'POST', credentials: 'include' }).then(() => window.location.reload())}
            className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            Sign out
          </button>
        </div>

        {quizzes.isLoading && (
          <p className="text-gray-400 text-sm">Loading quizzes…</p>
        )}

        {quizzes.isError && (
          <p className="text-red-600 text-sm">Failed to load quizzes.</p>
        )}

        {quizzes.data && (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {quizzes.data.length === 0 ? (
              <p className="text-gray-500 text-sm p-6">No quizzes yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-gray-600 font-medium">ID</th>
                    <th className="text-left px-4 py-3 text-gray-600 font-medium">Created</th>
                    <th className="text-left px-4 py-3 text-gray-600 font-medium">Expires</th>
                    <th className="text-center px-4 py-3 text-gray-600 font-medium">Max</th>
                    <th className="text-center px-4 py-3 text-gray-600 font-medium">Submitted</th>
                    <th className="text-center px-4 py-3 text-gray-600 font-medium"></th>
                    <th className="px-4 py-3"></th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {quizzes.data.map((q) => (
                    <tr key={q.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">
                        {q.id.slice(0, 8)}…
                      </td>
                      <td className="px-4 py-3 text-gray-700">{formatDate(q.created_at)}</td>
                      <td className="px-4 py-3 text-gray-500">{formatDate(q.expires_at)}</td>
                      <td className="px-4 py-3 text-center text-gray-700">{q.max_participants}</td>
                      <td className="px-4 py-3 text-center text-gray-700">
                        {q.submitted_count}/{q.participant_count}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {q.has_password && <Lock className="w-3.5 h-3.5 text-gray-400 inline" />}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => copyUrl(q.id)}
                          className="p-1.5 text-gray-400 hover:text-blue-500 transition-colors"
                          title="Copy quiz URL"
                        >
                          {copiedId === q.id ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDelete(q.id)}
                          disabled={deleteQuiz.isPending}
                          className="p-1.5 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                          title="Delete quiz"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
