import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2, Copy, Check, ArrowLeft } from 'lucide-react'
import { useCreateQuiz } from '../hooks/useApi'

export function NewQuiz() {
  const navigate = useNavigate()
  const [categories, setCategories] = useState(['', '', ''])
  const [password, setPassword] = useState('')
  const [usePassword, setUsePassword] = useState(false)
  const [maxParticipants, setMaxParticipants] = useState(2)
  const [title, setTitle] = useState('')
  const [shareURL, setShareURL] = useState('')
  const [shareTitle, setShareTitle] = useState('')
  const [copied, setCopied] = useState(false)

  const createQuiz = useCreateQuiz()

  const addCategory = () => setCategories([...categories, ''])
  const removeCategory = (i: number) => setCategories(categories.filter((_, idx) => idx !== i))
  const updateCategory = (i: number, val: string) => {
    const next = [...categories]
    next[i] = val
    setCategories(next)
  }

  const handlePublish = () => {
    const cats = categories.map((c) => c.trim()).filter(Boolean)
    if (cats.length === 0) return
    createQuiz.mutate(
      {
        categories: cats,
        password: usePassword ? password : undefined,
        max_participants: maxParticipants,
        title: title || undefined,
      },
      {
        onSuccess: (data) => {
          setShareURL(data.share_url)
          setShareTitle(data.title)
        },
      },
    )
  }

  const copy = () => {
    navigator.clipboard.writeText(shareURL)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (shareURL) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-6 h-6 text-green-700" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Quiz Published</h2>
            {shareTitle && <p className="text-gray-700 font-medium mb-1">{shareTitle}</p>}
            <p className="text-gray-500 text-sm mb-6">Share this link with your participants</p>

            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4">
              <span className="flex-1 text-sm text-gray-700 truncate">{shareURL}</span>
              <button
                onClick={copy}
                className="flex-shrink-0 p-1.5 hover:bg-gray-200 rounded transition-colors"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-600" />
                ) : (
                  <Copy className="w-4 h-4 text-gray-500" />
                )}
              </button>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => navigate(shareURL.replace(window.location.origin, ''))}
                className="flex-1 bg-gray-900 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors"
              >
                Fill it out now
              </button>
              <button
                onClick={() => { setShareURL(''); setShareTitle(''); setTitle(''); setCategories(['', '', '']) }}
                className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Create another
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const validCategories = categories.filter((c) => c.trim()).length

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="max-w-lg mx-auto">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-800 text-sm mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <h1 className="text-2xl font-bold text-gray-900 mb-1">New Quiz</h1>
        <p className="text-gray-500 text-sm mb-8">Add topics or categories for participants to respond to</p>

        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-4">
          <h2 className="font-semibold text-gray-800 mb-4">Categories</h2>
          <div className="space-y-2">
            {categories.map((cat, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  value={cat}
                  onChange={(e) => updateCategory(i, e.target.value)}
                  placeholder={`Category ${i + 1}`}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addCategory()
                    }
                  }}
                />
                {categories.length > 1 && (
                  <button
                    onClick={() => removeCategory(i)}
                    className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={addCategory}
            className="mt-3 flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add category
          </button>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-4">
          <h2 className="font-semibold text-gray-800 mb-4">Options</h2>

          <div className="mb-4">
            <label className="block text-sm text-gray-700 mb-1">Quiz title <span className="text-gray-400">(optional)</span></label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Auto-generated if left blank"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm text-gray-700 mb-1">Participants</label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={2}
                max={20}
                value={maxParticipants}
                onChange={(e) => setMaxParticipants(Math.max(2, Math.min(20, parseInt(e.target.value) || 2)))}
                className="w-20 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
              />
              <span className="text-sm text-gray-500">people (2–20)</span>
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer mb-2">
              <input
                type="checkbox"
                checked={usePassword}
                onChange={(e) => setUsePassword(e.target.checked)}
                className="rounded"
              />
              Password protect this quiz
            </label>
            {usePassword && (
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter a password"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
              />
            )}
          </div>
        </div>

        {createQuiz.isError && (
          <p className="text-red-600 text-sm mb-3">{createQuiz.error?.message}</p>
        )}

        <button
          onClick={handlePublish}
          disabled={validCategories === 0 || createQuiz.isPending}
          className="w-full bg-gray-900 text-white py-3 rounded-xl font-medium hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {createQuiz.isPending ? 'Publishing…' : 'Publish Quiz'}
        </button>
      </div>
    </div>
  )
}
