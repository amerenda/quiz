import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trash2, Lock, ArrowLeft, Copy, Check, ChevronDown, ChevronUp, Unlock, Pencil } from 'lucide-react'
import { useAuth, useAdminQuizzes, useDeleteQuiz, useUpdateQuiz } from '../hooks/useApi'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function Admin() {
  const navigate = useNavigate()
  const auth = useAuth()
  const quizzes = useAdminQuizzes()
  const deleteQuiz = useDeleteQuiz()
  const updateQuiz = useUpdateQuiz()

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState<{ id: string; value: string } | null>(null)

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

  const copyUrl = (id: string) => {
    navigator.clipboard.writeText(window.location.origin + '/quiz/' + id)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  const handleDelete = (id: string) => {
    if (!confirm('Delete this quiz and all its responses?')) return
    deleteQuiz.mutate(id, {
      onSuccess: () => {
        if (expandedId === id) setExpandedId(null)
      }
    })
  }

  const handleUnlock = (id: string) => {
    updateQuiz.mutate({ id, hidden: false })
  }

  const saveTitle = (id: string, value: string) => {
    const trimmed = value.trim()
    if (trimmed) {
      updateQuiz.mutate({ id, title: trimmed })
    }
    setEditingTitle(null)
  }

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id)
    setEditingTitle(null)
  }

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')} className="p-2 text-gray-400 hover:text-gray-700 transition-colors">
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

        {quizzes.isLoading && <p className="text-gray-400 text-sm">Loading quizzes…</p>}
        {quizzes.isError && <p className="text-red-600 text-sm">Failed to load quizzes.</p>}

        {quizzes.data && (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {quizzes.data.length === 0 ? (
              <p className="text-gray-500 text-sm p-6">No quizzes yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-gray-600 font-medium">Title</th>
                    <th className="text-left px-4 py-3 text-gray-600 font-medium">Created</th>
                    <th className="text-left px-4 py-3 text-gray-600 font-medium">Expires</th>
                    <th className="text-center px-4 py-3 text-gray-600 font-medium">Max</th>
                    <th className="text-center px-4 py-3 text-gray-600 font-medium">Submitted</th>
                    <th className="px-4 py-3 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {quizzes.data.map((q) => (
                    <React.Fragment key={q.id}>
                      <tr
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => toggleExpand(q.id)}
                      >
                        <td className="px-4 py-3 text-gray-900">
                          <div className="flex items-center gap-2">
                            {q.title || <span className="text-gray-400 font-mono text-xs">{q.id.slice(0, 8)}…</span>}
                            {q.hidden && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-amber-100 text-amber-700">
                                <Lock className="w-3 h-3" /> locked
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-700">{formatDate(q.created_at)}</td>
                        <td className="px-4 py-3 text-gray-500">{formatDate(q.expires_at)}</td>
                        <td className="px-4 py-3 text-center text-gray-700">{q.max_participants}</td>
                        <td className="px-4 py-3 text-center text-gray-700">{q.submitted_count}/{q.participant_count}</td>
                        <td className="px-4 py-3 text-right text-gray-400">
                          {expandedId === q.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </td>
                      </tr>
                      {expandedId === q.id && (
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <td colSpan={6} className="px-4 py-3">
                            <div className="flex items-center gap-3 flex-wrap">
                              {/* Copy URL */}
                              <button
                                onClick={(e) => { e.stopPropagation(); copyUrl(q.id) }}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-700 hover:bg-white transition-colors"
                              >
                                {copiedId === q.id ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                                {copiedId === q.id ? 'Copied' : 'Copy URL'}
                              </button>

                              {/* Edit title */}
                              {editingTitle?.id === q.id ? (
                                <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                                  <input
                                    autoFocus
                                    type="text"
                                    value={editingTitle.value}
                                    onChange={e => setEditingTitle({ id: q.id, value: e.target.value })}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') saveTitle(q.id, editingTitle.value)
                                      if (e.key === 'Escape') setEditingTitle(null)
                                    }}
                                    onBlur={() => saveTitle(q.id, editingTitle.value)}
                                    className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 w-48"
                                  />
                                </div>
                              ) : (
                                <button
                                  onClick={(e) => { e.stopPropagation(); setEditingTitle({ id: q.id, value: q.title || '' }) }}
                                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-700 hover:bg-white transition-colors"
                                >
                                  <Pencil className="w-3.5 h-3.5" /> Edit Title
                                </button>
                              )}

                              {/* Unlock */}
                              {q.hidden && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleUnlock(q.id) }}
                                  disabled={updateQuiz.isPending}
                                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-amber-200 text-amber-700 hover:bg-amber-50 transition-colors disabled:opacity-50"
                                >
                                  <Unlock className="w-3.5 h-3.5" /> Unlock Results
                                </button>
                              )}

                              {/* Delete */}
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDelete(q.id) }}
                                disabled={deleteQuiz.isPending}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 ml-auto"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
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
