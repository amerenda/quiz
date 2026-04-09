import { useNavigate } from 'react-router-dom'
import { PlusCircle, Link, ShieldCheck } from 'lucide-react'

export function Home() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full text-center mb-12">
        <h1 className="text-5xl font-bold text-gray-900 mb-3">Quiz</h1>
        <p className="text-gray-500 text-lg">Share your yes. Find your match.</p>
      </div>

      <div className="max-w-md w-full space-y-3">
        <button
          onClick={() => navigate('/new')}
          className="w-full flex items-center gap-4 p-5 bg-white border border-gray-200 rounded-xl hover:border-gray-400 hover:shadow-sm transition-all text-left group"
        >
          <div className="flex-shrink-0 w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-200 transition-colors">
            <PlusCircle className="w-5 h-5 text-green-700" />
          </div>
          <div>
            <div className="font-semibold text-gray-900">New Quiz</div>
            <div className="text-sm text-gray-500">Create and share a compatibility quiz</div>
          </div>
        </button>

        <button
          onClick={() => {
            const link = prompt('Paste your quiz link or ID:')
            if (!link) return
            const match = link.match(/quiz\/([a-f0-9-]{36})/i) || link.match(/^([a-f0-9-]{36})$/i)
            if (match) navigate(`/quiz/${match[1]}`)
            else alert('Invalid quiz link or ID')
          }}
          className="w-full flex items-center gap-4 p-5 bg-white border border-gray-200 rounded-xl hover:border-gray-400 hover:shadow-sm transition-all text-left group"
        >
          <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors">
            <Link className="w-5 h-5 text-blue-700" />
          </div>
          <div>
            <div className="font-semibold text-gray-900">Join Quiz</div>
            <div className="text-sm text-gray-500">Enter a quiz link or ID</div>
          </div>
        </button>

        <button
          onClick={() => navigate('/admin')}
          className="w-full flex items-center gap-4 p-5 bg-white border border-gray-200 rounded-xl hover:border-gray-400 hover:shadow-sm transition-all text-left group"
        >
          <div className="flex-shrink-0 w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center group-hover:bg-gray-200 transition-colors">
            <ShieldCheck className="w-5 h-5 text-gray-600" />
          </div>
          <div>
            <div className="font-semibold text-gray-900">Admin Portal</div>
            <div className="text-sm text-gray-500">Manage all quizzes</div>
          </div>
        </button>
      </div>
    </div>
  )
}
