import Link from 'next/link'
import { Truck, Phone, MessageSquare, DollarSign } from 'lucide-react'

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Truck className="w-12 h-12 text-blue-500" />
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-400 to-green-400 bg-clip-text text-transparent">
              Dispatcher AI
            </h1>
          </div>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Intelligent truck delay negotiation powered by AI. Minimize costs, optimize schedules, and negotiate effectively with warehouse managers.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 mb-16 max-w-4xl mx-auto">
          <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
            <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center mb-4">
              <DollarSign className="w-6 h-6 text-blue-400" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Cost Analysis</h3>
            <p className="text-gray-400 text-sm">
              Real-time calculation of dwell time costs, OTIF penalties, and retailer chargebacks.
            </p>
          </div>

          <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
            <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center mb-4">
              <MessageSquare className="w-6 h-6 text-green-400" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Smart Negotiation</h3>
            <p className="text-gray-400 text-sm">
              AI-powered negotiation strategies with visible thinking traces and decision logic.
            </p>
          </div>

          <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
            <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center mb-4">
              <Phone className="w-6 h-6 text-purple-400" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Voice & Text</h3>
            <p className="text-gray-400 text-sm">
              Communicate via text chat or real-time voice calls with VAPI integration.
            </p>
          </div>
        </div>

        {/* CTA Button */}
        <div className="text-center">
          <Link
            href="/dispatch"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-4 rounded-xl transition-all duration-200 hover:scale-105 hover:shadow-lg hover:shadow-blue-500/25"
          >
            <Truck className="w-5 h-5" />
            Start Dispatch Session
          </Link>
          <p className="text-gray-500 text-sm mt-4">
            Configure your delay parameters and begin negotiation
          </p>
        </div>

        {/* Footer */}
        <footer className="mt-24 text-center text-gray-500 text-sm">
          <p>Powered by Claude AI and VAPI Voice</p>
        </footer>
      </div>
    </main>
  )
}
